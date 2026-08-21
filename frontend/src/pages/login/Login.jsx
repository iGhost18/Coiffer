import { useRef, useContext, useState } from "react";
import "./login.css";
import { loginCall } from "../../apiCalls";
import { AuthContext } from "../../components/context/AuthContext";
import CircularProgress from "@mui/material/CircularProgress";
import axios from "axios";


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
  const {isFetching, dispatch} = useContext(AuthContext);


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
        country: country.current.value
      };

      const res = await axios.post("/api/auth/register", user);

      console.log(res.data);

      alert("Registration successful!");

      setTab("signin");

    } catch (err) {
      setRegisterError(err.response?.data?.message || "Registration failed. Try again.");
    }
  };

  return (
    <div className="app">
      <video autoPlay muted loop playsInline className="bg-video">
        <source src="assets/logomotion.mp4"  type="video/mp4" />
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
                  <label>Email, Username or Phone </label>
                  <input
                    type="text"
                    placeholder="Enter email, username or phone"
                    ref={identifier}
                    required
                  />
                </div>

                <div className="field">
                  <label>Password</label>
                  <input type="password" placeholder="••••••••"  ref={password} required minLength={6}/>
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
              {/* <p className="subtitle">
                Get started — free forever for clients
              </p> */}

              <form className="form" onSubmit={handleRegister}>
                <div className="row">
                  <div className="field">
                    <label>First name</label>
                    <input type="text" placeholder="Jordan" ref={firstName} />
                  </div>

                  <div className="field">
                    <label>Last name</label>
                    <input type="text" placeholder="Smith" ref={lastName} />
                  </div>
                </div>

                <div className="field">
                  <label>Username</label>
                  <input type="text" placeholder="Username" ref={username} required />
                </div>

                <div className="field">
                  <label>Email</label>
                  <input type="email" placeholder="Enter your email" ref={registerEmail} />
                </div>

                <div className="field">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="08012345678"
                    ref={phone}
                  />
                </div>

                <div className="field">
                  <label>Password</label>
                  <input type="password" placeholder="Min. 6 characters" ref={registerPassword} required minLength={6} />
                </div>

                <div className="field">
                  <label>City</label>
                  <input type="text" placeholder="City" ref={city} />
                </div>

                <div className="field">
                  <label>State</label>
                  <input type="text" placeholder="State" ref={state} />
                </div>

                <div className="field">
                  <label>Country</label>
                  <input type="text" placeholder="Country" ref={country} />
                </div>

                <button className="primary-btn" type="submit">
                  Create account →
                </button>
              </form>
            </div>
          )}

          <div className="barber-link">
            <span>Are you a staff?</span><a href="/staffLogin">Staff Login →</a>
          </div>
        </div>
      </main>
    </div>
  );
}
