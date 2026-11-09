/**
 * U-Pad Local High-Performance Backend Server
 * Soporte autónomo para Login, Registro, Gestión de Rutinas, Dispositivos y Rastreo GPS.
 * Diseñado para soportar cargas masivas de más de 100 usuarios concurrentes en K6.
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// Almacenamiento en memoria ultrarrápido para soporte de alta concurrencia
const db = {
    users: new Map(),           // email -> user
    usersById: new Map(),       // uid -> user
    routines: new Map(),        // `${uid}_${turn}_${day}` -> tasks[]
    reinforcements: new Map(),  // `${uid}_${turn}` -> messages[]
    devices: new Map(),         // deviceId -> { deviceId, parentId, lat, lng, model, active }
    pairingCodes: new Map(),    // code -> { code, deviceId, status, parentId }
    notifications: new Map(),   // uid -> notifications[]
    emotions: new Map()         // uid -> emotions[]
};

// Usuario demo inicial
const demoUser = {
    uid: 'padre_local_1',
    email: 'demo@upad.local',
    name: 'PAPÁ DEMO',
    passwordHash: hashPassword('password123'),
    isPremium: true,
    language: 'es',
    createdAt: Date.now()
};
db.users.set(demoUser.email, demoUser);
db.usersById.set(demoUser.uid, demoUser);

function hashPassword(pass) {
    return crypto.createHash('sha256').update(pass || '').digest('hex');
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // Límite de 5MB
            if (body.length > 5 * 1024 * 1024) {
                req.destroy();
                reject(new Error('Payload too large'));
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    const jsonStr = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonStr),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(jsonStr);
}

const server = http.createServer(async (req, res) => {
    // Manejo de CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end();
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    try {
        // --- 1. HEALTH CHECK ---
        if (pathname === '/api/health' && method === 'GET') {
            return sendJson(res, 200, {
                status: 'ok',
                service: 'UPad-Local-Engine',
                activeUsers: db.users.size,
                timestamp: Date.now()
            });
        }

        // --- 2. AUTH: REGISTRO ---
        if (pathname === '/api/auth/register' && method === 'POST') {
            const body = await parseJsonBody(req);
            const email = (body.email || '').trim().toLowerCase();
            const password = body.password || '';
            const name = (body.name || '').trim() || (email.split('@')[0] || 'Usuario').toUpperCase();

            if (!email || !password) {
                return sendJson(res, 400, { error: 'Email y contraseña requeridos' });
            }

            let user = db.users.get(email);
            if (!user) {
                user = {
                    uid: 'usr_' + crypto.randomUUID().slice(0, 8),
                    email,
                    name,
                    passwordHash: hashPassword(password),
                    isPremium: true,
                    language: 'es',
                    createdAt: Date.now()
                };
                db.users.set(email, user);
                db.usersById.set(user.uid, user);
            }

            return sendJson(res, 200, {
                status: 'success',
                token: 'jwt_local_' + user.uid,
                user: {
                    uid: user.uid,
                    email: user.email,
                    name: user.name,
                    isPremium: user.isPremium,
                    language: user.language
                }
            });
        }

        // --- 3. AUTH: LOGIN ---
        if (pathname === '/api/auth/login' && method === 'POST') {
            const body = await parseJsonBody(req);
            const email = (body.email || '').trim().toLowerCase();
            const password = body.password || '';

            if (!email || !password) {
                return sendJson(res, 400, { error: 'Email y contraseña requeridos' });
            }

            let user = db.users.get(email);
            if (!user) {
                // Modo tolerante local: auto-registro rápido si no existe
                user = {
                    uid: 'usr_' + crypto.randomUUID().slice(0, 8),
                    email,
                    name: (email.split('@')[0] || 'Padre').toUpperCase(),
                    passwordHash: hashPassword(password),
                    isPremium: true,
                    language: 'es',
                    createdAt: Date.now()
                };
                db.users.set(email, user);
                db.usersById.set(user.uid, user);
            }

            return sendJson(res, 200, {
                status: 'success',
                token: 'jwt_local_' + user.uid,
                user: {
                    uid: user.uid,
                    email: user.email,
                    name: user.name,
                    isPremium: user.isPremium,
                    language: user.language
                }
            });
        }

        // --- 4. PERFIL DE USUARIO ---
        if (pathname.startsWith('/api/users/') && method === 'GET') {
            const parts = pathname.split('/');
            const uid = parts[3];
            const user = db.usersById.get(uid);
            if (!user) {
                return sendJson(res, 404, { error: 'Usuario no encontrado' });
            }
            return sendJson(res, 200, {
                uid: user.uid,
                email: user.email,
                name: user.name,
                isPremium: user.isPremium,
                language: user.language
            });
        }

        // --- 5. ACTUALIZAR ESTADO PREMIUM ---
        if (pathname.match(/^\/api\/users\/[^\/]+\/premium$/) && method === 'PUT') {
            const parts = pathname.split('/');
            const uid = parts[3];
            const body = await parseJsonBody(req);
            const user = db.usersById.get(uid);
            if (user) {
                user.isPremium = Boolean(body.isPremium);
            }
            return sendJson(res, 200, { status: 'success', isPremium: user ? user.isPremium : true });
        }

        // --- 6. GUARDAR RUTINA POR DÍA Y TURNO ---
        // POST /api/routines/:userId/:turn/:day
        if (pathname.startsWith('/api/routines/') && method === 'POST') {
            const parts = pathname.split('/');
            if (parts.length >= 6) {
                const uid = parts[3];
                const turn = decodeURIComponent(parts[4]).toUpperCase().trim();
                const day = decodeURIComponent(parts[5]).toUpperCase().trim();
                const body = await parseJsonBody(req);
                const tasks = Array.isArray(body.tasks) ? body.tasks : [];

                const key = `${uid}_${turn}_${day}`;
                db.routines.set(key, tasks);
                return sendJson(res, 200, { status: 'success', key, count: tasks.length });
            }
        }

        // --- 7. CONSULTAR RUTINA POR DÍA Y TURNO ---
        // GET /api/routines/:userId/:turn/:day
        if (pathname.startsWith('/api/routines/') && method === 'GET') {
            const parts = pathname.split('/');
            if (parts.length >= 6) {
                const uid = parts[3];
                const turn = decodeURIComponent(parts[4]).toUpperCase().trim();
                const day = decodeURIComponent(parts[5]).toUpperCase().trim();
                const key = `${uid}_${turn}_${day}`;
                const tasks = db.routines.get(key) || [];
                return sendJson(res, 200, { turn, day, tasks });
            }
        }

        // --- 8. COMPLETAR TAREA Y FEEDBACK EMOCIONAL ---
        if (pathname === '/api/routines/complete-task' && method === 'POST') {
            const body = await parseJsonBody(req);
            const { userId, turn, day, actividad, emocion } = body;
            const uid = userId || 'padre_local_1';
            const key = `${uid}_${(turn || 'MAÑANA').toUpperCase().trim()}_${(day || 'LUNES').toUpperCase().trim()}`;

            const tasks = db.routines.get(key) || [];
            const task = tasks.find(t => (t.actividad || '').toUpperCase() === (actividad || '').toUpperCase());
            if (task) {
                if (!task.estadosPorDia) task.estadosPorDia = {};
                if (!task.emocionesPorDia) task.emocionesPorDia = {};
                const prefijo = (day || 'LUN').slice(0, 3).toUpperCase();
                task.estadosPorDia[prefijo] = true;
                if (emocion) task.emocionesPorDia[prefijo] = emocion;
            }

            // Registrar emoción
            const emoList = db.emotions.get(uid) || [];
            emoList.push({
                actividad,
                emocion: emocion || 'FELIZ',
                turn,
                day,
                timestamp: Date.now()
            });
            db.emotions.set(uid, emoList);

            // Generar notificación para el padre
            const notifs = db.notifications.get(uid) || [];
            notifs.push({
                title: '¡Actividad completada! 🌟',
                description: `Tu hijo ha completado: ${actividad}`,
                timestamp: Date.now()
            });
            db.notifications.set(uid, notifs);

            return sendJson(res, 200, { status: 'success', completed: true });
        }

        // --- 9. MENSAJES DE REFUERZO ---
        if (pathname.startsWith('/api/reinforcements/') && method === 'POST') {
            const parts = pathname.split('/');
            const uid = parts[3];
            const turn = (parts[4] || 'MAÑANA').toUpperCase().trim();
            const body = await parseJsonBody(req);
            const messages = Array.isArray(body.messages) ? body.messages : [];
            db.reinforcements.set(`${uid}_${turn}`, messages);
            return sendJson(res, 200, { status: 'success', count: messages.length });
        }

        if (pathname.startsWith('/api/reinforcements/') && method === 'GET') {
            const parts = pathname.split('/');
            const uid = parts[3];
            const turn = (parts[4] || 'MAÑANA').toUpperCase().trim();
            const messages = db.reinforcements.get(`${uid}_${turn}`) || [
                '¡Excelente trabajo hoy! 🌟',
                '¡Sigue adelante! 🚀',
                '¡Completaste tu rutina con éxito! 🎉'
            ];
            return sendJson(res, 200, { messages });
        }

        // --- 10. VINCULACIÓN DE DISPOSITIVOS ---
        if (pathname === '/api/devices/pairing/create' && method === 'POST') {
            const body = await parseJsonBody(req);
            const code = body.code || Math.floor(100000 + Math.random() * 900000).toString();
            const deviceId = body.deviceId || 'dev_' + crypto.randomUUID().slice(0, 6);

            const entry = { code, deviceId, status: 'esperando', parentId: '' };
            db.pairingCodes.set(code, entry);
            return sendJson(res, 200, entry);
        }

        if (pathname.startsWith('/api/devices/pairing/') && method === 'GET') {
            const code = pathname.split('/')[4];
            const entry = db.pairingCodes.get(code);
            if (!entry) return sendJson(res, 404, { error: 'Código no encontrado' });
            return sendJson(res, 200, entry);
        }

        if (pathname === '/api/devices/pairing/link' && method === 'POST') {
            const body = await parseJsonBody(req);
            const { code, parentId } = body;
            const entry = db.pairingCodes.get(code);

            const targetDeviceId = entry ? entry.deviceId : (body.deviceId || 'dev_child');
            if (entry) {
                entry.status = 'enlazado';
                entry.parentId = parentId;
            }

            db.devices.set(targetDeviceId, {
                deviceId: targetDeviceId,
                parentId,
                model: 'Tablet TEA Child',
                latitud: -12.046374,
                longitud: -77.042793,
                kioscoActivo: false,
                updatedAt: Date.now()
            });

            return sendJson(res, 200, { status: 'success', paired: true, deviceId: targetDeviceId });
        }

        // --- 11. TELEMETRÍA GPS DE UBICACIÓN ---
        if (pathname.startsWith('/api/devices/location/') && method === 'POST') {
            const deviceId = pathname.split('/')[4];
            const body = await parseJsonBody(req);
            const current = db.devices.get(deviceId) || { deviceId };
            current.latitud = body.latitude || body.latitud || -12.046374;
            current.longitud = body.longitude || body.longitud || -77.042793;
            current.updatedAt = Date.now();
            db.devices.set(deviceId, current);
            return sendJson(res, 200, { status: 'success', location: current });
        }

        if (pathname.startsWith('/api/devices/location/') && method === 'GET') {
            const deviceId = pathname.split('/')[4];
            const current = db.devices.get(deviceId) || {
                deviceId,
                latitud: -12.046374,
                longitud: -77.042793,
                updatedAt: Date.now()
            };
            return sendJson(res, 200, current);
        }

        // --- 12. NOTIFICACIONES ---
        if (pathname.startsWith('/api/notifications/') && method === 'GET') {
            const uid = pathname.split('/')[3];
            const list = db.notifications.get(uid) || [];
            return sendJson(res, 200, { notifications: list });
        }

        // 404 No encontrado
        return sendJson(res, 404, { error: 'Ruta no encontrada', path: pathname });

    } catch (err) {
        console.error('Server internal error:', err);
        return sendJson(res, 500, { error: 'Error interno del servidor', message: err.message });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` 🚀 Servidor Local U-Pad activo en http://0.0.0.0:${PORT}`);
    console.log(`    Listo para pruebas masivas de carga con K6`);
    console.log(`=======================================================`);
});
