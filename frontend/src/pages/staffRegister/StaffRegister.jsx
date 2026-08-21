import "./staffregister.css";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";




const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// ── Password strength helper ─────────────────────────────────────
function PasswordStrength({ value }) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  const level = score <= 1 ? "weak" : score <= 2 ? "mid" : "strong";
  const label = ["", "Weak", "Fair", "Good", "Strong"][score];

  return (
    <div className="strength-wrap">
      <div className="strength-bar">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`strength-seg ${i <= score ? `strength-seg--${level}` : ""}`}
          />
        ))}
      </div>
      {value.length > 0 && (
        <span className={`strength-label strength-label--${level}`}>{label}</span>
      )}
    </div>
  );
}


// ── Main component ────────────────────────────────────────────────
function StaffReg() {
  const [step, setStep] = useState(1);
  const {token} = useParams();
  const navigate = useNavigate();
  const [loading,setLoading] = useState(true);
  const [valid,setValid] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    token: token,
    firstName: "",
    lastName: "",
    displayName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    bio: "",
    roles: [],
    experience: "",
    workType: "",
    location: "",
    specialties: "",
    workDays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    profilePicture: "",
  });

  const [homepageServices, setHomepageServices] = useState([]);
 
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png"];

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    setPhotoError("");

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoError("Only JPG or PNG files are allowed.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_SIZE) {
      setPhotoError("File must be under 2MB.");
      e.target.value = "";
      return;
    }

    // Show an instant local preview while the real upload happens
    setPhotoPreview(URL.createObjectURL(file));
    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "x-invite-token": token,
        },
      });

      // Store the real server URL, same as StaffSettings does
      update({ profilePicture: res.data.url });
    } catch (err) {
      console.log(err);
      setPhotoError("Upload failed. Try again.");
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };


  const verifyInvite = useCallback(async () => {
    try {
      const res = await axios.get(`/api/invite/verify/${token}`);

      setForm(prev => ({
        ...prev,
        email: res.data.email,
      }));

      setValid(true);
    } catch (err) {
      setError(err.response?.data?.message || (typeof err.response?.data === "string" ? err.response.data : "Invalid invite."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    verifyInvite();
  }, [verifyInvite]);

  useEffect(() => {
    const fetchHomepageServices = async () => {
      try {
        const res = await axios.get("/api/homepage-services");
        setHomepageServices(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.log(err);
      }
    };
    fetchHomepageServices();
  }, []);





  const update = (fields) => {
    setForm(prev => ({
      ...prev,
      ...fields
    }));
  };

  const nextStep = () => setStep(s=>s+1);
  const prevStep = () => setStep(s=>s-1);

  const toggleRole = (roleName) => {
    const has = form.roles.includes(roleName);

    update({
      roles: has ? form.roles.filter((r) => r !== roleName) : [...form.roles, roleName]
    });
  };


  const toggleDay = (day) => {

    const has = form.workDays.includes(day);

    update({
      workDays: has ? form.workDays.filter(d=>d!==day) : [...form.workDays,day]
    });
  };

  const handleSubmit = async () => {
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.roles.length === 0) {
      setError("Select at least one role.");
      return;
    }

    try {

      await axios.post(
        "/api/auth/staff/register",
        {
          token,

          firstName: form.firstName,
          lastName: form.lastName,
          username: form.username,
          email: form.email,
          phone: form.phone,
          password: form.password,
          bio: form.bio,
          roles: form.roles,
          experience: form.experience,
          workType: form.workType,
          location: form.location,
          specialties: form.specialties
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          workDays: form.workDays,
          profilePicture: form.profilePicture,
        }
      );
      setStep(5);

      alert("Registration successful.");

      navigate("/staffLogin");

    } catch(err){

      setError(
        err.response?.data?.message ||
        err.response?.data ||
        "Registration failed."
      );
    }
  };
  

  const initials = (form.firstName?.[0] || "?").toUpperCase() + (form.lastName?.[0] || "").toUpperCase();

  const steps = [
    "Account",
    "Profile",
    "Schedule",
    "Review"
  ];

  if (loading) {
    return <h2>Checking invite...</h2>;
  }

  if (!valid) {
    return (
      <div>
        <h2>Invite Invalid</h2>
        <p>{error}</p>
      </div>
    );
  }




  return (
    <div className="sr-page">

      {/* ── Top bar ── */}
      <div className="sr-topbar">
        <div className="sr-logo">
          <img src="/assets/GhostLogo.png" alt="" className='Logo'/>
        </div>
        <div className="sr-badge">✂ Staff Portal</div>
      </div>

      {/* ── Invite token banner ── */}
      <div className="sr-token-banner">
        <span className="sr-token-check">✓</span>
        <span className="sr-token-msg">
          Invite verified — sent to <strong>{form.email}</strong>
          <span className="sr-token-code">tk_xK9m…4rPq</span>
        </span>
      </div>

      {/* ── Layout: sidebar + main ── */}
      <div className="sr-body">

        {/* Sidebar */}
        <aside className="sr-sidebar">
          {steps.map((label, i) => {
            const num = i + 1;
            const isDone = step > num;
            const isActive = step === num;
            return (
              <div key={label}>
                <button
                  className={`sr-step ${isActive ? "sr-step--active" : ""} ${isDone ? "sr-step--done" : ""}`}
                  onClick={() => isDone && setStep(num)}
                >
                  <span className="sr-step-num">{isDone ? "✓" : num}</span>
                  <span className="sr-step-label">{label}</span>
                </button>
                {i < steps.length - 1 && <div className="sr-step-divider" />}
              </div>
            );
          })}
        </aside>

        {/* Main content */}
        <main className="sr-main">

          {/* ───────────── STEP 1 — Account ───────────── */}
          {step === 1 && (
            <div className="sr-step-content">
              <div className="sr-step-head">
                <h2>Create your account</h2>
                <p>Your login credentials for the Ghosthebarber staff profile</p>
              </div>

              <div className="sr-section">
                <p className="sr-section-label">Personal Info</p>

                <div className="sr-field-row">
                  <div className="sr-field">
                    <label htmlFor="firstName">First Name</label>
                    <input
                      id="firstName"
                      type="text"
                      placeholder="Enter first name"
                      value={form.firstName}
                      onChange={(e) => update({ firstName: e.target.value })}
                    />
                  </div>
                  <div className="sr-field">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      id="lastName"
                      type="text"
                      placeholder="Enter last name"
                      value={form.lastName}
                      onChange={(e) => update({ lastName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="sr-field">
                  <label htmlFor="username">Username</label>
                  <div className="sr-username-wrap">
                    <span className="sr-username-at">@</span>
                    <input
                      id="username"
                      type="text"
                      placeholder="e.g. marcuscole"
                      value={form.username}
                      onChange={(e) =>
                        update({
                          username: e.target.value.toLowerCase().replace(/\s/g, ""),
                        })
                      }
                      className="sr-username-input"
                    />
                  </div>
                  <span className="sr-field-hint">Clients will see this on your booking profile</span>
                </div>

                <div className="sr-field">
                  <label htmlFor="email">Email Address</label>
                  <div className="sr-locked-wrap">
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      readOnly
                    />
                    <span className="sr-locked-badge">Invite locked</span>
                  </div>
                </div>

                <div className="sr-field">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={form.phone}
                    onChange={(e) => update({ phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="sr-section">
                <p className="sr-section-label">Security</p>

                <div className="sr-field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => update({ password: e.target.value })}
                  />
                  <PasswordStrength value={form.password} />
                </div>

                <div className="sr-field">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat password"
                    value={form.confirmPassword}
                    onChange={(e) => update({ confirmPassword: e.target.value })}
                  />
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <span className="sr-field-error">Passwords do not match</span>
                  )}
                </div>
              </div>

              <div className="sr-footer">
                <div className="sr-progress">
                  {steps.map((_, i) => (
                    <span key={i} className={`sr-dot ${i === step - 1 ? "sr-dot--on" : ""}`} />
                  ))}
                </div>
                <button className="sr-btn-next" onClick={nextStep}>Next →</button>
              </div>
            </div>
          )}

          {/* ───────────── STEP 2 — Profile ───────────── */}
          {step === 2 && (
            <div className="sr-step-content">
              <div className="sr-step-head">
                <h2>Your Barber Profile</h2>
                <p>Clients will see this when browsing and booking</p>
              </div>

              <div className="sr-section">
                <p className="sr-section-label">Photo &amp; Bio</p>

                <div className="sr-avatar-row">
                  <div
                    className="sr-avatar"
                    onClick={handlePhotoClick}
                    style={{ cursor: "pointer", overflow: "hidden" }}
                  >
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Profile preview"
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      ref={fileInputRef}
                      onChange={handlePhotoChange}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      className="sr-upload-btn"
                      onClick={handlePhotoClick}
                      disabled={uploadingPhoto}
                    >
                      {uploadingPhoto ? "Uploading..." : "↑ Upload Photo"}
                    </button>
                    <p className="sr-upload-hint">JPG or PNG, max 2MB</p>
                    {photoError && <p className="sr-upload-error">{photoError}</p>}
                  </div>
                </div>

                <div className="sr-field">
                  <label htmlFor="bio">Bio / Tagline</label>
                  <textarea
                    id="bio"
                    placeholder="e.g. Specialist in fades, lineups & beard sculpting. 6 years experience."
                    value={form.bio}
                    onChange={(e) => update({ bio: e.target.value })}
                  />
                </div>

                <div className="sr-field-row">
                  <div className="sr-field">
                    <label>Role / Title</label>
                    <span className="sr-field-hint">Select every service you offer — clients filter by these</span>

                    {homepageServices.length === 0 ? (
                      <p className="sr-field-hint">No services set up yet — check back soon.</p>
                    ) : (
                      <div className="sr-chip-grid">
                        {homepageServices.map((s) => (
                          <button
                            key={s._id}
                            type="button"
                            className={`sr-chip ${form.roles.includes(s.name) ? "sr-chip--on" : ""}`}
                            onClick={() => toggleRole(s.name)}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="sr-field">
                    <label htmlFor="experience">Years of Experience</label>
                    <input
                      id="experience"
                      type="number"
                      min="0"
                      placeholder="e.g. 6"
                      value={form.experience}
                      onChange={(e) => update({ experience: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* ── Mobile or Stationed ── */}
              <div className="sr-section">
                <p className="sr-section-label">Work Type</p>
                <p className="sr-worktype-hint">Are you a mobile barber or do you work from a fixed location?</p>

                <div className="sr-worktype-grid">
                  <button
                    type="button"
                    className={`sr-worktype-card ${form.workType === "mobile" ? "sr-worktype-card--on" : ""}`}
                    onClick={() => update({ workType: "mobile" })}
                  >
                    <span className="sr-worktype-icon">🚗</span>
                    <span className="sr-worktype-name">Mobile</span>
                    <span className="sr-worktype-desc">You travel to clients</span>
                  </button>

                  <button
                    type="button"
                    className={`sr-worktype-card ${form.workType === "stationed" ? "sr-worktype-card--on" : ""}`}
                    onClick={() => update({ workType: "stationed" })}
                  >
                    <span className="sr-worktype-icon">✂</span>
                    <span className="sr-worktype-name">Stationed</span>
                    <span className="sr-worktype-desc">Clients come to you</span>
                  </button>
                </div>

                {form.workType === "mobile" && (
                  <div className="sr-field sr-worktype-extra">
                    <label htmlFor="location">Service Area / Coverage</label>
                    <input
                      id="location"
                      type="text"
                      placeholder="e.g. Lekki, VI, Ikoyi — or 15km radius"
                      value={form.location}
                      onChange={(e) => update({ location: e.target.value })}
                    />
                  </div>
                )}

                {form.workType === "stationed" && (
                  <div className="sr-field sr-worktype-extra">
                    <label htmlFor="location">Shop / Salon Address</label>
                    <input
                      id="location"
                      type="text"
                      placeholder="e.g. 14 Bode Thomas St, Surulere, Lagos"
                      value={form.location}
                      onChange={(e) => update({ location: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* ── Specialties ── */}
              <div className="sr-section">
                <p className="sr-section-label">Specialties</p>
                <div className="sr-field">
                  <textarea
                    placeholder="e.g. Fades, kids cuts, beard sculpting, hair colouring — anything you're known for"
                    value={form.specialties}
                    onChange={(e) => update({ specialties: e.target.value })}
                    rows={3}
                  />
                  <span className="sr-field-hint">Separate multiple specialties with commas</span>
                </div>
              </div>

              <div className="sr-footer">
                <div className="sr-footer-left">
                  <button className="sr-btn-back" onClick={prevStep}>← Back</button>
                  <div className="sr-progress">
                    {steps.map((_, i) => (
                      <span key={i} className={`sr-dot ${i === step - 1 ? "sr-dot--on" : ""}`} />
                    ))}
                  </div>
                </div>
                <button className="sr-btn-next" onClick={nextStep}>Next →</button>
              </div>
            </div>
          )}

          {/* ───────────── STEP 3 — Working Days ───────────── */}
          {step === 3 && (
            <div className="sr-step-content">
              <div className="sr-step-head">
                <h2>Working Days</h2>
                <p>Which days do you take clients? You can set your hours later from settings.</p>
              </div>

              <div className="sr-section">
                <p className="sr-section-label">Select days</p>
                <div className="sr-chip-grid">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={`sr-chip ${form.workDays.includes(day) ? "sr-chip--on" : ""}`}
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sr-footer">
                <div className="sr-footer-left">
                  <button className="sr-btn-back" onClick={prevStep}>← Back</button>
                  <div className="sr-progress">
                    {steps.map((_, i) => (
                      <span key={i} className={`sr-dot ${i === step - 1 ? "sr-dot--on" : ""}`} />
                    ))}
                  </div>
                </div>
                <button className="sr-btn-next" onClick={nextStep}>Next →</button>
              </div>
            </div>
          )}

          {/* ───────────── STEP 4 — Review ───────────── */}
          {step === 4 && (
            <div className="sr-step-content">
              <div className="sr-step-head">
                <h2>Review &amp; Confirm</h2>
                <p>Check your details before going live</p>
              </div>

              <div className="sr-section">
                <p className="sr-section-label">Account</p>
                <div className="sr-review-card">
                  <div className="sr-review-row">
                    <span className="sr-review-label">Name</span>
                    <span className="sr-review-value">{form.firstName} {form.lastName}</span>
                  </div>
                  <div className="sr-review-row">
                    <span className="sr-review-label">Username</span>
                    <span className="sr-review-value">@{form.username || "—"}</span>
                  </div>
                  <div className="sr-review-row">
                    <span className="sr-review-label">Email</span>
                    <span className="sr-review-value">{form.email}</span>
                  </div>
                  <div className="sr-review-row">
                    <span className="sr-review-label">Phone</span>
                    <span className="sr-review-value">{form.phone || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="sr-section">
                <p className="sr-section-label">Profile</p>
                <div className="sr-review-card">
                 <div className="sr-review-row">
                    <span className="sr-review-label">Role</span>
                    <span className="sr-review-value">
                      {form.roles.length > 0 ? form.roles.join(", ") : "—"}
                    </span>
                  </div>
                  <div className="sr-review-row">
                    <span className="sr-review-label">Experience</span>
                    <span className="sr-review-value">{form.experience ? `${form.experience} years` : "—"}</span>
                  </div>
                  <div className="sr-review-row">
                    <span className="sr-review-label">Work Type</span>
                    <span className="sr-review-value">
                      {form.workType === "mobile" ? "Mobile barber" : form.workType === "stationed" ? "Stationed" : "—"}
                    </span>
                  </div>
                  <div className="sr-review-row">
                    <span className="sr-review-label">Location</span>
                    <span className="sr-review-value">{form.location || "—"}</span>
                  </div>
                  <div className="sr-review-row">
                    <span className="sr-review-label">Specialties</span>
                    <span className="sr-review-value">
                      {form.specialties.trim() ? form.specialties : "None entered"}
                    </span>
                  </div>
                </div>
              </div>

             <div className="sr-section">
                <p className="sr-section-label">Working Days</p>
                <div className="sr-review-card">
                  <div className="sr-review-row">
                    <span className="sr-review-label">Days</span>
                    <span className="sr-review-value">
                      {form.workDays.length > 0 ? form.workDays.join(", ") : "None selected"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="sr-review-notice">
                ✓ You can edit all of these details later from your staff dashboard
              </div>

              {error && <p className="sr-field-error">{error}</p>}

              <div className="sr-footer">
                <div className="sr-footer-left"> 
                  <button className="sr-btn-back" onClick={prevStep}>← Back</button>
                  <div className="sr-progress">
                    {steps.map((_, i) => (
                      <span key={i} className={`sr-dot ${i === step - 1 ? "sr-dot--on" : ""}`} />
                    ))}
                  </div>
                </div>
                <button className="sr-btn-next sr-btn-complete" onClick={handleSubmit}>
                  ✓ Complete Setup
                </button>
              </div>
            </div>
          )}

          {/* ───────────── STEP 5 — Success ───────────── */}
          {step === 5 && (
            <div className="sr-success">
              <div className="sr-success-icon">✂</div>
              <h2 className="sr-success-title">You're all set, {form.firstName || "there"}!</h2>
              <p className="sr-success-sub">
                Your staff profile is live on Ghosthebarber. Clients can now discover
                and book appointments with you.
              </p>
              {form.username && (
                <div className="sr-success-handle">
                  Your booking link: <span>ghosthebarber.com/@{form.username}</span>
                </div>
              )}
              <div className="sr-success-summary">
                <div className="sr-summary-item">
                  <span>{form.workType === "mobile" ? "🚗" : "✂"}</span>
                  <span>{form.workType === "mobile" ? "Mobile barber" : "Stationed barber"}</span>
                </div>
               {form.specialties.trim() && (
                  <div className="sr-summary-item">
                    <span>⭐</span>
                    <span>
                      {form.specialties
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(", ")}
                    </span>
                  </div>
                )}
            
              </div>
              <button className="sr-btn-next sr-success-btn"
               onClick={() => navigate("/staffLogin")}>Go to Dashboard →</button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default StaffReg;