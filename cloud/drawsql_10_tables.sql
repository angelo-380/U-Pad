-- ============================================================================
-- U-PAD ENTERPRISE RELATIONAL SCHEMA (10 TABLES)
-- Compatible with DrawSQL.com (Select PostgreSQL or MySQL when importing)
-- ============================================================================

CREATE TABLE organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(128) NOT NULL UNIQUE,
    subscription_plan VARCHAR(64) NOT NULL DEFAULT 'ENTERPRISE_SCHOOL',
    allocated_seats INT NOT NULL DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(64) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'PARENT',
    organization_id VARCHAR(64),
    is_premium BOOLEAN NOT NULL DEFAULT TRUE,
    language_code VARCHAR(10) NOT NULL DEFAULT 'es',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE TABLE iam_role_permissions (
    role VARCHAR(32) PRIMARY KEY,
    can_manage_infrastructure BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_database_schema BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_organization BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_educators BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_students BOOLEAN NOT NULL DEFAULT FALSE,
    can_view_aggregated_telemetry BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_billing BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE child_devices (
    device_id VARCHAR(128) PRIMARY KEY,
    parent_id VARCHAR(64),
    organization_id VARCHAR(64),
    child_name VARCHAR(128) DEFAULT 'Diego',
    device_model VARCHAR(128) NOT NULL DEFAULT 'Android Tablet (Samsung Galaxy Tab A8)',
    is_kiosk_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_latitude FLOAT DEFAULT -12.046374,
    last_longitude FLOAT DEFAULT -77.042793,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_devices_parent FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_devices_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE TABLE pairing_codes (
    code VARCHAR(16) PRIMARY KEY,
    device_id VARCHAR(128) NOT NULL,
    parent_id VARCHAR(64),
    organization_id VARCHAR(64),
    pairing_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    CONSTRAINT fk_pairing_parent FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_pairing_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE TABLE routines (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    organization_id VARCHAR(64),
    shift_name VARCHAR(32) NOT NULL,
    day_of_week VARCHAR(32) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_routines_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_routines_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE TABLE tasks (
    id VARCHAR(64) PRIMARY KEY,
    routine_id VARCHAR(64) NOT NULL,
    activity_name VARCHAR(255) NOT NULL,
    keyword VARCHAR(128) NOT NULL,
    image_url TEXT NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 15,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tasks_routine FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
);

CREATE TABLE task_executions (
    id VARCHAR(64) PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    day_of_week VARCHAR(32) NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT TRUE,
    emotion_rating VARCHAR(32) DEFAULT 'HAPPY',
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_executions_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE reinforcement_messages (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    shift_name VARCHAR(32) NOT NULL,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reinforcement_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    notification_type VARCHAR(32) NOT NULL DEFAULT 'INFO',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
