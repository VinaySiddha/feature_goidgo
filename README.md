# Student ID Card Portal

A full-stack web application for student data collection, ID card management, and admin reporting — built for educational institutions.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js Server Actions, MySQL (mysql2)
- **Auth:** AES-256-GCM encrypted httpOnly session cookies
- **Export:** XLSX, jsPDF, html2canvas, JSZip
- **UI:** Glassmorphism design, responsive, mobile-first

## Features

- Role-based access control (Admin, Faculty Admin, Faculty)
- Student registration with photo upload and crop tool
- Bulk Excel import with validation and duplicate detection
- Export student data to CSV, XLSX, PDF, and ZIP
- Draft system for saving work-in-progress records
- College branding — logo, signature, and ID card template configuration
- Full audit trail with before/after snapshots for students, users, and colleges
- Login history and activity logs
- Soft deletes with restore capability
- Auto-logout after 15 minutes of inactivity
- Public contact inquiry and callback request forms

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8+

### Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
SESSION_SECRET=your_secret_key
```

3. Run database migrations by visiting `/api/setup-audit` after starting the server (first run only).

4. Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Roles & Access

| Role | Access |
|---|---|
| `admin` | Full system access — all colleges, all users, audit logs, masters |
| `faculty_admin` | Own college — students, faculty management, institute settings |
| `faculty` | Own college — add, edit, delete, and draft students |

Admin credentials are configured during setup. Contact your system administrator for access.

## Routes

### Public
- `/` — Marketing homepage with contact and callback request forms
- `/login` — Login with role-based redirect

### Faculty
- `/faculty/dashboard` — Student list with search, filter, edit, delete
- `/faculty/register` — Single student registration and bulk Excel import

### Faculty Admin
- `/faculty-admin/dashboard` — College-wide student analytics
- `/faculty-admin/register` — Student registration
- `/faculty-admin/faculty` — Manage faculty users for the college
- `/faculty-admin/institute-settings` — Upload logo/signature, select ID card template, set student count

### Admin
- `/admin/dashboard` — System-wide dashboard, all students, restore deleted records
- `/admin/institutes` — College management (create, edit, delete, restore)
- `/admin/users` — User management (create, edit, delete, restore)
- `/admin/logs` — Audit trail viewer with CSV export
- `/admin/masters/id-card-type` — ID card template management

## Project Structure

```
app/               Next.js App Router pages and layouts
components/        Shared UI components (table, modals, auth provider, etc.)
lib/
  services/        Server actions for auth, students, colleges, users, audit, etc.
  utils/           Server helpers, audit helpers, date formatting
  types.ts         TypeScript interfaces
  db.ts            MySQL connection pool
hooks/             Custom React hooks (e.g., inactivity logout)
```

## Database

The schema includes the following tables:

- `colleges`, `users`, `students` — core records
- `student_drafts` — draft/work-in-progress student entries
- `college_assets` — logo, signature, ID card type per college
- `id_card_types` — ID card design templates
- `contact_inquiries`, `callback_requests` — public form submissions
- `audit_logs`, `login_history`, `student_audit`, `user_audit`, `college_audit` — compliance and audit

All tables support soft deletes and IST timestamps. Audit tables capture before/after JSON snapshots via database triggers.

## Notes

- Student photos are stored as base64 BLOBs in the database.
- Sessions expire after 10 hours; clients are logged out after 15 minutes of inactivity.
- See `DATABASE.md` for the full schema and `AUTH_SECURITY.md` for the security architecture.
