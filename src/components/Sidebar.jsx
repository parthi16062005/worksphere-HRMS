
import { useCallback, useEffect, useState } from "react";
import { getUnreadNotificationCount } from "../services/notificationService";
import "../style/Sidebar.css";

function Sidebar({ currentPage, onNavigate, user, onLogout }) {
    const [collapsed, setCollapsed] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const isAdminOrHR =
        user?.role === "ADMIN" || user?.role === "HR";

    // Fetch the unread notification count.
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
            // Keep the sidebar working if notifications cannot load.
            console.error(
                "Unable to fetch unread notification count:",
                error.response?.data?.detail || error.message
            );
        }
    }, []);

    // Fetch the count initially and refresh it periodically.
    useEffect(() => {
        loadUnreadCount();

        const intervalId = setInterval(() => {
            loadUnreadCount();
        }, 15000);

        // Refresh the count when the user returns to the tab.
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

    const menuItems = [
        {
            label: "Dashboard",
            key: "dashboard",
        },

        // Employees is visible only for ADMIN and HR.
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
        {
            label: "Payroll",
            key: "payroll",
        },
        {
            label: "Notifications",
            key: "notifications",
        },
    ];

    return (
        <aside
            className={`ws-sidebar ${
                collapsed ? "collapsed" : ""
            }`}
        >
            {/* Brand */}
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
            </div>

            {/* Menu heading */}
            {!collapsed && (
                <div className="ws-menu-heading">
                    MAIN MENU
                </div>
            )}

            {/* Menu */}
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

            {/* User section */}
            <div
                className="ws-sidebar-bottom"
                onClick={() => onNavigate("profile")}
                role="button"
                tabIndex={0}
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
                                {user?.role || "EMPLOYEE"}
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
