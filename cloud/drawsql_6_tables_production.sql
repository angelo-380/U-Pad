-- ============================================================================
-- U-PAD PRODUCTION DATABASE SCHEMA (6 TABLES)
-- Exact schema running in Google Cloud Run (upad.db)
-- Compatible with DrawSQL.com (Select PostgreSQL or MySQL when importing)
-- ============================================================================

CREATE TABLE usuarios (
    id VARCHAR(64) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(64) NOT NULL,
    rol VARCHAR(32) NOT NULL DEFAULT 'tutor', -- 'developer', 'admin', 'empresario', 'tutor'
    organizacionId VARCHAR(64) DEFAULT NULL,
    activo INT NOT NULL DEFAULT 1,
    creadoEn TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rutinas (
    id VARCHAR(64) PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    turno VARCHAR(32) NOT NULL, -- 'mañana', 'tarde', 'noche'
    ninoId VARCHAR(64) DEFAULT NULL,
    organizacionId VARCHAR(64) DEFAULT NULL,
    pasos TEXT NOT NULL DEFAULT '[]', -- JSON estructurado de pasos, pictogramas y tiempos
    activa INT NOT NULL DEFAULT 1,
    creadoPor VARCHAR(64) NOT NULL,
    creadoEn TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizadoEn TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rutinas_usuario FOREIGN KEY (creadoPor) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE login_lockouts (
    email VARCHAR(255) PRIMARY KEY,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until BIGINT NOT NULL DEFAULT 0,
    last_attempt BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE pairing_codes (
    code VARCHAR(16) PRIMARY KEY,
    device_id VARCHAR(128) NOT NULL,
    parent_id VARCHAR(64) DEFAULT NULL,
    organization_id VARCHAR(64) DEFAULT NULL,
    pairing_status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'LINKED', 'EXPIRED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    CONSTRAINT fk_pairing_parent FOREIGN KEY (parent_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE child_devices (
    device_id VARCHAR(128) PRIMARY KEY,
    parent_id VARCHAR(64) DEFAULT NULL,
    child_name VARCHAR(128) DEFAULT 'Diego',
    device_model VARCHAR(128) NOT NULL DEFAULT 'Android Tablet (Samsung Galaxy Tab A8)',
    is_kiosk_active INT NOT NULL DEFAULT 1,
    last_latitude FLOAT DEFAULT -12.046374,
    last_longitude FLOAT DEFAULT -77.042793,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_devices_parent FOREIGN KEY (parent_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE backups_history (
    id VARCHAR(64) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    size_formatted VARCHAR(32) NOT NULL,
    tipo VARCHAR(32) NOT NULL DEFAULT 'MANUAL', -- 'MANUAL', 'AUTOMATICO'
    creado_por VARCHAR(64) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_backups_usuario FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE CASCADE
);
