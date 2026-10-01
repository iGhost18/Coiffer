import "./invite.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";

export default function Invite() {
  const navigate = useNavigate();

  // Request form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [service, setService] = useState("");
  const [serviceOptions, setServiceOptions] = useState([]);

  // Token form
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState("");

  const handleRequest = async (e) => {
    e.preventDefault();
    setRequestError("");
    setSending(true);
    try {
      await api.post("/api/invite-request", { name, email, service, message, website });
      setSent(true);
    } catch (err) {
      setRequestError(
        err.response?.data?.message || "Couldn't send your request. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  const handleToken = (e) => {
    e.preventDefault();
    setTokenError("");

    let extracted = token.trim();
    if (extracted.includes("/staffregister/")) {
      extracted = extracted.split("/staffregister/").pop();
    }
    extracted = extracted.replace(/\/+$/, "").split("?")[0];

    if (!extracted) {
      setTokenError("Please enter a valid invite token or link.");
      return;
    }
    navigate(`/staffregister/${extracted}`);
  };

  useEffect(() => {
    api
      .get("/api/homepage-services")
      .then((res) => {
        const names = (Array.isArray(res.data) ? res.data : []).map((s) => s.name).filter(Boolean);
        setServiceOptions([...new Set(names)]);
      })
      .catch(() => {}); // suggestions are optional, so the form still works without them
  }, []);

  return (
    <div className="InviteLanding">
      {/* ── Step 1: request ── */}
      <div className="invite-card">
        <h2>Request an invite</h2>

        {sent ? (
          <div className="invite-sent">
            <p className="invite-sent-title">✓ Request sent</p>
            <p>
              We'll review it and reply to <strong>{email}</strong> with your invite token.
              This can take a little while, so check your spam folder too.
              Once you have it, paste it below to continue.
            </p>
            <button
              type="button"
              className="invite-link-btn"
              onClick={() => {
                setSent(false);
                setEmail("");
                setName("");
                setService("");
                setMessage("");
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleRequest}>
            <p className="invite-hint">
              Enter your details and we'll email you a token to start your registration.
            </p>

            <input
              type="text"
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
            <input
              type="text"
              list="invite-services"
              placeholder="Service you offer (e.g. Barber)"
              value={service}
              onChange={(e) => setService(e.target.value)}
              required
              minLength={2}
              maxLength={100}
            />
            <datalist id="invite-services">
              {serviceOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <textarea
              placeholder="Anything we should know? (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
            />

            {/* honeypot: hidden from real users */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", height: 0, opacity: 0 }}
            />

            {requestError && <p className="error">{requestError}</p>}
            <button type="submit" className="primary-btn" disabled={sending}>
              {sending ? "Sending..." : "Send request"}
            </button>
          </form>
        )}
      </div>

      <div className="invite-divider"><span>already have a token?</span></div>

      {/* ── Step 2: token ── */}
      <div className="invite-card">
        <h2>Enter your invite token</h2>
        <form onSubmit={handleToken}>
          <input
            type="text"
            placeholder="Paste invite token or link"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
          {tokenError && <p className="error">{tokenError}</p>}
          <button type="submit" className="primary-btn">Continue</button>
        </form>
      </div>
    </div>
  );
}