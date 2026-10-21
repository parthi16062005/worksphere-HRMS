# WorkSphere – HR Management System (HRMS)

A full-stack Human Resource Management System developed using **React, FastAPI, Python, and SQLite**. WorkSphere helps organizations manage employee information, attendance, leave requests, payroll processing, dashboards, and notifications through a centralized platform.

## Project Overview

WorkSphere is designed to simplify HR operations and provide secure, role-based access to employees, HR personnel, and administrators.

The application includes employee management, attendance tracking, leave management, payroll processing, analytics, and a notification system.

## Key Features

### 1. User Authentication and Role Management

* User registration and login.
* JWT-based authentication.
* Password hashing.
* Role-based access control.
* Support for EMPLOYEE, HR, and ADMIN roles.
* Protected backend endpoints.

### 2. Employee Management

* Create employee records.
* View employee information.
* Update employee details.
* Manage employee designation and department.
* Track joining dates, salaries, and employment status.
* Restrict employee management to authorized roles.

### 3. Attendance Management

* Employee check-in and check-out.
* Attendance history.
* Working-hours calculation.
* Attendance status tracking.
* Attendance notifications.

### 4. Leave Management

* Submit leave requests.
* Support for sick, casual, and paid leave.
* View leave request history.
* Approve or reject leave requests.
* Record review comments and approval details.
* Send notifications when leave requests are approved or rejected.

### 5. Payroll Management

* Generate monthly payroll records.
* Calculate gross salary and deductions.
* Calculate net salary.
* Track payroll payment status.
* Record payment dates.
* Notify employees when payroll is generated or marked as paid.

### 6. Dashboard and Analytics

* Employee statistics.
* Attendance summaries.
* Leave statistics.
* Payroll overview.
* KPI cards and charts.
* Payroll reports.

### 7. Notification System

* Display notifications for the logged-in user.
* Show unread notification counts.
* Mark individual notifications as read.
* Mark all notifications as read.
* Generate notifications for attendance, leave, and payroll events.
* Automatically refresh the sidebar unread count periodically.

## Technology Stack

### Frontend

* React
* Vite
* JavaScript
* HTML5
* CSS3
* Axios
* Recharts (for dashboard charts)

### Backend

* Python
* FastAPI
* SQLAlchemy
* Pydantic
* JWT authentication
* Password hashing

### Database

* SQLite

### Development Tools

* Visual Studio Code
* Node.js and npm
* Python and pip
* Git (optional)

## Project Structure

```text
WorkSphere/
│
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   ├── auth.py
│   ├── .env
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   └── Footer.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Employees.jsx
│   │   │   ├── Attendance.jsx
│   │   │   ├── Leaves.jsx
│   │   │   ├── Payroll.jsx
│   │   │   └── Notifications.jsx
│   │   │
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── employeeService.js
│   │   │   └── notificationService.js
│   │   │
│   │   ├── style/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── ...
│
└── README.md
```

*Note: The structure above is representative. Some filenames and folders may differ in your actual project.*

## Prerequisites

Install the following before running the application:

* Python 3.10 or later, compatible with your dependencies.
* Node.js and npm.
* Visual Studio Code or another code editor.

## Installation and Setup

### 1. Clone the Repository

If the project is hosted on GitHub:

```bash
git clone <your-repository-url>
cd WorkSphere
```

Alternatively, open your existing WorkSphere project folder directly.

### 2. Set Up the Backend

Open a terminal and navigate to the backend directory:

```powershell
cd backend
```

Create a virtual environment:

```powershell
python -m venv venv
```

Activate the virtual environment in Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```powershell
python -m pip install -r requirements.txt
```

Configure the required environment variables in your backend `.env` file.

Example:

```env
SECRET_KEY=replace_with_a_secure_random_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Use the actual variable names expected by your application. Generate a strong secret for your environment and never commit real credentials to Git.

### 3. Start the Backend Server

From the backend directory, run:

```powershell
uvicorn main:app --reload
```

The backend should be available at:

**API Base URL:** http://127.0.0.1:8000

**Swagger API Documentation:** http://127.0.0.1:8000/docs

**ReDoc Documentation:** http://127.0.0.1:8000/redoc

These documentation pages allow you to inspect and test the available API endpoints.

### 4. Set Up the Frontend

Open a second terminal and navigate to the frontend directory:

```powershell
cd frontend
```

Install the frontend dependencies:

```powershell
npm install
```

### 5. Start the Frontend Server

Run:

```powershell
npm run dev
```

Open the application in your browser:

**Frontend URL:** http://localhost:5173

Keep both the backend and frontend servers running while using the application.

## Database

WorkSphere uses SQLite with SQLAlchemy to store application data.

The main database entities include:

* Users
* Employees
* Attendance
* Leaves
* Payroll
* Notifications

The database stores employee records, attendance information, leave requests, salary records, and notifications.

The actual database filename and initialization behavior depend on the backend configuration.

## User Roles

### EMPLOYEE

* Access personal information.
* View attendance records.
* Submit leave requests.
* View permitted payroll information.
* Receive and manage personal notifications.

### HR

* Manage employee records.
* Review and process leave requests.
* Manage attendance and payroll according to permissions.
* Access HR dashboards and reports.
* Review relevant operational information.

### ADMIN

* Access administrative functionality.
* Manage employees and other authorized resources.
* Access dashboards and reports.
* Perform authorized HR operations.

Access to sensitive operations is enforced by backend authorization rules, not just frontend navigation.

## Security Features

The application includes the following security mechanisms:

* JWT-based authentication.
* Role-based authorization.
* Password hashing.
* Request validation using Pydantic.
* Environment-based configuration for secrets.
* User-specific notification access.
* Backend authorization for protected operations.

For production deployment, additional measures should include HTTPS, secure token handling, restricted CORS origins, database backups, logging, and comprehensive security testing.

## Testing

Test the following workflows before submitting or deploying the application.

### Authentication

* Register an account.
* Log in with valid credentials.
* Reject invalid credentials.
* Verify role-based access.

### Employee Management

* Create an employee.
* View employee records.
* Update employee information.
* Verify unauthorized users cannot manage employees.

### Attendance

* Record check-in.
* Record check-out.
* Verify working-hours calculation.
* View attendance history.

### Leave Management

* Submit a leave request.
* Approve a request as HR or ADMIN.
* Reject a request as HR or ADMIN.
* Verify notification creation.

### Payroll

* Generate monthly payroll.
* Verify salary calculations.
* Prevent duplicate payroll records for the same employee and month.
* Mark payroll as paid.
* Verify payroll notifications.

### Dashboard

* Verify KPI values.
* Check attendance and leave summaries.
* Review payroll statistics and reports.

### Notifications

* View notifications.
* Check the unread count.
* Mark a notification as read.
* Mark all notifications as read.
* Verify the sidebar count updates.
* Verify users cannot access other users' notifications.

## Future Enhancements

Potential future improvements include:

* Payslip PDF generation.
* Employee document management.
* Email notifications.
* Advanced attendance reports.
* Department-level analytics.
* Automated payroll scheduling.
* Comprehensive automated tests.
* Production deployment and monitoring.

These are possible future enhancements and are not claimed as completed features.

## Project Objective

The objective of WorkSphere is to demonstrate full-stack application development, REST API design, database management, authentication, role-based authorization, HR workflows, and data-driven dashboards.

The project provides practical experience in developing an enterprise-style HR management application using modern frontend and backend technologies.

## Conclusion

WorkSphere centralizes essential HR operations in one application. It provides employee management, attendance tracking, leave processing, payroll management, analytics, and notifications through a React frontend and FastAPI backend.

**Project:** WorkSphere – HR Management System
**Architecture:** Full-stack web application
**Frontend:** React + Vite
**Backend:** FastAPI + Python
**Database:** SQLite
**API Documentation:** FastAPI Swagger UI

---
