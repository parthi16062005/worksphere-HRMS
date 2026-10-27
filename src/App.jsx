
import { useState } from "react";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Leaves from "./pages/Leaves";
import LeaveCalendar from "./pages/LeaveCalendar";
import Payroll from "./pages/Payroll";
import PayrollReports from "./pages/PayrollReports";
import Notifications from "./pages/Notifications";
import ShiftManagement from "./pages/ShiftManagement";
import Documents from "./pages/Documents";
import Performance from "./pages/Performance";
import Analytics from "./pages/Analytics";

import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";

import "./style/Global.css";
import "./App.css";


function App() {

    // ==========================================
    // USER STATE
    // ==========================================

    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem(
            "worksphere_user"
        );

        try {
            return savedUser
                ? JSON.parse(savedUser)
                : null;
        } catch {
            localStorage.removeItem(
                "worksphere_user"
            );

            localStorage.removeItem(
                "worksphere_token"
            );

            return null;
        }
    });


    // ==========================================
    // CURRENT PAGE
    // ==========================================

    const [currentPage, setCurrentPage] = useState(
        "dashboard"
    );


    // ==========================================
    // LOGIN
    // ==========================================

    const handleLogin = (loggedInUser) => {
        setUser(loggedInUser);
        setCurrentPage("dashboard");
    };


    // ==========================================
    // LOGOUT
    // ==========================================

    const handleLogout = () => {
        localStorage.removeItem(
            "worksphere_token"
        );

        localStorage.removeItem(
            "worksphere_user"
        );

        setUser(null);
        setCurrentPage("dashboard");
    };


    // ==========================================
    // PROFILE UPDATE
    // ==========================================

    const handleProfileUpdated = (updatedUser) => {
        setUser(updatedUser);

        localStorage.setItem(
            "worksphere_user",
            JSON.stringify(updatedUser)
        );
    };


    // ==========================================
    // PAGE NAVIGATION
    // ==========================================

    const handleNavigate = (page) => {
        const role = String(
            user?.role || ""
        ).toUpperCase();

        // Pages restricted to HR and Admin.
        const restrictedPages = [
            "employees",
            "payroll-reports",
        ];

        if (
            restrictedPages.includes(page) &&
            role !== "ADMIN" &&
            role !== "HR"
        ) {
            setCurrentPage("dashboard");
            return;
        }

        setCurrentPage(page);
    };


    // ==========================================
    // LOGIN SCREEN
    // ==========================================

    if (!user) {
        return (
            <Login
                onLogin={handleLogin}
            />
        );
    }


    // ==========================================
    // USER ROLE
    // ==========================================

    const role = String(
        user.role || ""
    ).toUpperCase();

    const isAdminOrHR =
        role === "ADMIN" ||
        role === "HR";


    // ==========================================
    // RENDER PAGE
    // ==========================================

    const renderPage = () => {
        switch (currentPage) {

            // ----------------------------------
            // DASHBOARD
            // ----------------------------------

            case "dashboard":
                return (
                    <Dashboard
                        user={user}
                        onNavigate={handleNavigate}
                    />
                );


            // ----------------------------------
            // EMPLOYEES
            // ----------------------------------

            case "employees":
                return isAdminOrHR ? (
                    <Employees
                        user={user}
                    />
                ) : (
                    <Dashboard
                        user={user}
                        onNavigate={handleNavigate}
                    />
                );


            // ----------------------------------
            // PROFILE
            // ----------------------------------

            case "profile":
                return (
                    <Profile
                        user={user}
                        onProfileUpdated={
                            handleProfileUpdated
                        }
                    />
                );


            // ----------------------------------
            // ATTENDANCE
            // ----------------------------------

            case "attendance":
                return (
                    <Attendance
                        user={user}
                    />
                );


            // ----------------------------------
            // LEAVE MANAGEMENT
            // ----------------------------------

            case "leaves":
                return (
                    <Leaves
                        user={user}
                    />
                );


            // ----------------------------------
            // MODULE 15: LEAVE CALENDAR
            // ----------------------------------

            case "leave-calendar":
                return (
                    <LeaveCalendar />
                );


            // ----------------------------------
            // PAYROLL
            // ----------------------------------

            case "payroll":
                return (
                    <Payroll
                        user={user}
                    />
                );


            // ----------------------------------
            // NOTIFICATIONS
            // ----------------------------------

            case "notifications":
                return (
                    <Notifications />
                );


            // ----------------------------------
            // PAYROLL REPORTS
            // ----------------------------------

            case "payroll-reports":
                return isAdminOrHR ? (
                    <PayrollReports
                        user={user}
                    />
                ) : (
                    <Dashboard
                        user={user}
                        onNavigate={handleNavigate}
                    />
                );


            // ----------------------------------
            // MODULE 14: SHIFT MANAGEMENT
            // ----------------------------------

            case "shifts":
                return (
                    <ShiftManagement
                        user={user}
                    />
                );


            // ----------------------------------
            // MODULE 16: DOCUMENT MANAGEMENT
            // ----------------------------------

            case "documents":
                return (
                    <Documents
                        user={user}
                    />
                );

            // MODULE 17: PERFORMANCE MANAGEMENT

           case "performance":
           return (
               <Performance
                   user={user}
              />
           );

           // MODULE 18: ADVANCED ANALYTICS & REPORTS

           case "analytics":
           return (
               <Analytics
                   user={user}
              />
           );

            // ----------------------------------
            // DEFAULT PAGE
            // ----------------------------------

            default:
                return (
                    <Dashboard
                        user={user}
                        onNavigate={handleNavigate}
                    />
                );
        }
    };


    // ==========================================
    // PAGE TITLES
    // ==========================================

    const getPageTitle = () => {

        const titles = {
            dashboard: "Dashboard",
            profile: "My Profile",
            employees: "Employees",
            attendance: "Attendance",
            leaves: "Leave Management",
            "leave-calendar": "Leave Calendar",
            payroll: "Payroll Management",
            notifications: "Notifications",
            "payroll-reports": "Payroll Reports",
            shifts: "Shift Management",
            documents: "Document Management",
            performance: "Performance Management",
            analytics: "Advanced Analytics & Reports",
        };

        return (
            titles[currentPage] ||
            "Dashboard"
        );
    };


    // ==========================================
    // MAIN APPLICATION LAYOUT
    // ==========================================

    return (
        <div className="ws-app-layout">

            {/* SIDEBAR */}

            <Sidebar
                user={user}
                currentPage={currentPage}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
            />


            {/* MAIN CONTENT */}

            <div className="ws-main-layout">

                {/* TOP HEADER */}

                <header className="ws-topbar">

                    <div>
                        <span className="ws-topbar-label">
                            WORKSPHERE / HR MANAGEMENT
                        </span>

                        <h1>
                            {getPageTitle()}
                        </h1>
                    </div>


                    {/* USER INFORMATION */}

                    <div className="ws-topbar-user">

                        <span className="ws-online-dot"></span>

                        <div>
                            <strong>
                                {user.username}
                            </strong>

                            <span>
                                {user.role}
                            </span>
                        </div>


                        {/* LOGOUT */}

                        <button
                            type="button"
                            className="ws-logout-button"
                            onClick={handleLogout}
                        >
                            Logout
                        </button>

                    </div>

                </header>


                {/* PAGE CONTENT */}

                <main className="ws-content">
                    {renderPage()}
                </main>


                {/* FOOTER */}

                <Footer />

            </div>

        </div>
    );
}

export default App;
