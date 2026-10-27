
import { useState } from "react";
import api from "../services/api";
import "../style/Login.css";

function Login({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);

    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    // ==========================================
    // LOGIN / REGISTER
    // ==========================================

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (loading) return;

        setLoading(true);
        setMessage("");
        setError("");

        try {
            if (isLogin) {
                // Step 1: Send username and password to backend.
                const params = new URLSearchParams();

                params.append(
                    "username",
                    formData.username.trim()
                );

                params.append(
                    "password",
                    formData.password
                );

                const response = await api.post(
                    "/auth/login",
                    params,
                    {
                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded",
                        },
                    }
                );

                const token = response.data.access_token;

                if (!token) {
                    throw new Error(
                        "Login succeeded without an access token."
                    );
                }

                // Step 2: Save token before requesting the profile.
                localStorage.setItem(
                    "worksphere_token",
                    token
                );

                // Step 3: Get the actual logged-in user.
                const profileResponse = await api.get("/auth/me");

                const user = profileResponse.data;

                // Step 4: Save user details.
                localStorage.setItem(
                    "worksphere_user",
                    JSON.stringify(user)
                );

                // Step 5: Notify App.jsx that login succeeded.
                if (typeof onLogin === "function") {
                    onLogin(user);
                } else {
                    throw new Error(
                        "Login callback is missing. Please check App.jsx."
                    );
                }
            } else {
                // Register a new employee account.
                await api.post("/auth/register", {
                    username: formData.username.trim(),
                    email: formData.email.trim().toLowerCase(),
                    password: formData.password,
                });

                setIsLogin(true);

                setFormData({
                    username: formData.username.trim(),
                    email: "",
                    password: "",
                });

                setMessage(
                    "Registration successful! Please sign in."
                );
            }
        } catch (err) {
            // If login or profile retrieval fails, clear the token.
            localStorage.removeItem("worksphere_token");
            localStorage.removeItem("worksphere_user");

            const detail = err.response?.data?.detail;

            setError(
                typeof detail === "string"
                    ? detail
                    : err.message ||
                      "Unable to complete your request. Please check your details."
            );
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // SWITCH LOGIN / REGISTER FORM
    // ==========================================

    const switchForm = () => {
        setIsLogin((previous) => !previous);

        setMessage("");
        setError("");

        setFormData({
            username: "",
            email: "",
            password: "",
        });
    };

    // ==========================================
    // UI
    // ==========================================

    return (
        <div className="login-page">
            <header className="login-navbar">
                <div className="login-brand">
                    <div className="login-brand-icon">W</div>

                    <div>
                        <h2>WorkSphere</h2>
                        <span>
                            Human Resource Management
                        </span>
                    </div>
                </div>

                <div className="login-navbar-actions">
                    <span>
                        {isLogin
                            ? "New to WorkSphere?"
                            : "Already have an account?"}
                    </span>

                    <button
                        type="button"
                        onClick={switchForm}
                    >
                        {isLogin
                            ? "Create account"
                            : "Sign in"}
                    </button>
                </div>
            </header>

            <main className="login-layout">
                <section className="login-card">
                    <div className="login-heading">
                        <div className="login-symbol">
                            {isLogin ? "→" : "+"}
                        </div>

                        <span className="login-eyebrow">
                            {isLogin
                                ? "WELCOME BACK"
                                : "GET STARTED"}
                        </span>

                        <h1>
                            {isLogin
                                ? "Sign in to your account"
                                : "Create your account"}
                        </h1>

                        <p>
                            {isLogin
                                ? "Enter your details to access your workspace."
                                : "Enter your details to join WorkSphere."}
                        </p>
                    </div>

                    {message && (
                        <div
                            className="login-success"
                            role="status"
                        >
                            {message}
                        </div>
                    )}

                    {error && (
                        <div
                            className="login-error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="login-form-group">
                            <label htmlFor="login-username">
                                Username
                            </label>

                            <input
                                id="login-username"
                                name="username"
                                type="text"
                                placeholder="Enter your username"
                                value={formData.username}
                                onChange={handleChange}
                                minLength={3}
                                maxLength={50}
                                autoComplete="username"
                                required
                            />
                        </div>

                        {!isLogin && (
                            <div className="login-form-group">
                                <label htmlFor="login-email">
                                    Email address
                                </label>

                                <input
                                    id="login-email"
                                    name="email"
                                    type="email"
                                    placeholder="you@company.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        )}

                        <div className="login-form-group">
                            <label htmlFor="login-password">
                                Password
                            </label>

                            <input
                                id="login-password"
                                name="password"
                                type="password"
                                placeholder="Enter your password"
                                value={formData.password}
                                onChange={handleChange}
                                minLength={isLogin ? 1 : 8}
                                maxLength={72}
                                autoComplete={
                                    isLogin
                                        ? "current-password"
                                        : "new-password"
                                }
                                required
                            />

                            {!isLogin && (
                                <span className="login-input-hint">
                                    Use at least 8 characters.
                                </span>
                            )}
                        </div>

                        <button
                            className="login-submit-button"
                            type="submit"
                            disabled={loading}
                        >
                            {loading
                                ? "Please wait..."
                                : isLogin
                                  ? "Sign in to WorkSphere →"
                                  : "Create account →"}
                        </button>
                    </form>

                    <div className="login-divider">
                        <span>
                            SECURE WORKSPACE ACCESS
                        </span>
                    </div>

                    <p className="login-switch">
                        {isLogin
                            ? "Don't have an account?"
                            : "Already registered?"}

                        <button
                            type="button"
                            onClick={switchForm}
                        >
                            {isLogin
                                ? " Create account"
                                : " Sign in"}
                        </button>
                    </p>
                </section>
            </main>

            <footer className="login-footer">
                <span>© 2026 WorkSphere HRMS</span>
                <span>
                    Designed for better workplaces.
                </span>
            </footer>
        </div>
    );
}

export default Login;
