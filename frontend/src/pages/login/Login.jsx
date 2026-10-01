import { useRef, useContext, useState } from "react";
import "./login.css";
import { loginCall } from "../../apiCalls";
import { AuthContext } from "../../components/context/AuthContext";
import CircularProgress from "@mui/material/CircularProgress";
import api from "../../api";

export default function LoginReg() {
  const [tab, setTab] = useState("signin");
  const identifier = useRef();
  const firstName = useRef();
  const lastName = useRef();
  const password = useRef();
  const username = useRef();
  const phone = useRef();
  const registerEmail = useRef();
  const registerPassword = useRef();
  const city = useRef();
  const state = useRef();
  const country = useRef();
  const [registerError, setRegisterError] = useState("");
  const { isFetching, dispatch } = useContext(AuthContext);

  const handleSubmit = (e) => {
    e.preventDefault();
    loginCall(
      {
        identifier: identifier.current.value,
        password: password.current.value,
      },
      dispatch
    );
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError("");

    try {
      const user = {
        firstName: firstName.current.value,
        lastName: lastName.current.value,
        username: username.current.value,
        email: registerEmail.current.value,
        phone: phone.current.value,
        password: registerPassword.current.value,
        city: city.current.value,
        state: state.current.value,
        country: country.current.value,
      };

      const res = await api.post("/api/auth/register", user);

      console.log(res.data);

      alert("Registration successful!");

      setTab("signin");
    } catch (err) {
      const fieldErrors = err.response?.data?.errors;

      if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        setRegisterError(fieldErrors.map((e) => e.message).join(" "));
      } else {
        setRegisterError(err.response?.data?.message || "Registration failed. Try again.");
      }
    }
  };

  return (
    <div className="app">
      <video autoPlay muted loop playsInline className="bg-video">
        <source src="assets/logomotion.mp4" type="video/mp4" />
      </video>

      <div className="overlay"></div>

      {/* RIGHT PANEL */}
      <main className="content">
        <div className="auth-container">
          {/* TABS */}
          <div className="tabs">
            <button
              className={tab === "signin" ? "tab active" : "tab"}
              onClick={() => setTab("signin")}
            >
              Sign in
            </button>

            <button
              className={tab === "register" ? "tab active" : "tab"}
              onClick={() => setTab("register")}
            >
              Register
            </button>
          </div>

          {/* SIGN IN */}
          {tab === "signin" && (
            <div className="form-wrapper">
              <h2>Welcome back</h2>
              <p className="subtitle">
                Sign in to book your next appointment
              </p>

              <form className="form" onSubmit={handleSubmit}>
                <div className="field">
                  <label>Email, Username or Phone</label>
                  <input
                    type="text"
                    placeholder="Enter email, username or phone"
                    ref={identifier}
                    required
                  />
                </div>

                <div className="field">
                  <label>Password</label>
                  <input type="password" placeholder="••••••••" ref={password} required />
                </div>

                <div className="forgot-link">
                  <a href="/forgot-password">Forgot password?</a>
                </div>

                <button className="primary-btn" type="submit" disabled={isFetching}>
                  {isFetching ? <CircularProgress color="white" /> : "Sign in →"}
                </button>
              </form>
            </div>
          )}

          {/* REGISTER */}
          {tab === "register" && (
            <div className="form-wrapper">
              <h2>Create account</h2>

              <form className="form" onSubmit={handleRegister}>
                <div className="row">
                  <div className="field">
                    <label>First name</label>
                    <input
                      type="text"
                      placeholder="Jordan"
                      ref={firstName}
                      minLength={2}
                      maxLength={60}
                      pattern="[A-Za-zÀ-ÖØ-öø-ÿ' -]+"
                      title="Letters, spaces, apostrophes and hyphens only."
                    />
                  </div>

                  <div className="field">
                    <label>Last name</label>
                    <input
                      type="text"
                      placeholder="Smith"
                      ref={lastName}
                      minLength={2}
                      maxLength={60}
                      pattern="[A-Za-zÀ-ÖØ-öø-ÿ' -]+"
                      title="Letters, spaces, apostrophes and hyphens only."
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="Username"
                    ref={username}
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[A-Za-z0-9_.\-]+"
                    title="Letters, numbers, underscores, dots and hyphens only."
                  />
                  <p className="field-hint">
                    3–30 characters. Letters, numbers, underscores, dots and hyphens only.
                  </p>
                </div>

                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    ref={registerEmail}
                    required
                    maxLength={254}
                  />
                </div>

                <div className="field">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="08012345678"
                    ref={phone}
                    required
                  />
                  <p className="field-hint">
                    Nigerian numbers can be entered as 08012345678 — we'll format it automatically.
                  </p>
                </div>

                <div className="field">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Min. 12 characters"
                    ref={registerPassword}
                    required
                    minLength={12}
                    maxLength={128}
                  />
                  <p className="field-hint">
                    At least 12 characters, including one uppercase letter, one lowercase letter, and one number.
                  </p>
                </div>

                <div className="field">
                  <label>City</label>
                  <input type="text" placeholder="City" ref={city} maxLength={100} />
                </div>

                <div className="field">
                  <label>State</label>
                  <input type="text" placeholder="State" ref={state} maxLength={100} />
                </div>

                <div className="field">
                  <label>Country</label>
                  <input type="text" placeholder="Country" ref={country} maxLength={100} />
                </div>

                {registerError && <p className="form-message error">{registerError}</p>}

                <button className="primary-btn" type="submit">
                  Create account →
                </button>
              </form>
            </div>
          )}

          <div className="barber-link">
            <span>Are you a Expert?</span>
            <a href="/staffLogin">Expert Login →</a>
          </div>
        </div>
      </main>
    </div>
  );
}