# INTERNAL HR TOOL
## Product Requirements Document

| Field | Value |
|---|---|
| Document Version | v1.0 |
| Date | June 2026 |
| Status | Draft — For Review |
| Owner | Product / Engineering Team |
| Target Org | Small Company — 10 to 20 employees |
| Modules in Scope | Employee Management, Attendance & Leave Tracking |
| Out of Scope (v1) | Payroll Processing, Tax & Compliance (TDS/PF/ESI) |

---

## 1. Executive Summary

This document defines the complete product requirements for an internal HR management tool targeted at small to mid-size companies. The system aims to replace fragmented spreadsheets and manual processes by providing a unified, role-based platform for employee lifecycle management and daily attendance & leave tracking.

The v1 scope covers two core modules: Employee Management and Attendance & Leave Tracking. Payroll and tax compliance are deliberately deferred to v2 to keep initial scope executable and reduce time-to-value.

---

## 2. Goals & Success Metrics

### 2.1 Business Goals

- Reduce HR administrative overhead by at least 40% within 3 months of deployment.
- Eliminate manual spreadsheet-based employee records and attendance registers.
- Provide a single source of truth for employee data accessible to HR, managers, and employees.
- Ensure compliance-ready data exports for future payroll and statutory integration (v2).

### 2.2 Success Metrics (KPIs)

| Metric | Baseline | Target (3 months) |
|---|---|---|
| Time to onboard a new employee | 1–2 days (manual) | < 30 minutes |
| Attendance record accuracy | ~70% (manual entry) | > 99% (system-tracked) |
| Leave approval turnaround | 2–3 days | < 4 hours |
| Employee self-service adoption | 0% | > 80% of workforce |
| HR ticket volume (admin queries) | Baseline TBD | Reduce by 50% |

---

## 3. Personas & Stakeholders

| Persona | Role | Primary Needs |
|---|---|---|
| Owner | Business owner with full visibility across all employees, reports, and settings. Receives executive dashboards and headcount summaries. | Full access to all modules, reports, audit logs, configurations, and headcount/absenteeism trends. |
| HR | Manages day-to-day HR operations: attendance oversight, leave approvals, team calendar, and employee data maintenance. | Team attendance view, leave approval queue, anomaly alerts, employee record management. |
| Employee | Day-to-day user: check-in/out, apply for leave, view attendance history. | Simple mobile-friendly UI, real-time leave balance, attendance history. |
| System Admin | Configures Supabase RLS policies, manages roles, OAuth settings, and data backups. | Role management, API access, audit trail, data export, Supabase dashboard access. |

---

## 4. Assumptions & Constraints

### 4.1 Assumptions

- Company size: 10–20 employees.
- Internet connectivity available at all offices; mobile internet available for field employees.
- Owner and at least one System Admin role are designated before go-live.
- Company uses a standard Mon–Sat or Mon–Fri workweek; custom shift support is a v2 feature.
- Biometric device integration is optional; IP-based or GPS-based check-in is sufficient for v1.

### 4.2 Constraints

- v1 must ship within 12 weeks of kickoff.
- No third-party payroll API in v1 (deferred).
- Must work on Chrome, Firefox, Safari (latest 2 versions); mobile responsive.
- Data must reside in Supabase's ap-south-1 (Mumbai) region for India data residency.
- All PII must be encrypted at rest and in transit.

---

## 5. Module 1 — Employee Management

### 5.1 Overview

The Employee Management module serves as the core master data layer of the system. It covers the complete employee lifecycle: onboarding, profile management, role and department structuring, document management, and offboarding.

### 5.2 Feature List

#### 5.2.1 Employee Onboarding

| Feature | Description | Priority |
|---|---|---|
| New Employee Form | Multi-step form: Personal Info, Job Details, Documents, Bank Details (masked). Auto-generates Employee ID. | P0 |
| Bulk Import | CSV/XLSX upload for batch onboarding. Validation errors shown inline with row references. | P1 |
| Onboarding Checklist | Configurable checklist (e.g., ID proof submitted, offer letter signed, system access granted). Tracked per employee. | P1 |
| Welcome Email | Automated welcome email with login credentials and onboarding checklist link upon profile creation. | P1 |
| Probation Period Tracking | Flag employees on probation with configurable end date. Alert HR 2 weeks before probation end. | P2 |

#### 5.2.2 Employee Profile

| Feature | Description | Priority |
|---|---|---|
| Personal Information | Name, DOB, gender, photo, emergency contact, address, personal email, phone. | P0 |
| Employment Details | Employee ID, designation, department, reporting HR, employment type (FTE/contractor/intern), joining date. | P0 |
| Documents Vault | Upload and store: Aadhar, PAN, offer letter, appointment letter, previous experience letters. Max 5 MB per file, PDF/JPG/PNG only. | P0 |
| Bank Details (Masked) | Account number (last 4 visible), IFSC, bank name. Editable only by Owner or self with HR approval. | P1 |
| Organizational Chart | Auto-generated org chart based on reporting HR field. Clickable nodes. | P2 |
| Activity Timeline | Audit log of profile changes: who changed what, when. | P1 |

#### 5.2.3 Department & Role Management

- Create, rename, deactivate departments and sub-departments (tree structure, max 3 levels).
- Define designations and map them to departments.
- Assign role-based access permissions (Owner, HR, Employee, System Admin) per user.
- Bulk reassignment of employees when a department is restructured.

#### 5.2.4 Employee Lifecycle Events

| Event | System Behavior | Priority |
|---|---|---|
| Promotion / Designation Change | New designation logged with effective date. Previous record preserved in history. | P0 |
| Department Transfer | HR reassignment, leave balance carry-over, team attendance re-mapped. | P0 |
| Salary Revision | Salary stored (v1: for record only; v2: feeds payroll). Revision history maintained. | P1 |
| Resignation / Offboarding | Exit date set, access revoked on that date, full-and-final data flagged for v2 payroll. | P0 |
| Termination | Immediate access revocation, reason recorded (HR only visible), documentation upload. | P0 |
| Rehire | Previous record linkable to new employee record. Leave balance reset or carried over (configurable). | P2 |

#### 5.2.5 Search, Filter & Export

- Global employee search by name, employee ID, department, designation, or manager.
- Filters: employment type, status (active/on leave/terminated), department, location.
- Export employee list to CSV or XLSX with configurable column selection.
- Export individual employee profile as PDF (including documents index).

### 5.3 Edge Cases — Employee Management

| Edge Case | Handling |
|---|---|
| Duplicate PAN / Aadhar on upload | Block save, show error: 'PAN already exists for Employee ID XXXX'. Allow override by Owner with justification log. |
| HR leaves the company | System detects orphaned reporting lines. HR prompted to reassign. Pending approvals escalated to Owner. |
| Employee with no department | Allowed (e.g., C-suite). All reports must handle null department gracefully. |
| Bulk import with partial failures | Successful rows committed. Failed rows returned in downloadable error CSV. No rollback on success rows. |
| Employee ID collision on re-hire | New unique Employee ID auto-generated. Old ID preserved in history field. |
| Photo upload > size limit | Client-side compression attempted. If still > 5 MB after compression, reject with message. |
| Date of Joining > Today | Allowed (future joiners). Profile visible only to Owner until join date. |

---

## 6. Module 2 — Attendance & Leave Tracking

### 6.1 Overview

The Attendance & Leave module handles daily time tracking, shift definitions, leave policy configuration, leave application workflows, and calendar management. It is the highest-frequency touchpoint for employees.

### 6.2 Attendance Tracking

#### 6.2.1 Check-In / Check-Out Methods

| Method | Description | Priority |
|---|---|---|
| Web Check-In | One-click button on dashboard. Timestamped server-side. Cannot be backdated by employee. | P0 |
| Mobile Check-In (GPS) | GPS coordinates captured on check-in/out. Office geofence configurable (radius in meters). Alert if outside geofence. | P1 |
| IP Whitelisting | Check-in restricted to approved office IP ranges. Configurable by System Admin. | P1 |
| Biometric Integration | Webhook receiver for biometric device data (ZKTeco or similar). Device pushes punch events; system reconciles. | P2 |
| Manual Entry (HR only) | Owner can enter/edit attendance for a past date with mandatory reason field. | P0 |

#### 6.2.2 Attendance Records

- Daily status: Present, Absent, Half-Day, Work From Home, On Leave, Holiday, Weekly Off.
- Overtime tracking: hours beyond standard shift auto-flagged. Approval by manager required to credit overtime.
- Late mark rules: configurable grace period (e.g., 15 min); beyond grace = Late; N late marks in a month = Half-Day deduction (configurable threshold).
- Regularization request: employee can request attendance correction for past N days (configurable). Requires manager approval.

#### 6.2.3 Shift Management

- Define named shifts: start time, end time, break duration, weekly off days.
- Assign default shift per department; override per employee.
- Shift rosters: assign weekly shift patterns. Swap requests between employees (P2).
- Night shift handling: check-out after midnight correctly attributed to the previous date.

### 6.3 Leave Management

#### 6.3.1 Leave Policy Configuration (Owner)

| Config Item | Options |
|---|---|
| Leave Types | Casual Leave (CL), Sick Leave (SL), Earned/Privileged Leave (EL/PL), Maternity/Paternity, Compensatory Off (Comp-off), Leave Without Pay (LWP). Custom types addable. |
| Accrual | Monthly accrual, yearly grant, or manual credit. Configurable per leave type. |
| Carry Forward | Max carry-forward days configurable per leave type. Expiry date for carried-forward leaves. |
| Encashment | Flag leave types as encashable (feeds v2 payroll). |
| Leave Calendar | National holidays (auto-seeded for India), state-specific holidays, company-specific holidays. Optional/restricted holidays configurable. |
| Negative Balance | Allow/disallow going negative per leave type. If allowed, deducted from earned leave or marked LWP. |

#### 6.3.2 Leave Application Flow

1. Employee submits leave application: leave type, date range, reason, optional attachment (medical certificate).
2. System validates: leave balance sufficient, no clashing approved leave, no holiday in range (weekends and holidays auto-excluded or configurable).
3. Notification sent to reporting HR via email and in-app.
4. HR approves / rejects / requests cancellation with optional comment.
5. Employee notified of decision. Leave balance updated on approval.
6. Cancellation: employee can cancel pending or approved (future) leave. Approved leave cancellation requires manager re-confirmation. Balance restored on confirmed cancellation.

#### 6.3.3 Leave Balance & History

- Employee self-service: real-time leave balance card per leave type.
- Leave history: all applications with status, approver name, rejection reason.
- HR view: team leave calendar (who is on leave on which day). Color-coded by leave type.
- Owner view: company-wide leave calendar, filterable by department.
- Leave lapse alerts: notify employee 30 and 7 days before carry-forward leaves expire.

#### 6.3.4 Compensatory Off

- Employee submits comp-off request after working on a holiday/weekly-off, linking the extra-work date.
- HR approves comp-off credit. System credits comp-off balance.
- Comp-off balance expires after configurable days (default: 60 days from credit date).

### 6.4 Edge Cases — Attendance & Leave

| Edge Case | Handling |
|---|---|
| Employee forgets to check out | Auto-checkout at configurable time (e.g., 11:59 PM). Status flagged 'Incomplete'. HR alerted daily. Employee prompted next morning. |
| Leave application spans a holiday | Holidays auto-excluded from leave count. System shows 'You are applying for X working days' before submission. |
| Half-day + leave on same day | Allowed: morning half-day present + afternoon leave, or vice versa. System computes 0.5 attendance + 0.5 leave deduction. |
| Leave balance = 0, employee applies | If negative balance disallowed: blocked with message. If allowed: marked LWP after confirmation prompt. |
| HR is on leave, leave request pending | Auto-escalated to Owner after configurable SLA (default: 2 business days). |
| Retroactive holiday addition | If holiday added for a date where employee was marked Present: no change. If Absent: auto-converts to Holiday (no LWP). HR prompted to review edge cases. |
| GPS spoofing attempt | If check-in coordinates change drastically mid-session (> X km), flag for HR review. Do not auto-reject. |
| Overlapping leave applications | Block: cannot apply for dates already covered by pending/approved leave. Must cancel first. |
| Employee transfers mid-month | Leave balance and attendance record carry over. Shift and reporting HR updated from transfer effective date. |

---

## 7. Key User Flows

### 7.1 Onboarding Flow (Owner)

1. Owner navigates to Employees > Add New Employee.
2. Fills Step 1 (Personal Info), Step 2 (Job Details including department, designation, manager), Step 3 (Document Upload), Step 4 (Bank Details — optional at onboarding).
3. System auto-generates Employee ID and validates for duplicates.
4. HR clicks 'Create & Send Invite'. System creates account, sends welcome email with temporary password.
5. Employee logs in, forced to change password. Onboarding checklist presented.

### 7.2 Daily Attendance Flow (Employee)

1. Employee opens app / web portal. Dashboard shows check-in button if not yet checked in.
2. Employee clicks 'Check In'. GPS/IP validation runs. Timestamp recorded.
3. Mid-day: employee can log 'Work From Home' status or mark break.
4. Employee clicks 'Check Out'. Total hours computed.
5. Next morning: if incomplete attendance, system shows regularization prompt.

### 7.3 Leave Application Flow (Employee)

1. Employee navigates to Leave > Apply Leave.
2. Selects leave type. Calendar shown with available dates (holidays greyed, existing leaves highlighted).
3. Selects date range. System shows leave count (working days only) and remaining balance.
4. Adds reason, uploads attachment if required (Sick Leave > 2 days).
5. Submits. Confirmation screen + email sent.
6. HR notified. HR approves/rejects. Employee notified via email and in-app notification.

### 7.4 HR — Team Attendance Review

1. HR opens Team Attendance view. Default: current month calendar.
2. Each team member row shows daily status colour-coded.
3. HR clicks a day to drill into individual attendance details.
4. HR can approve regularization requests and overtime from this view.
5. Export team attendance to CSV for the selected period.

---

## 8. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Page load < 2 seconds on 4G. Attendance check-in API response < 500 ms. Reports generation < 3 seconds for up to 20 employees. |
| Availability | 99.5% uptime SLA. Scheduled maintenance window: Sunday 2–4 AM IST. |
| Scalability | Support up to 50 employees without re-architecture in v1; designed to scale to 200+ with Supabase row-level security policies. DB queries optimized for this scale. |
| Security | AES-256 encryption at rest (Supabase default). TLS 1.2+ in transit. Supabase Row Level Security (RLS) for data isolation per role. Session timeout after 30 minutes of inactivity. Supabase Auth handles login lockout natively. |
| Data Privacy | PII (Aadhar, PAN, bank details) masked in UI and logs. Audit log for all PII access. DPDP Act (India) compliance. |
| Browser Support | Chrome 120+, Firefox 120+, Safari 17+. Mobile responsive (min 375px width). |
| Accessibility | WCAG 2.1 Level AA for primary flows (check-in, leave application). |
| Audit Trail | All create/update/delete actions logged: actor, timestamp, before/after values. Logs retained 3 years. |
| Backup | Daily automated backups. Point-in-time recovery up to 30 days. Backup stored in separate region. |

---

## 9. Roles & Permissions Matrix

| Feature | Owner | HR | Employee | System Admin |
|---|---|---|---|---|
| View all employee profiles | Yes | Team only | Self only | Yes |
| Create / edit employee profiles | Yes | No | No | No |
| Delete / archive employee | Yes | No | No | No |
| View team attendance | Yes | Yes (own team) | Self only | Yes |
| Edit past attendance (any) | Yes | No | No | No |
| Approve regularization | Yes | Yes (own team) | No | No |
| Configure leave policies | Yes | No | No | No |
| Apply for leave | Yes | Yes | Yes | No |
| Approve / reject leave | Yes | Yes (own team) | No | No |
| View leave balances (all) | Yes | Team only | Self only | Yes |
| Generate reports | Yes | Team reports | Self reports | Yes |
| Manage roles & permissions | Yes* | No | No | No |
| Export data | Yes | Team data | Self data | Yes |

*Owner can manage roles only if also assigned System Admin privilege.

---

## 10. Notification Design

| Trigger | Recipient | Channel | Priority |
|---|---|---|---|
| New employee created | Employee (welcome), Owner (confirmation) | Email | P0 |
| Leave application submitted | HR | Email + In-app | P0 |
| Leave approved / rejected | Employee | Email + In-app | P0 |
| Leave cancellation requested | HR | Email + In-app | P0 |
| Regularization request | HR | Email + In-app | P0 |
| Pending leave > 2 days (SLA breach) | Owner | Email | P1 |
| Incomplete attendance (forgot checkout) | Employee (next morning) | Email + In-app | P0 |
| Probation end approaching (14 days) | Owner | Email | P1 |
| Leave balance expiry (30 days & 7 days) | Employee | Email | P1 |
| Employee exit date approaching (7 days) | Owner, HR, System Admin | Email | P0 |

---

## 11. Reports & Analytics

| Report | Description | Format | Access |
|---|---|---|---|
| Monthly Attendance Summary | Per employee: present days, absent, leaves, overtime, late marks. | Table + CSV export | Owner, HR |
| Absenteeism Report | Employees with > N absences in a period. Configurable threshold. | Table | Owner |
| Leave Balance Report | All employees' leave balances per leave type as of today. | Table + CSV | Owner |
| Team Leave Calendar | Monthly calendar view of team's leave. | Calendar visual | HR, Owner |
| Headcount Report | Active, on probation, resigned, terminated — filterable by department/date. | Table + CSV | Owner, System Admin |
| Regularization Log | All regularization requests with approval status. | Table + CSV | Owner |
| Department Attendance Heatmap | Heatmap of attendance % across departments over a period. | Chart | Owner, Owner |

---

## 12. Recommended Tech Stack

| Layer | Recommendation | Rationale |
|---|---|---|
| Frontend | React + TypeScript + Tailwind CSS | Component reusability, type safety, rapid UI iteration. |
| Backend | Supabase (BaaS — no separate backend server) | Supabase provides database, auth, storage, and edge functions in one platform. Eliminates need for a separate API server for a 10–20 person team. |
| Database | Supabase PostgreSQL with Row Level Security (RLS) | Relational integrity for employee/leave data. RLS enforces role-based data access at the DB layer — Owner sees all rows, HR sees team rows, Employee sees own rows only. |
| Authentication | Supabase Auth | JWT-based, built-in. Supports email/password + Google OAuth. Session management handled natively. |
| File Storage | Supabase Storage | S3-compatible buckets with RLS policies. Presigned URLs for secure document access (Aadhar, PAN, offer letters). |
| Server-side Logic | Supabase Edge Functions (Deno / TypeScript) | Used for complex workflows: leave approval notifications, auto-checkout cron, bulk import validation. |
| Realtime / In-app Notifications | Supabase Realtime | WebSocket-based live updates for leave status changes, attendance flags. |
| Email Notifications | Resend or SendGrid (called from Edge Functions) | Transactional emails: leave approvals, onboarding welcome, alerts. |
| Hosting | Vercel (frontend) + Supabase Cloud (ap-south-1, Mumbai) | Vercel for fast global CDN; Supabase Mumbai region for India data residency compliance. |
| CI/CD | GitHub Actions | Automated linting, type checks, and Vercel preview deployments on PR. |

---

## 13. Release Milestones

Each milestone explicitly covers both the **admin/HR side** and the **employee self-service side**. These are the same routes rendered differently by role — not separate apps.

| Milestone | Admin / HR Side | Employee Self-Service Side | Target Week |
|---|---|---|---|
| M1 — Foundation | Auth (login, password reset), RBAC + role detection, Department/Role setup, Employee CRUD (P0 fields), sidebar shell with placeholder routes for all modules. | Login page, forced password change on first login, onboarding checklist view. | Week 3 |
| M2 — Employee Module | Full employee list (filterable), add/edit employee form (all steps), document vault, lifecycle events, bulk import, org chart, activity timeline, search + export. | My Profile page: view own details, upload own photo, request profile edit (HR approval required). View own documents. | Week 6 |
| M3 — Attendance Module | Team attendance calendar (colour-coded), manual attendance entry, regularization approvals, overtime approvals, shift management, late mark config. | Check-in / check-out button on dashboard, my monthly attendance view (colour-coded), regularization request form, incomplete attendance prompt. | Week 8 |
| M4 — Leave Module | Leave policy config, holiday calendar management, team leave calendar, leave approval / rejection queue, comp-off approvals, leave balance report. | Leave balance cards (per type), apply leave form (with live balance + working day count), my leave history, cancellation, comp-off request form. | Week 10 |
| M5 — Reports & Polish | All P0 reports (attendance summary, absenteeism, headcount, regularization log), all notifications wired (email + in-app), department attendance heatmap. | My attendance report (self export), my leave summary, in-app notification bell, mobile responsiveness, UAT. | Week 12 |
| v2 Planning | Payroll processing, TDS/PF/ESI compliance, biometric deep integration, shift rosters + swap requests, mobile native app. | Employee payslip view, salary revision history. | Post Week 12 |

---

## 14. Open Questions & Decisions Required

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Will the company use SSO (Google/Microsoft) or standalone auth? | IT Admin | Open |
| 2 | Which biometric device vendor is in use? (for v2 integration planning) | IT Admin | Open |
| 3 | Should leave encashment rules be configured now (for data capture) even if payroll is v2? | Owner | Open |
| 4 | Multi-location / multi-timezone support required in v1? | Product Owner | Open |
| 5 | Are shift rosters (weekly rotation schedules) in scope for v1 or v2? | Product Owner | Deferred to v2 |
| 6 | What is the data retention policy for ex-employee records? | Legal / Owner | Open |
| 7 | Should managers have access to subordinates' bank details? | Owner | Open — recommend: No |

---

## 15. Glossary

| Term | Definition |
|---|---|
| RBAC | Role-Based Access Control — permissions granted by role, not individually. |
| PII | Personally Identifiable Information — Aadhar, PAN, bank details, etc. |
| LWP | Leave Without Pay — absence deducted from salary. |
| CL / SL / EL | Casual Leave / Sick Leave / Earned (Privileged) Leave. |
| Comp-off | Compensatory Off — leave earned for working on holidays/weekends. |
| Regularization | Employee request to correct a past attendance record. |
| Geofence | Virtual geographic boundary; check-in restricted within this radius. |
| DPDP Act | Digital Personal Data Protection Act (India, 2023) — data privacy regulation. |
| P0 / P1 / P2 | Priority levels: P0 = Must-have (v1 launch blocker), P1 = Should-have, P2 = Nice-to-have. |

---

*Confidential — Internal Use Only*
