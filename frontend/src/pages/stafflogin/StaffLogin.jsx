import "./staffLogin.css";
import { useState, useContext } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";
import CircularProgress from "@mui/material/CircularProgress";


// Turns whatever the server (or network) gave us into one readable line
const getLoginErrorMessage = (err) => {
  // No response at all: server down, CORS failure, or no internet
  if (!err.response) {
    return "Can't reach the server. Check your connection and try again.";
  }

  const { status, data } = err.response;

  if (status === 401) {
    return "Invalid credentials. Check your details and try again.";
  }

  // Zod validation errors: { message, errors: [{ field, message }] }
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e) => e.message).join(" ");
  }

  // Rate limiter and other errors may send a plain string or { message }
  if (typeof data === "string" && data.trim()) return data;
  if (data?.message) return data.message;

  return "Login failed. Please try again.";
};

export default function StaffLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { dispatch } = useContext(StaffAuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError("");
    setIsSubmitting(true);
    dispatch({ type: "LOGIN_START" });

    try {
      const res = await api.post("/api/auth/staff/login", {
        identifier: identifier.trim(),
        password,
      });

      dispatch({
        type: "LOGIN_SUCCESS",
        payload: {
          ...res.data.staff,
          accessToken: res.data.accessToken,
        },
      });

      navigate("/", { replace: true });
    } catch (err) {
      dispatch({ type: "LOGIN_FAILURE" });
      setError(getLoginErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="StaffLogin">
      <video autoPlay muted loop playsInline className="bg-video">
        <source src="/assets/logomotion.mp4" type="video/mp4" />
      </video>
      <div className="overlay"></div>

      <h2>Expert Login</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Email, Username or Phone"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          maxLength={254}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          maxLength={128}
          required
        />

        {error && (
          <p className="form-message error" role="alert">
            {error}
          </p>
        )}

        <div className="forgot-link">
          <a href="/staff/forgot-password">Forgot password?</a>
        </div>

        <button type="submit" className="primary-btn" disabled={isSubmitting}>
          {isSubmitting ? (
            <CircularProgress color="white" /> 
          ) : (
            "Login"
          )}
        </button>

        <div className="barber-link">
          <span>New Expert?</span> <a href="/invite">Register with invite →</a>
        </div>
      </form>
    </div>
  );
}