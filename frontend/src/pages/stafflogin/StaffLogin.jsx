import "./staffLogin.css";
import { useState, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";

export default function StaffLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { dispatch } = useContext(StaffAuthContext);

  const handleSubmit = async (e)=>{
    e.preventDefault();

    dispatch({type:"LOGIN_START"});

    try{
      const res = await axios.post(
        "/api/auth/staff/login",
        { identifier , password }
      );

      
      dispatch({
        type:"LOGIN_SUCCESS",
        payload:res.data
      });


      if(res.data){
        navigate("/");
      }

    }catch(err){

      dispatch({type:"LOGIN_FAILURE"});

      setError(
        err.response?.data?.message ||
        err.response?.data?.reason ||
        err.message ||
        "Login failed."
      );
    }
  };


  return (
    <div className="StaffLogin">
      <video autoPlay muted loop playsInline className="bg-video">
        <source src="assets/logomotion.mp4"  type="video/mp4" />
      </video>
      <h2>Staff Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Email, Username or Phone"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="forgot-link">
          <a href="/staff/forgot-password">Forgot password?</a>
        </div>
        <button type="submit" className="primary-btn">Login</button>
        <div className="barber-link">
         <span> New staff?</span> <a href="/invite">Register with invite →</a>
        </div>
      </form>
      {error && <p className="form-message error">{error}</p>}
    </div>
  );
}