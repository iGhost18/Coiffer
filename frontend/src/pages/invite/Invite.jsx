import "./invite.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Invite() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
      const raw = token.trim();
      let extractedToken = raw;

      if (raw.includes("/staffregister/")) {
          extractedToken = raw.split("/staffregister/").pop();
      }

      extractedToken = extractedToken.replace(/\/+$/, "").split("?")[0];

      if (!extractedToken) {
        setError("Please enter a valid invite token or link.");
        return;
      }

      navigate(`/staffregister/${extractedToken}`);
  };
  return (
    <div className="InviteLanding">
      <h2>Enter your invite token</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Paste invite token or link"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary-btn">Continue</button>
      </form>
    </div>
  );
}