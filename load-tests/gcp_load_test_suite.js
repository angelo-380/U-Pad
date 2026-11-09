import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// Progressive Staged Stress Test: 100 to 1,500 Concurrent Virtual Users (VUs)
export const options = {
    stages: [
        { duration: '10s', target: 100 },  // Level 1: 100 concurrent users (Mandatory minimum)
        { duration: '15s', target: 300 },  // Level 2: 300 concurrent users
        { duration: '20s', target: 600 },  // Level 3: 600 concurrent users
        { duration: '25s', target: 1000 }, // Level 4: 1,000 concurrent users
        { duration: '20s', target: 1500 }, // Peak Stress: 1,500 concurrent users
        { duration: '10s', target: 0 },    // Cooldown phase
    ],
    thresholds: {
        http_req_failed: ['rate<0.05'], // Failure rate strictly under 5% during peak loads
        http_req_duration: ['p(95)<500'], // 95% of requests completed under 500ms
    },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:8080';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export default function () {
    const vuId = __VU;
    const iterId = __ITER;
    const userEmail = `parent_vu_${vuId}_it_${iterId}@upad.cloud`;
    const userPassword = 'ProductionSecure2026!#';
    const userFullName = `Parent User ${vuId}`;
    let userId = `usr_${vuId}`;

    // 1. ENDPOINT: USER REGISTRATION
    group('01_User_Registration', function () {
        const payload = JSON.stringify({
            fullName: userFullName,
            email: userEmail,
            password: userPassword
        });

        const res = http.post(`${BASE_URL}/api/v1/auth/register`, payload, { headers: JSON_HEADERS });
        check(res, {
            'registration returns 200': (r) => r.status === 200,
        });

        if (res.status === 200) {
            try {
                const body = JSON.parse(res.body);
                if (body && body.user && body.user.id) {
                    userId = body.user.id;
                }
            } catch (e) {}
        }
    });

    sleep(0.05);

    // 2. ENDPOINT: CONCURRENT USER AUTHENTICATION
    group('02_User_Authentication', function () {
        const payload = JSON.stringify({
            email: userEmail,
            password: userPassword
        });

        const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, { headers: JSON_HEADERS });
        check(res, {
            'authentication returns 200': (r) => r.status === 200,
            'token is present': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return Boolean(body && (body.accessToken || (body.data && body.data.accessToken)));
                } catch (e) {
                    return false;
                }
            },
        });
    });

    sleep(0.05);

    // 3. ENDPOINT: USER PROFILE & SUBSCRIPTION MANAGEMENT
    group('03_Profile_And_Subscription', function () {
        const resProfile = http.get(`${BASE_URL}/api/v1/users/${userId}/profile`, { headers: JSON_HEADERS });
        check(resProfile, {
            'profile fetch returns 200': (r) => r.status === 200,
        });

        const subscriptionPayload = JSON.stringify({ isPremium: true });
        const resSub = http.put(`${BASE_URL}/api/v1/users/${userId}/subscription`, subscriptionPayload, { headers: JSON_HEADERS });
        check(resSub, {
            'subscription update returns 200': (r) => r.status === 200,
        });
    });

    sleep(0.05);

    // 4. ENDPOINT: SCHEDULE CREATION AND RETRIEVAL
    group('04_Schedule_Routines', function () {
        const taskPayload = JSON.stringify({
            tasks: [
                {
                    activityName: 'WAKE UP AND MAKE BED',
                    keyword: 'wake_up',
                    imageUrl: 'https://static.arasaac.org/pictograms/2445/2445_500.png',
                    durationMinutes: 10
                },
                {
                    activityName: 'BRUSH TEETH',
                    keyword: 'brush_teeth',
                    imageUrl: 'https://static.arasaac.org/pictograms/2568/2568_500.png',
                    durationMinutes: 5
                },
                {
                    activityName: 'EAT HEALTHY BREAKFAST',
                    keyword: 'breakfast',
                    imageUrl: 'https://static.arasaac.org/pictograms/2843/2843_500.png',
                    durationMinutes: 20
                }
            ]
        });

        const resSave = http.post(`${BASE_URL}/api/v1/routines/${userId}/MORNING/MONDAY`, taskPayload, { headers: JSON_HEADERS });
        check(resSave, {
            'routine save returns 200': (r) => r.status === 200,
        });

        const resGet = http.get(`${BASE_URL}/api/v1/routines/${userId}/MORNING/MONDAY`, { headers: JSON_HEADERS });
        check(resGet, {
            'routine query returns 200': (r) => r.status === 200,
            'routine contains 3 tasks': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return Array.isArray(body?.tasks) && body.tasks.length === 3;
                } catch (e) {
                    return false;
                }
            },
        });
    });

    sleep(0.05);

    // 5. ENDPOINT: TASK COMPLETION AND EMOTIONAL FEEDBACK
    group('05_Task_Execution_Feedback', function () {
        const executionPayload = JSON.stringify({
            userId: userId,
            activityName: 'BRUSH TEETH',
            dayOfWeek: 'MONDAY',
            emotionRating: 'HAPPY',
            deviceId: `device_tablet_${vuId}`
        });

        const resComplete = http.post(`${BASE_URL}/api/v1/routines/tasks/complete`, executionPayload, { headers: JSON_HEADERS });
        check(resComplete, {
            'task completion returns 200': (r) => r.status === 200,
        });
    });

    sleep(0.05);

    // 6. ENDPOINT: CHILD DEVICE PAIRING FLOW
    let pairingCode = '999999';
    group('06_Device_Pairing', function () {
        const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resCreate = http.post(
            `${BASE_URL}/api/v1/devices/pairing/create`,
            JSON.stringify({ code: randomCode, deviceId: `child_tablet_${vuId}` }),
            { headers: JSON_HEADERS }
        );

        if (resCreate.status === 200) {
            try {
                const body = JSON.parse(resCreate.body);
                if (body && body.code) {
                    pairingCode = body.code;
                }
            } catch (e) {}
        }

        const resLink = http.post(
            `${BASE_URL}/api/v1/devices/pairing/link`,
            JSON.stringify({ code: pairingCode, parentId: userId }),
            { headers: JSON_HEADERS }
        );
        check(resLink, {
            'pairing link returns 200': (r) => r.status === 200,
        });
    });

    sleep(0.05);

    // 7. ENDPOINT: REALTIME GPS TELEMETRY
    group('07_GPS_Telemetry', function () {
        const deviceId = `child_tablet_${vuId}`;
        const locationPayload = JSON.stringify({
            latitude: -12.046374 + (Math.random() * 0.01),
            longitude: -77.042793 + (Math.random() * 0.01)
        });

        const resPostLoc = http.post(`${BASE_URL}/api/v1/devices/${deviceId}/telemetry`, locationPayload, { headers: JSON_HEADERS });
        check(resPostLoc, {
            'telemetry post returns 200': (r) => r.status === 200,
        });

        const resGetLoc = http.get(`${BASE_URL}/api/v1/devices/${deviceId}/telemetry`, { headers: JSON_HEADERS });
        check(resGetLoc, {
            'telemetry get returns 200': (r) => r.status === 200,
        });
    });

    sleep(0.05);

    // 8. ENDPOINT: NOTIFICATIONS & POSITIVE REINFORCEMENTS
    group('08_Notifications_And_Reinforcements', function () {
        const resNotif = http.get(`${BASE_URL}/api/v1/users/${userId}/notifications`, { headers: JSON_HEADERS });
        check(resNotif, {
            'notifications return 200': (r) => r.status === 200,
        });

        const resReinf = http.get(`${BASE_URL}/api/v1/routines/${userId}/MORNING/reinforcements`, { headers: JSON_HEADERS });
        check(resReinf, {
            'reinforcements return 200': (r) => r.status === 200,
        });
    });

    sleep(0.05);

    sleep(0.1);
}

// Visual HTML Summary Dashboard Generation
export function handleSummary(data) {
    return {
        "gcp_stress_report.html": htmlReport(data),
        stdout: textSummary(data, { indent: " ", enableColors: true }),
    };
}
