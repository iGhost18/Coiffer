import { useState } from "react";
import "./login.css"; // adjust path to wherever login.css lives
import axios from "axios";
import CircularProgress from "@mui/material/CircularProgress";

export default function ForgotPassword({ role = "user" }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const endpoint = role === "staff"
    ? "/api/auth/staff/forgot-password"
    : "/api/auth/forgot-password";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await axios.post(endpoint, { email });
      setMessage(res.data?.message || res.data);
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
            <h2>Forgot password?</h2>
            <p className="subtitle">
              Enter your email and we'll send you a reset link.
            </p>

            <form className="form" onSubmit={handleSubmit}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button className="primary-btn" type="submit" disabled={loading}>
                {loading ? <CircularProgress color="white" /> : "Send reset link →"}
              </button>
            </form>

            {message && <p className="form-message success">{message}</p>}
            {error && <p className="form-message error">{error}</p>}

            <div className="barber-link">
              <a href={role === "staff" ? "/staffLogin" : "/login"}>← Back to login</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}