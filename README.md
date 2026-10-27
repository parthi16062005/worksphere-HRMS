# WorkSphere – HR Management System

## 1. Project Overview

WorkSphere is a Human Resource Management System (HRMS) developed using FastAPI for the backend and React for the frontend.

The application helps organizations manage employees, attendance, shifts, leave requests, payroll, documents, performance reviews, analytics, and notifications.

The system supports three user roles: EMPLOYEE, HR, and ADMIN.

## 2. Technologies Used

### Backend

* Python
* FastAPI
* SQLAlchemy
* SQLite
* JWT Authentication
* Pydantic

### Frontend

* React
* Vite
* JavaScript
* Axios
* Recharts

## 3. Project Modules

### Module 1: Authentication and Authorization

* User registration and login
* JWT-based authentication
* Role-based access control
* Employee, HR, and Admin roles
* Profile management

### Module 2: Employee Management

* Create employee records
* View employee details
* Update employee information
* Delete employee records
* Search employees
* Filter employees by department and employment status

### Module 3: Attendance Management

* Employee check-in and check-out
* Attendance status tracking
* Late-arrival detection
* Early-checkout detection
* Attendance history

### Module 4: Shift Management

* Create and manage shifts
* Assign shifts to employees
* Configure shift timings
* Automatic attendance processing

### Module 5: Leave Management

* Apply for leave
* Approve or reject leave requests
* Track leave request status
* Validate leave dates
* Prevent overlapping approved leave requests

### Module 6: Leave Policy and Balance

* Configure leave policies
* Set allowed leave days
* Track employee leave balances
* Deduct leave balance when leave is approved
* View remaining leave allowance

### Module 7: Leave Calendar and Team Availability

* Display approved leaves on a calendar
* View employee leave schedules
* Filter by department
* Check team availability

### Module 8: Payroll Management

* Generate employee payroll
* Calculate gross salary, deductions, and net salary
* Track payroll status
* Mark salary payments as completed
* View employee payroll history

### Module 9: Payroll Reports

* View payroll information
* Filter payroll records
* Review payroll details

### Module 10: Document Management

* Upload employee documents
* View document lists
* Download documents
* Restrict document access according to user permissions
* Allow authorized HR/Admin users to delete documents

### Module 11: Performance Management

* Create employee performance reviews
* Assign ratings from 1 to 5
* Record feedback
* View performance review history

### Module 12: Advanced Analytics and Reports

* Attendance analytics
* Leave statistics
* Performance insights
* Department-level summaries
* Date and department filters
* Charts and visual reports

### Module 13: Notifications and Alerts

* Attendance notifications
* Leave approval and rejection notifications
* Payroll notifications
* Unread notification count
* Mark individual notifications as read
* Mark all notifications as read
* Periodically refresh notification counts

### Module 14: Advanced Employee Search and Filters

* Search employees by name
* Filter by department
* Filter by employment status
* Filter by user role
* Filter by attendance status
* Filter by performance rating
* Reset all filters

## 4. User Roles

### EMPLOYEE

Employees can access permitted self-service features, including their own profile, attendance, leave requests, payroll history, documents, performance history, and notifications.

### HR

HR users can access employee management and other HR operations permitted by the application's authorization rules.

### ADMIN

Administrators can access administrative operations permitted by the application's authorization rules.

## 5. Project Folder Structure

```text
WorkSphere/
│
├── README.md
│
├── backend/
│   ├── main.py
│   ├── auth.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── routers/
│   ├── services/
│   ├── uploads/
│   └── .env
│
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   └── style/
    │
    ├── package.json
    └── vite.config.js
```

The exact folder contents may vary depending on the current project version.

## 6. Requirements

Install the following software before running the application:

* Python
* Node.js
* npm
* Visual Studio Code (recommended)

## 7. How to Run the Project

### Step 1: Start the Backend

Open a terminal and navigate to the backend folder:

```powershell
cd "$HOME\OneDrive\Desktop\WorkSphere\backend"
```

Activate your existing Python virtual environment if your project uses one:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies if `requirements.txt` exists:

```powershell
pip install -r requirements.txt
```

Start the FastAPI server:

```powershell
uvicorn main:app --reload
```

Backend URL:

http://127.0.0.1:8000

Swagger API documentation:

http://127.0.0.1:8000/docs

### Step 2: Start the Frontend

Open a second terminal:

```powershell
cd "$HOME\OneDrive\Desktop\WorkSphere\frontend"
```

Install frontend dependencies:

```powershell
npm install
```

Start the React application:

```powershell
npm run dev
```

Open the local URL shown in the terminal. It is commonly:

http://localhost:5173

## 8. API Endpoints

The application provides API endpoints for the following areas:

| Feature                | API route         |
| ---------------------- | ----------------- |
| Authentication         | `/auth`           |
| Employee Management    | `/employees`      |
| Attendance             | `/attendance`     |
| Leave Management       | `/leaves`         |
| Leave Policies         | `/leave-policies` |
| Leave Calendar         | `/leave-calendar` |
| Document Management    | `/documents`      |
| Performance Management | `/performance`    |
| Analytics              | `/analytics`      |
| Notifications          | `/notifications`  |
| Payroll                | `/payroll`        |

Open Swagger at `/docs` to see the complete registered endpoints and their parameters.

## 9. Security Features

* JWT-based authentication
* Role-based authorization
* Protected API endpoints
* Pydantic request validation
* Restricted access to employee documents
* Environment-based configuration for secrets

Before production deployment, configure a strong JWT secret, HTTPS, trusted CORS origins, secure document storage, and appropriate database backups.

## 10. Current Project Status

The project includes employee management, attendance and shift management, leave management and policies, leave calendar, payroll, document management, performance reviews, analytics, notifications, and advanced employee search and filters.

The implementation should be tested in the current repository before deployment or submission.

## 11. Conclusion

WorkSphere provides a centralized platform for HR operations and employee self-service. It combines a React frontend with a FastAPI backend and role-based access controls to organize common human resource management tasks.
