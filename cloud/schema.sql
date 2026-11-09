-- ============================================================================
-- U-PAD GOOGLE CLOUD PLATFORM (GCP) RELATIONAL DATABASE SCHEMA
-- Target Engine: Google Cloud SQL (PostgreSQL / MySQL) & SQLite Engine
-- All Identifiers and Structures in Pure English
-- ============================================================================

-- 1. ORGANIZATIONS TABLE (B2B Multi-Tenant: Schools, Clinics, Enterprise Centers)
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(128) NOT NULL UNIQUE,
    subscription_plan VARCHAR(64) NOT NULL DEFAULT 'ENTERPRISE_SCHOOL',
    allocated_seats INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(64) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'PARENT', -- 'DEVELOPER', 'ORG_ADMIN', 'EDUCATOR', 'PARENT', 'CHILD'
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
    is_premium BOOLEAN NOT NULL DEFAULT 1,
    language_code VARCHAR(10) NOT NULL DEFAULT 'en',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. IAM ROLE PERMISSIONS TABLE (Principle of Least Privilege)
-- Developer: 100% control of cloud infrastructure, schemas, deployment, and root config.
-- Org Admin (B2B School/Clinic): Tenant-level administration, cannot alter cloud infra or elevate to Developer.
CREATE TABLE IF NOT EXISTS iam_role_permissions (
    role VARCHAR(32) PRIMARY KEY,
    can_manage_infrastructure BOOLEAN NOT NULL DEFAULT 0,
    can_manage_database_schema BOOLEAN NOT NULL DEFAULT 0,
    can_manage_organization BOOLEAN NOT NULL DEFAULT 0,
    can_manage_educators BOOLEAN NOT NULL DEFAULT 0,
    can_manage_students BOOLEAN NOT NULL DEFAULT 0,
    can_view_aggregated_telemetry BOOLEAN NOT NULL DEFAULT 0,
    can_manage_billing BOOLEAN NOT NULL DEFAULT 0
);

-- 4. CHILD DEVICES TABLE (Tracks connected tablets/phones)
CREATE TABLE IF NOT EXISTS child_devices (
    device_id VARCHAR(128) PRIMARY KEY,
    parent_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
    device_model VARCHAR(128) NOT NULL DEFAULT 'Android Tablet',
    is_kiosk_active BOOLEAN NOT NULL DEFAULT 0,
    last_latitude REAL DEFAULT 0.0,
    last_longitude REAL DEFAULT 0.0,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. PAIRING CODES TABLE (Synchronizes child device with parent or classroom)
CREATE TABLE IF NOT EXISTS pairing_codes (
    code VARCHAR(16) PRIMARY KEY,
    device_id VARCHAR(128) NOT NULL,
    parent_id VARCHAR(64) DEFAULT NULL,
    organization_id VARCHAR(64) DEFAULT NULL,
    pairing_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- 6. ROUTINES TABLE (Organized by user, shift, and day of week)
CREATE TABLE IF NOT EXISTS routines (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
    shift_name VARCHAR(32) NOT NULL, -- 'MORNING', 'AFTERNOON', 'NIGHT'
    day_of_week VARCHAR(32) NOT NULL, -- 'MONDAY', 'TUESDAY', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, shift_name, day_of_week)
);

-- 7. TASKS TABLE (Individual visual schedule items)
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(64) PRIMARY KEY,
    routine_id VARCHAR(64) NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    activity_name VARCHAR(255) NOT NULL,
    keyword VARCHAR(128) NOT NULL,
    image_url TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. TASK EXECUTIONS TABLE (Tracks task completion and emotional feedback)
CREATE TABLE IF NOT EXISTS task_executions (
    id VARCHAR(64) PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    device_id VARCHAR(128) NOT NULL,
    day_of_week VARCHAR(32) NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT 1,
    emotion_rating VARCHAR(32) DEFAULT 'HAPPY', -- 'HAPPY', 'CALM', 'SAD', etc.
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. REINFORCEMENT MESSAGES TABLE (Positive reinforcement quotes)
CREATE TABLE IF NOT EXISTS reinforcement_messages (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_name VARCHAR(32) NOT NULL,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. NOTIFICATIONS TABLE (Alerts dispatched to parents or educators)
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    notification_type VARCHAR(32) NOT NULL DEFAULT 'INFO',
    is_read BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR MAXIMUM QUERY SPEED UNDER HIGH CONCURRENCY
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_parent ON child_devices(parent_id);
CREATE INDEX IF NOT EXISTS idx_routines_lookup ON routines(user_id, shift_name, day_of_week);
CREATE INDEX IF NOT EXISTS idx_tasks_routine ON tasks(routine_id);
CREATE INDEX IF NOT EXISTS idx_executions_task ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
