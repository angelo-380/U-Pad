# U-Pad Cloud Platform Architecture & Database Documentation
**Target Cloud:** Google Cloud Platform (GCP)  
**Milestone:** 25% Deliverable  
**All Technical Identifiers & Documentation:** 100% English  

---

## 1. Editable Relational Database Diagram (Mermaid ER)

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : enrolls
    ORGANIZATIONS ||--o{ CHILD_DEVICES : owns
    ORGANIZATIONS ||--o{ ROUTINES : provisions
    USERS ||--o{ CHILD_DEVICES : pairs
    USERS ||--o{ ROUTINES : creates
    USERS ||--o{ NOTIFICATIONS : receives
    ROUTINES ||--|{ TASKS : contains
    TASKS ||--o{ TASK_EXECUTIONS : records

    ORGANIZATIONS {
        string id PK
        string name
        string domain
        string subscription_plan
        int allocated_seats
        timestamp created_at
    }

    USERS {
        string id PK
        string email UK
        string password_hash
        string password_salt
        string full_name
        string role
        string organization_id FK
        boolean is_premium
        string language_code
    }

    IAM_ROLE_PERMISSIONS {
        string role PK
        boolean can_manage_infrastructure
        boolean can_manage_database_schema
        boolean can_manage_organization
        boolean can_manage_educators
        boolean can_manage_students
        boolean can_view_aggregated_telemetry
        boolean can_manage_billing
    }

    CHILD_DEVICES {
        string device_id PK
        string parent_id FK
        string organization_id FK
        string device_model
        boolean is_kiosk_active
        real last_latitude
        real last_longitude
        timestamp last_seen_at
    }

    PAIRING_CODES {
        string code PK
        string device_id
        string parent_id
        string pairing_status
        timestamp expires_at
    }

    ROUTINES {
        string id PK
        string user_id FK
        string shift_name
        string day_of_week
        timestamp created_at
    }

    TASKS {
        string id PK
        string routine_id FK
        string activity_name
        string keyword
        string image_url
        int duration_minutes
        int sort_order
    }

    TASK_EXECUTIONS {
        string id PK
        string task_id FK
        string device_id
        string day_of_week
        boolean is_completed
        string emotion_rating
        timestamp completed_at
    }

    NOTIFICATIONS {
        string id PK
        string user_id FK
        string title
        string description
        string notification_type
        boolean is_read
        timestamp created_at
    }
```

---

## 2. B2B IAM Role Hierarchy & Security Boundaries
*Principle of Least Privilege (PoLP)*

| Role | Scope | Cloud Infra Control | DB DDL / Alter Schema | School / Clinic Users | KMS Master Keys |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **`DEVELOPER`** | Global Cloud Root | **YES (100%)** | **YES (100%)** | **YES** | **YES (Full Access)** |
| **`ORG_ADMIN`** | B2B School / Clinic | **NO (0%)** | **NO (0%)** | **YES (Tenant only)**| **NO (0%)** |
| **`EDUCATOR`** | Assigned Classroom | **NO (0%)** | **NO (0%)** | **Assigned students**| **NO (0%)** |
| **`PARENT`** | Household Unit | **NO (0%)** | **NO (0%)** | **Own child only** | **NO (0%)** |

> [!IMPORTANT]
> The **`ORG_ADMIN`** role is strictly bounded to the organizational tenant layer. It has **0% infrastructure permissions** in Google Cloud Console. Only the **`DEVELOPER`** role possesses 100% control over deployment pipelines, VPC, and Cloud KMS master keys.

---

## 3. Cryptography & Security Architecture

### A. Password Security Standard
1. **Validation Policy:**
   - Minimum length: 8 characters.
   - At least 1 uppercase letter (`[A-Z]`).
   - At least 1 numeric digit (`[0-9]`).
   - At least 1 special character (`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]`).
   - Common sequences (e.g., `12345678`, `password`) are automatically blocked.
2. **Cryptographic One-Way Hashing:**
   - Symmetrical encryption is avoided for passwords because keys can be intercepted or decrypted.
   - Hashing is implemented with **PBKDF2** (Password-Based Key Derivation Function 2) using **100,000 SHA-512 iterations**.
   - Unique 16-byte random salt per user (`crypto.randomBytes(16)`).
   - Server-side **Pepper Key** protected by **Google Cloud KMS** & **Google Secret Manager**.

### B. Google Cloud Services Mapping (AWS vs GCP)

| Requirement | AWS Service | Google Cloud Platform (GCP) Equivalent | Purpose in U-Pad |
| :--- | :--- | :--- | :--- |
| **Monitoring & Alarms** | AWS CloudWatch | **Google Cloud Monitoring** | CPU, latency, socket metrics, uptime probes |
| **Centralized Logging** | CloudWatch Logs | **Google Cloud Logging** | Structured JSON logs with severity levels |
| **Key Management** | AWS KMS | **Google Cloud KMS** | Master encryption keys for pepper & credentials |
| **Secret Storage** | AWS Secrets Manager| **Google Secret Manager** | Secure storage for API secrets & environment tokens |
| **Data Analysis (Local)** | *N/A (Library)* | *Pandas (Python Library)* | *Note: Pandas is an in-memory data science library, NOT a cloud service.* |

---

## 4. Debouncing & Rate Limiting Protection

1. **Client-Side (Android Compose):**
   - Implemented via `rememberDebouncedClick` (`app/src/main/java/com/example/upad/utils/SecurityAndDebounceUtils.kt`) with a 900ms - 1200ms throttle.
   - Disables button interactions while `isLoading = true`.
   - ViewModel-level mutex gate in `RoutineViewModel.kt` `saveAll`.
2. **Server-Side (`cloud/server.js`):**
   - Action fingerprinting: If a user sends duplicate POST/PUT requests within 1200ms, the server drops the duplicate with `HTTP 429 Too Many Requests`.
   - Sliding window limiter: Maximum 120 requests per minute per IP.

---

## 5. Standardized HTTP Response Envelope

All API endpoints produce uniform JSON structures:
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Routine and tasks successfully synchronized.",
  "data": { ... },
  "error": null,
  "timestamp": 1792974433922
}
```

* **404 Route Not Found:** Returns standard JSON for REST clients and a styled HTML page for web browser requests.
* **501 Under Development:** Returns structured milestone notification for unreleased features targeted for the 80% deliverable.
