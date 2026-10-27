function Navbar({ user, onLogout }) {
    return (
        <header className="app-navbar">
            <div className="app-brand">
                <div className="app-brand-icon">W</div>

                <div>
                    <h2>WorkSphere</h2>
                    <span>Human Resource Management</span>
                </div>
            </div>

            {user && (
                <div className="app-navbar-actions">
                    <span className="app-navbar-username">
                        {user.username}
                    </span>

                    <button
                        type="button"
                        className="app-logout-button"
                        onClick={onLogout}
                    >
                        Logout
                    </button>
                </div>
            )}
        </header>
    );
}

export default Navbar;