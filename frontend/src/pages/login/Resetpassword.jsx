import { useState } from "react";
import "./login.css";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";

export default function ResetPassword({ role = "user" }) {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const endpoint = role === "staff"
    ? `/api/auth/staff/reset-password/${token}`
    : `/api/auth/reset-password/${token}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(endpoint, { password });
      setMessage(res.data?.message || res.data);
      setTimeout(() => navigate(role === "staff" ? "/staffLogin" : "/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.message || (typeof err.response?.data === "string" ? err.response.data : "Something went wrong."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <video autoPlay muted loop playsInline className="bg-video">
        <source src="/assets/logomotion.mp4" type="video/mp4" />
      </video>
      <div className="overlay"></div>

      <main className="content">
        <div className="auth-container">
          <div className="form-wrapper">
            <h2>New password</h2>
            <p className="subtitle">Choose a new password for your account.</p>

            <form className="form" onSubmit={handleSubmit}>
              <div className="field">
                <label>New password</label>
                <input
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="field">
                <label>Confirm password</label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <button className="primary-btn" type="submit" disabled={loading}>
                {loading ? <CircularProgress color="white" /> : "Reset password →"}
              </button>
            </form>

            {message && <p className="form-message success">{message}</p>}
            {error && <p className="form-message error">{error}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}