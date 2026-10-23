
import { useState } from "react";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Leaves from "./pages/Leaves";
import Payroll from "./pages/Payroll";
import Notifications from "./pages/Notifications";

import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";

import "./style/Global.css";
import "./App.css";

function App() {
    // Restore the logged-in user from localStorage.
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem("worksphere_user");

        try {
            return savedUser ? JSON.parse(savedUser) : null;
        } catch {
            localStorage.removeItem("worksphere_user");
            localStorage.removeItem("worksphere_token");
            return null;
        }
    });

    // Current page.
    const [currentPage, setCurrentPage] = useState("dashboard");

    // Handle successful login.
    const handleLogin = (loggedInUser) => {
        setUser(loggedInUser);
        setCurrentPage("dashboard");
    };

    // Handle logout.
    const handleLogout = () => {
        localStorage.removeItem("worksphere_token");
        localStorage.removeItem("worksphere_user");

        setUser(null);
        setCurrentPage("dashboard");
    };

    // Update the user after profile changes.
    const handleProfileUpdated = (updatedUser) => {
        setUser(updatedUser);

        localStorage.setItem(
            "worksphere_user",
            JSON.stringify(updatedUser)
        );
    };

    // Handle sidebar navigation.
    const handleNavigate = (page) => {
        // Only HR and ADMIN can access employee management.
        if (
            page === "employees" &&
            user?.role !== "ADMIN" &&
            user?.role !== "HR"
        ) {
            setCurrentPage("dashboard");
            return;
        }

        setCurrentPage(page);
    };

    // Show login if no user is logged in.
    if (!user) {
        return <Login onLogin={handleLogin} />;
    }

    // Render the selected page.
    const renderPage = () => {
        switch (currentPage) {
            case "dashboard":
                return (
                    <Dashboard
                        user={user}
                        onNavigate={handleNavigate}
                    />
                );

            case "employees":
                if (
                    user.role === "ADMIN" ||
                    user.role === "HR"
                ) {
                    return <Employees user={user} />;
                }

                return <Dashboard user={user} />;

            case "profile":
                return (
                    <Profile
                        user={user}
                        onProfileUpdated={handleProfileUpdated}
                    />
                );

            case "attendance":
                return <Attendance user={user} />;

            // Module 4: Leave Management.
            case "leaves":
                return <Leaves user={user} />;

            // Module 5: Payroll Management.
            case "payroll":
                return <Payroll user={user} />;

            // Module 7: Notification System.
            case "notifications":
                return <Notifications />;

            default:
                return (
                    <Dashboard
                        user={user}
                        onNavigate={handleNavigate}
                    />
                );
        }
    };

    return (
        <div className="ws-app-layout">
            <Sidebar
                user={user}
                currentPage={currentPage}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
            />

            <div className="ws-main-layout">
                {/* Top navigation bar */}
                <header className="ws-topbar">
                    <div>
                        <span className="ws-topbar-label">
                            WORKSPHERE / HR MANAGEMENT
                        </span>

                        <h1>
                            {currentPage === "profile"
                                ? "My Profile"
                                : currentPage === "notifications"
                                  ? "Notifications"
                                  : currentPage.charAt(0).toUpperCase() +
                                    currentPage.slice(1)}
                        </h1>
                    </div>

                    <div className="ws-topbar-user">
                        <span className="ws-online-dot"></span>

                        <div>
                            <strong>{user.username}</strong>
                            <span>{user.role}</span>
                        </div>

                        <button
                            type="button"
                            className="ws-logout-button"
                            onClick={handleLogout}
                        >
                            Logout
                        </button>
                    </div>
                </header>

                {/* Selected page */}
                <main className="ws-content">
                    {renderPage()}
                </main>

                {/* Footer */}
                <Footer />
            </div>
        </div>
    );
}

export default App;
