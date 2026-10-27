
import { useCallback, useEffect, useState } from "react";

import { getUnreadNotificationCount } from "../services/notificationService";

import "../style/Sidebar.css";

function Sidebar({ currentPage, onNavigate, user, onLogout }) {
    const [collapsed, setCollapsed] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const role = String(user?.role || "").toUpperCase();

    const isAdminOrHR =
        role === "ADMIN" || role === "HR";

    // ==========================================
    // FETCH UNREAD NOTIFICATION COUNT
    // ==========================================

    const loadUnreadCount = useCallback(async () => {
        if (!localStorage.getItem("worksphere_token")) {
            setUnreadCount(0);
            return;
        }

        try {
            const data = await getUnreadNotificationCount();

            setUnreadCount(
                Math.max(0, Number(data.unread_count) || 0)
            );
        } catch (error) {
            console.error(
                "Unable to fetch unread notification count:",
                error.response?.data?.detail || error.message
            );
        }
    }, []);

    // ==========================================
    // REFRESH NOTIFICATION COUNT
    // ==========================================

    useEffect(() => {
        loadUnreadCount();

        const intervalId = setInterval(() => {
            loadUnreadCount();
        }, 15000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                loadUnreadCount();
            }
        };

        window.addEventListener("focus", loadUnreadCount);

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        return () => {
            clearInterval(intervalId);

            window.removeEventListener(
                "focus",
                loadUnreadCount
            );

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        };
    }, [loadUnreadCount]);

    // ==========================================
    // SIDEBAR MENU ITEMS
    // ==========================================

    const menuItems = [
        {
            label: "Dashboard",
            key: "dashboard",
        },

        // Employees: ADMIN and HR only.
        ...(isAdminOrHR
            ? [
                  {
                      label: "Employees",
                      key: "employees",
                  },
              ]
            : []),

        {
            label: "Attendance",
            key: "attendance",
        },

        {
            label: "Leaves",
            key: "leaves",
        },

        // Module 15: Leave Calendar.
        {
            label: "Leave Calendar",
            key: "leave-calendar",
        },

        {
            label: "Payroll",
            key: "payroll",
        },

        // Payroll Reports: ADMIN and HR only.
        ...(isAdminOrHR
            ? [
                  {
                      label: "Payroll Reports",
                      key: "payroll-reports",
                  },
              ]
            : []),

        // Module 14: Shift Management.
        {
            label: "Shift Management",
            key: "shifts",
        },

       
        // Module 16: Document Management.
        {
            label: "Documents",
            key: "documents",
        },

        // Module 17: Performance Management.
        {
            label: "Performance",
            key: "performance",
        },
        
        // Module 18: Advanced Analytics & Reports.
        {
            label: "analytics",
            key: "analytics",
        },
            
        {
            label: "Notifications",
            key: "notifications",
        },
    ];

    // ==========================================
    // SIDEBAR UI
    // ==========================================

    return (
        <aside
            className={`ws-sidebar ${
                collapsed ? "collapsed" : ""
            }`}
        >
            {/* BRAND */}

            <div className="ws-brand">
                <div className="ws-brand-icon">
                    W
                </div>

                {!collapsed && (
                    <div>
                        <h2>WorkSphere</h2>
                        <span>HR MANAGEMENT</span>
                    </div>
                )}

                <button
                    type="button"
                    className="ws-sidebar-toggle"
                    onClick={() =>
                        setCollapsed((previous) => !previous)
                    }
                    title={
                        collapsed
                            ? "Expand sidebar"
                            : "Collapse sidebar"
                    }
                    aria-label={
                        collapsed
                            ? "Expand sidebar"
                            : "Collapse sidebar"
                    }
                >
                    {collapsed ? "›" : "‹"}
                </button>
            </div>

            {/* MENU HEADING */}

            {!collapsed && (
                <div className="ws-menu-heading">
                    MAIN MENU
                </div>
            )}

            {/* NAVIGATION MENU */}

            <nav className="ws-menu">
                {menuItems.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        title={
                            collapsed
                                ? item.label
                                : undefined
                        }
                        aria-current={
                            currentPage === item.key
                                ? "page"
                                : undefined
                        }
                        className={`ws-menu-item ${
                            currentPage === item.key
                                ? "active"
                                : ""
                        }`}
                        onClick={() => {
                            onNavigate(item.key);

                            if (item.key === "notifications") {
                                loadUnreadCount();
                            }
                        }}
                    >
                        <span className="ws-menu-dot">
                            ●
                        </span>

                        {!collapsed && (
                            <span className="ws-menu-label">
                                {item.label}
                            </span>
                        )}

                        {/* UNREAD NOTIFICATION BADGE */}

                        {item.key === "notifications" &&
                            unreadCount > 0 && (
                                <span
                                    className="ws-notification-badge"
                                    title={`${unreadCount} unread notifications`}
                                >
                                    {unreadCount > 99
                                        ? "99+"
                                        : unreadCount}
                                </span>
                            )}
                    </button>
                ))}
            </nav>

            {/* USER PROFILE SECTION */}

            <div
                className="ws-sidebar-bottom"
                onClick={() => onNavigate("profile")}
                role="button"
                tabIndex={0}
                title="Open profile"
                onKeyDown={(event) => {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        onNavigate("profile");
                    }
                }}
            >
                <div className="ws-user-avatar">
                    {user?.username
                        ?.charAt(0)
                        ?.toUpperCase() || "U"}
                </div>

                {!collapsed && (
                    <>
                        <div className="ws-user-details">
                            <strong>
                                {user?.username || "User"}
                            </strong>

                            <span>
                                {role || "EMPLOYEE"}
                            </span>
                        </div>

                        <span className="ws-profile-arrow">
                            ›
                        </span>
                    </>
                )}
            </div>
        </aside>
    );
}

export default Sidebar;
