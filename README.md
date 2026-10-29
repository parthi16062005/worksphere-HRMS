# WorkSphere — HR Management System

WorkSphere is a web-based Human Resource Management System (HRMS) developed using React, FastAPI, and SQLite. It provides a centralized platform for managing employee information, attendance, leave, payroll, notifications, documents, performance, and other HR operations.

## Technology Stack

- Frontend: React.js, Vite, JavaScript, HTML5, CSS3
- Backend: Python, FastAPI
- Database: SQLite
- ORM: SQLAlchemy
- Authentication: JWT
- API Communication: Axios
- Charts: Recharts
- Development Tools: Visual Studio Code, Swagger UI, Node.js, npm, Git

## User Roles

### Employee
- View and update personal profile details.
- View attendance records.
- Check in and check out.
- Apply for leave.
- View leave balances.
- View payroll information.
- Receive notifications.
- View assigned tasks.
- Submit feedback.
- Manage notification preferences.

### HR
- Manage employee information.
- Review leave applications.
- Manage leave policies.
- Manage attendance and payroll workflows.
- Review employee feedback.
- Manage supported HR operations.
- Access HR dashboards and reports.

### Admin
- Access administrative dashboards.
- Manage supported system operations.
- Access authorized employee and HR information.
- View system-wide statistics.
- Perform administrative operations according to permissions.

# MODULES 1–27

## Module 1: Authentication and Authorization
- User registration and login.
- JWT-based authentication.
- Password hashing.
- Current-user identification.
- Role-based access control.

## Module 2: Employee Management
- Employee profile management.
- Employee records.
- Employee and user account association.
- Role-based employee data access.

## Module 3: Attendance Management
- Employee check-in and check-out.
- Attendance records.
- Attendance history.
- Working-time tracking.

## Module 4: Shift Management
- Work shift management.
- Employee shift assignments.
- Shift scheduling.
- Support for shift-based attendance workflows.

## Module 5: Leave Management
- Leave application.
- Leave request history.
- Leave approval and rejection.
- Leave status tracking.
- Leave conflict validation.

## Module 6: Leave Policy and Balance Management
- Leave policy configuration.
- Sick, Casual, and Paid Leave policies.
- Employee leave balances.
- Remaining leave validation.
- Leave balance deduction after approval.

## Module 7: Leave Calendar and Team Availability
- Calendar-based leave visualization.
- Leave date tracking.
- Team availability overview.
- Leave schedule visibility.

## Module 8: Payroll Management
- Employee payroll records.
- Payroll information management.
- Employee payroll access.
- HR/Admin payroll workflows.

## Module 9: Payroll Reports
- Payroll summaries.
- Payroll reporting.
- Payroll information review.
- Authorized HR and Admin reporting.

## Module 10: Document Management
- Employee document management.
- Document-related workflows.
- Controlled document access.
- Upload and download capabilities where implemented.

## Module 11: Performance Management
- Employee performance tracking.
- Performance review records.
- Employee ratings.
- Feedback and review history where implemented.

## Module 12: Advanced Analytics and Reports
- HR dashboard statistics.
- Employee statistics.
- Attendance analytics.
- Leave analytics.
- Payroll insights.
- Charts and graphical reports.

## Module 13: Notifications and Alerts
- In-app notifications.
- Unread notification count.
- Mark individual notifications as read.
- Mark all notifications as read.
- Notifications for supported HR events.

## Module 14: Automated Attendance and Shift Management
- Attendance schedule rules.
- Late check-in tracking.
- Early check-out tracking.
- Shift-related attendance management.
- Working schedule support.

## Module 15: Leave Calendar and Team View
- Team leave calendar.
- Leave period visualization.
- Team availability tracking.
- Leave schedule overview.

## Module 16: Document Management System
- Employee document workflows.
- Document access management.
- Document organization.
- File upload and download support where implemented.

## Module 17: Performance Management System
- Employee performance records.
- Performance evaluations.
- Review tracking.
- Employee feedback support.

## Module 18: Advanced Analytics and Reports
- Employee analytics.
- Attendance reports.
- Leave reports.
- Payroll insights.
- Graphical data visualization.

## Module 19: Smart Notifications and Alerts
- Attendance notifications.
- Leave approval notifications.
- Leave rejection notifications.
- Payroll notifications.
- Other supported HR event notifications.

## Module 20: Advanced Employee Search and Filters
- Employee search.
- Employee list filtering.
- Search by supported employee attributes.
- Employee record navigation.

## Module 21: Employee Onboarding
- Employee onboarding workflow.
- Onboarding checklist.
- Onboarding task tracking.
- Progress monitoring where implemented.

## Module 22: Resignation and Exit Management
- Employee resignation workflow.
- Resignation information tracking.
- Exit process management.
- Resignation status tracking where implemented.

## Module 23: Internal Announcements
- Company announcements.
- Internal communication.
- Employee announcement viewing.
- Announcement management where implemented.

## Module 24: Task Assignment and Tracking
- Task creation and assignment.
- Employee task viewing.
- Task status updates.
- Task tracking.
- Role-based task management.

## Module 25: Calendar Integration Using ICS Files
- Generate downloadable calendar files in ICS format.
- Import supported WorkSphere events into compatible calendar applications.
- Provide calendar-based event access.
- Support calendar file downloads.

Note: Downloadable ICS files provide calendar export functionality. Direct Google Calendar API synchronization requires separate integration.

## Module 26: Employee Feedback Management
- Employee feedback submission.
- Feedback categories.
- Feedback ratings.
- Feedback history.
- HR/Admin feedback review where implemented.

## Module 27: Profile and Settings Management
- Update username.
- Update email address.
- Change password.
- Validate the current password.
- Configure attendance notification preferences.
- Configure leave notification preferences.
- Configure payroll notification preferences.
- Configure task notification preferences.
- Configure announcement notification preferences.
- Configure email notification preferences.
- Save notification preferences in the database.
- Responsive profile settings interface.

Note: Notification preferences are stored in the database. Automatically filtering notifications and delivering emails requires connecting these settings to the notification-generation and email-delivery services.

# PROJECT STRUCTURE

The following is a representative structure. Actual filenames may differ in the current project.

    WorkSphere/
    ├── README.md
    ├── backend/
    │   ├── main.py
    │   ├── auth.py
    │   ├── database.py
    │   ├── models.py
    │   ├── schemas.py
    │   ├── routers/
    │   │   ├── __init__.py
    │   │   ├── auth_router.py
    │   │   ├── employee_router.py
    │   │   ├── attendance_router.py
    │   │   ├── leave_router.py
    │   │   ├── payroll_router.py
    │   │   ├── notification_router.py
    │   │   └── other_router_files.py
    │   ├── requirements.txt
    │   ├── .env
    │   └── worksphere.db
    └── frontend/
        ├── src/
        │   ├── components/
        │   ├── pages/
        │   ├── services/
        │   │   └── api.js
        │   ├── style/
        │   ├── App.jsx
        │   └── main.jsx
        ├── package.json
        └── vite.config.js

# INSTALLATION AND SETUP

## Prerequisites
- Python
- Node.js
- npm
- Visual Studio Code

## Step 1: Start the Backend

Open a terminal and run:

    cd "$HOME\OneDrive\Desktop\WorkSphere\backend"

Activate the existing virtual environment if your project uses one:

    .\venv\Scripts\Activate.ps1

Install dependencies:

    pip install -r requirements.txt

Start the FastAPI server:

    uvicorn main:app --reload

Backend URL:

    http://127.0.0.1:8000

Swagger API documentation:

    http://127.0.0.1:8000/docs

## Step 2: Start the Frontend

Open a second terminal and run:

    cd "$HOME\OneDrive\Desktop\WorkSphere\frontend"

Install dependencies:

    npm install

Start the frontend:

    npm run dev

Open the local URL displayed by Vite, typically:

    http://localhost:5173

Keep both the backend and frontend servers running while using the application.

If the project is stored in a different directory, adjust the commands accordingly.

# API CONFIGURATION

The frontend communicates with FastAPI through Axios.

Backend base URL:

    http://127.0.0.1:8000

Frontend development URL:

    http://localhost:5173

Browser local storage keys:

    worksphere_token
    worksphere_user

The Axios service attaches the authentication token to supported requests. The backend must allow the frontend origin through its CORS configuration.

# DATABASE

The application uses SQLAlchemy models and SQLite for local development.

Known database entities include:

- User
- Employee
- Attendance
- Leave
- LeavePolicy
- LeaveBalance
- Payroll
- Notification
- NotificationPreference
- Task

Additional entities may exist depending on the implemented modules.

The application initializes database tables during startup through SQLAlchemy metadata creation.

# SECURITY

- Keep JWT secrets in environment variables.
- Never commit real passwords or secret keys to a public repository.
- Use strong passwords.
- Validate authorization in the backend.
- Protect employee and payroll information.
- Back up the database before schema changes.
- Validate uploaded files if document uploads are enabled.
- Use HTTPS and production-grade settings before deployment.
- Connect notification preferences to notification generation before claiming they suppress notifications.
- Configure an email service before claiming email delivery is available.

# TESTING

Test the application using Employee, HR, and Admin accounts.

1. Register and log in.
2. Verify role-based access.
3. Update profile details.
4. Change the account password.
5. Check in and check out.
6. Apply for leave.
7. Review leave requests as HR or Admin.
8. Verify leave balance updates.
9. View payroll information.
10. Test notifications.
11. Test task assignment and status updates.
12. Test onboarding and feedback workflows.
13. Save notification preferences and refresh the page.
14. Verify that employees cannot access other employees' private records.
15. Test implemented modules through the frontend and Swagger.

# FUTURE ENHANCEMENTS

Potential improvements include:

- Email notification delivery.
- Notification preference enforcement.
- Direct Google Calendar API integration.
- Advanced analytics and exportable reports.
- Automated scheduled reminders.
- Additional security and audit logging.
- Automated unit and integration tests.
- Production deployment.

# CONCLUSION

WorkSphere is designed to centralize HR workflows in a single application using React, FastAPI, and SQLite.

Its 27-module roadmap covers authentication, employee management, attendance, leave, payroll, reporting, notifications, productivity, feedback, and personal settings.

The implementation status of each feature should be verified against the current source code and API before release or deployment.