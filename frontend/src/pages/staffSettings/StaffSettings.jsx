import "./staffsettings.css";
import { useState, useEffect, useContext, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import api from "../../api"; 
import socket from "../../socket";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = { Monday: "Mo", Tuesday: "Tu", Wednesday: "We", Thursday: "Th", Friday: "Fr", Saturday: "Sa", Sunday: "Su" };

export default function StaffSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { staff, dispatch } = useContext(StaffAuthContext);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    username: "",
    displayName: "",
    firstName: "",
    lastName: "",
    phone: "",
    desc: "",
    location: "",
    specialties: "",
    roles: [],
    workDays: [],
    schedule: {},
    workType: "",
    profilePicture: "",
    coverPicture: ["","",""],
    flutterwave: { subaccountId: null, subaccountStatus: "not_connected" },   // ← add this line
  });

  const [homepageServices, setHomepageServices] = useState([]);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(null);

  // ── Live GPS sharing (mobile barbers) ──
  const [locationSharing, setLocationSharing] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const watchIdRef = useRef(null);
  const [banks, setBanks] = useState([]);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutBank, setPayoutBank] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [connectingPayout, setConnectingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  
  const isOwnProfile = staff?._id === id;
  const update = (fields) => setForm((prev) => ({ ...prev, ...fields }));
  const [bankAccount, setBankAccount] = useState(null);
  const hasBankAccount = !!bankAccount;
  const payoutRef = useRef(null);

  const openPayoutSetup = () => {
    setShowPayoutForm(true);
    payoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startEditPayout = () => {
    setPayoutBank(bankAccount?.account_bank || "");
    setPayoutAccountNumber("");
    setPayoutError("");
    setShowPayoutForm(true);
  };

  const cancelPayoutForm = () => {
    setShowPayoutForm(false);
    setPayoutAccountNumber("");
    setPayoutError("");
  };


  useEffect(() => {
    if (!isOwnProfile) return;
    api
      .get("/api/payment/staff/bank-account")
      .then((res) => setBankAccount(res.data.bankAccount))
      .catch((err) => console.log(err));
  }, [isOwnProfile]);

  useEffect(() => {
    if (loading) return; // the page only renders after loading finishes
    if (location.state?.focus === "payout" && !hasBankAccount) {
      setShowPayoutForm(true);
      payoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (!showPayoutForm || banks.length > 0) return;
    const fetchBanks = async () => {
      try {
        const res = await api.get("/api/payment/banks");
        setBanks(res.data.banks || []);
      } catch (err) {
        console.log(err);
        setPayoutError("Couldn't load bank list.");
      }
    };
    fetchBanks();
  }, [showPayoutForm]); // eslint-disable-line react-hooks/exhaustive-deps



  // ── Guard: only the staff member themselves can edit this page ──
  useEffect(() => {
    if (staff && !isOwnProfile) {
      navigate(`/staffprofile/${id}`);
    }
  }, [staff, isOwnProfile, id, navigate]);

  // ── Load current staff data ──
  useEffect(() => {
    if (!id) return;

    const fetchStaff = async () => {
      try {
        const res = await api.get(`/api/staff/${id}`);
        const s = res.data;

        update({
          username: s.username || "",
          displayName: s.displayName || "",
          firstName: s.firstName || "",
          lastName: s.lastName || "",
          phone: s.phone || "",
          desc: s.desc || "",
          location: s.location?.address || "",
          specialties: (s.specialties || []).join(", "),
          roles: s.roles || [],
          workDays: s.workDays || [],
          schedule: s.schedule || {},
          workType: s.workType || "stationed",
          profilePicture: s.profilePicture || "",
          coverPicture: s.coverPicture?.length === 3 ? s.coverPicture : ["", "", ""],
          flutterwave: s.flutterwave || { subaccountId: null, subaccountStatus: "not_connected" },   // ← add this line
        });
      } catch (err) {
        console.log(err);
        setError("Couldn't load your profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [id]);

  // ── Load saved location-sharing preference for this staffer ──
  useEffect(() => {
    if (!id) return;
    setLocationSharing(localStorage.getItem(`liveLocationSharing:${id}`) === "true");
  }, [id]);

  // ── Homepage services (for role selection) — fetch + live updates ──
  useEffect(() => {
    const fetchHomepageServices = async () => {
      try {
        const res = await api.get("/api/homepage-services");
        setHomepageServices(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.log(err);
      }
    };
    fetchHomepageServices();
  }, []);

  useEffect(() => {
      const handleUpdate = ({ action, service }) => {
          setHomepageServices((prev) => {
              if (action === "add") return [service, ...prev];
              if (action === "update")
                  return prev.map((s) =>
                      s._id === service._id ? service : s
                  );
              if (action === "delete")
                  return prev.filter((s) => s._id !== service._id);
              return prev;
          });
      };

      socket.on("homepageServiceUpdate", handleUpdate);

      return () => socket.off("homepageServiceUpdate", handleUpdate);
  }, []);

  // ── Live GPS sharing: start/stop a geolocation watch when toggled ──
  useEffect(() => {
    if (!id) return;
    localStorage.setItem(`liveLocationSharing:${id}`, String(locationSharing));

    const stopWatch = () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    if (!locationSharing) {
      stopWatch();
      setLocationStatus("");
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocationStatus("Your browser doesn't support location sharing.");
      setLocationSharing(false);
      return;
    }

    const sendLocation = async (lat, lng) => {
      try {
        await api.put(`/api/staff/${id}/location`, { lat, lng });
        setLocationStatus(`Live — last updated ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.log(err);
        setLocationStatus("Couldn't update your location. Retrying…");
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        console.log(err);
        setLocationStatus(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — enable it in your browser settings."
            : "Couldn't get your location."
        );
        setLocationSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    return stopWatch;
  }, [locationSharing, id]);

  // If they switch away from "mobile", stop sharing — the toggle UI
  // disappears, so a background watch running silently would be
  // surprising (and would keep publishing GPS data with no visible
  // control on screen).
  useEffect(() => {
    if (form.workType !== "mobile" && locationSharing) {
      setLocationSharing(false);
    }
  }, [form.workType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectPayout = async () => {
    setPayoutError("");
    if (!payoutBank || !payoutAccountNumber) {
      setPayoutError("Select your bank and enter your account number.");
      return;
    }
    setConnectingPayout(true);
    try {
      const res = await api.post("/api/payment/staff/bank-account", {
        account_bank: payoutBank,
        account_number: payoutAccountNumber,
      });
      setBankAccount({
        account_name: res.data.account_name,
        account_bank: payoutBank,
        last4: payoutAccountNumber.slice(-4),
      });
      setShowPayoutForm(false);
      setPayoutAccountNumber("");
    } catch (err) {
      console.log(err);
      setPayoutError(err.response?.data?.message || "Couldn't save your account. Try again.");
    } finally {
      setConnectingPayout(false);
    }
  };

  const toggleRole = (roleName) => {
    const has = form.roles.includes(roleName);
    update({ roles: has ? form.roles.filter((r) => r !== roleName) : [...form.roles, roleName] });
  };

  const toggleDay = (day) => {
    const has = form.workDays.includes(day);
    update({ workDays: has ? form.workDays.filter((d) => d !== day) : [...form.workDays, day] });
  };

  const toggleScheduleDay = (day) => {
    const isOn = !!form.schedule?.[day];
    const updated = { ...form.schedule };
    updated[day] = isOn ? null : { startTime: "09:00", endTime: "18:00", slotDuration: "45", maxBookings: "12" };
    update({ schedule: updated });
  };

  const updateScheduleField = (day, field, value) => {
    update({
      schedule: {
        ...form.schedule,
        [day]: { ...form.schedule[day], [field]: value },
      },
    });
  };

  const handleProfileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingProfile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const imageUrl = res.data.url;
      update({ profilePicture: imageUrl });

      // Persist immediately instead of waiting for "Save Changes"
      await api.put(`/api/staff/${id}`, {
        profilePicture: imageUrl,
        userId: id,
        userid: id, // matches the exact casing your PUT route checks
      });

      // Keep StaffAuthContext (and therefore the Topbar) in sync
      dispatch({ type: "UPDATE_STAFF", payload: { profilePicture: imageUrl } });
    } catch (err) {
      console.log(err);
      setError("Profile photo upload failed.");
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleCoverUpload = (index) => async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingCover(index);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updated = [...form.coverPicture];
      updated[index] = res.data.url;
      update({ coverPicture: updated });
    } catch (err) {
      console.log(err);
      setError("Cover photo upload failed.");
    } finally {
      setUploadingCover(null);
    }
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);

    try {
      await api.put(`/api/staff/${id}`, {
        username: form.username,
        displayName: form.displayName,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        desc: form.desc,
        location: { address: form.location },
        specialties: form.specialties.split(",").map((s) => s.trim()).filter(Boolean),
        roles: form.roles,
        workDays: form.workDays,
        schedule: form.schedule,
        workType: form.workType,
        profilePicture: form.profilePicture,
        coverPicture: form.coverPicture,
        userId: id,
        userid: id, // staff PUT route checks this exact casing
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.log(err);
      setError("Couldn't save changes. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <h2 className="ss-loading">Loading settings...</h2>;

  return (
    <div className="ss-page">
      <div className="btnAndText">
        <button
          className="STFSETBackbtn"
          onClick={() =>
            navigate(-1)
          }
        >
          <ChevronLeftIcon />
        </button>
      </div>
      <h2 className="ss-title">Edit Profile</h2>
 

     

      {/* ── Photos ── */}
      <div className="ss-section">
        <p className="ss-section-label">Photos</p>
        <div className="ss-cover-grid">
          {[0, 1, 2].map((i) => (
            <div className="ss-cover-wrap" key={i}>
              <img
                src={form.coverPicture[i] || "/assets/person/noCover.png"}
                alt=""
                className="ss-cover-preview"
              />
              <label className="ss-upload-btn ss-cover-btn">
                {uploadingCover === i ? "Uploading..." : "Change"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleCoverUpload(i)}
                />
              </label>
            </div>
          ))}
        </div>
      </div>
      {/* ── Profile Picture ── */}
      <div className="ss-section">
        <p className="ss-section-label">Profile Picture</p>
        <div className="ss-profile-pic-wrap">
          <img
            src={form.profilePicture ? form.profilePicture : "/assets/person/noAvatar.png"}
            alt=""
            className="ss-profile-pic-preview"
          />
          <label className="ss-upload-btn">
            {uploadingProfile ? "Uploading..." : "Change"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleProfileUpload}
            />
          </label>
        </div>
      </div>

      {/* ── Identity ── */}
      <div className="ss-section">
        <p className="ss-section-label">Identity</p>

        <div className="ss-field">
          <label>Username</label>
          <input
            value={form.username}
            onChange={(e) => update({ username: e.target.value.toLowerCase().replace(/\s/g, "") })}
          />
        </div>

        <div className="ss-field">
          <label>Display Name</label>
          <input
            value={form.displayName}
            onChange={(e) => update({ displayName: e.target.value })}
            placeholder="Shown publicly next to your @username"
          />
        </div>

        <div className="ss-field-row">
          <div className="ss-field">
            <label>First Name</label>
            <input value={form.firstName} onChange={(e) => update({ firstName: e.target.value })} />
            <span className="ss-hint">Internal only — not shown on your public profile</span>
          </div>
          <div className="ss-field">
            <label>Last Name</label>
            <input value={form.lastName} onChange={(e) => update({ lastName: e.target.value })} />
          </div>
        </div>

        <div className="ss-field">
          <label>Phone</label>
          <input value={form.phone} onChange={(e) => update({ phone: e.target.value })} />
        </div>
      </div>

      <div className="ss-section" ref={payoutRef}>
        <p className="ss-section-label">Payments &amp; Payouts</p>

        {hasBankAccount && !showPayoutForm ? (
          <div className="ss-payout-connected">
            <p className="ss-payout-status">✓ Payout account connected</p>
            <p className="ss-hint">
              {bankAccount.account_name} •••• {bankAccount.last4}
            </p>
            <button type="button" className="ss-btn-payout" onClick={startEditPayout}>
              Edit account
            </button>
          </div>
        ) : !showPayoutForm ? (
          <>
            <p className="ss-hint">Add your bank account so you can receive payment for your services.</p>
            <button type="button" className="ss-btn-payout" onClick={openPayoutSetup}>
              Add bank account
            </button>
          </>
        ) : (
          <div className="ss-payout-form">
            <div className="ss-field">
              <label>Bank</label>
              <select value={payoutBank} onChange={(e) => setPayoutBank(e.target.value)}>
                <option value="">Select your bank</option>
                {banks.map((b, i) => (
                  <option key={`${b.code}-${i}`} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="ss-field">
              <label>Account Number</label>
              <input
                value={payoutAccountNumber}
                onChange={(e) => setPayoutAccountNumber(e.target.value.replace(/\D/g, ""))}
                maxLength={10}
                placeholder="0123456789"
              />
            </div>
            {hasBankAccount && (
              <p className="ss-hint">Saving replaces your current account ({bankAccount.account_name} •••• {bankAccount.last4}).</p>
            )}
            {payoutError && <p className="ss-error">{payoutError}</p>}
            <div className="ss-payout-form-actions">
              <button type="button" className="ss-btn-payout" onClick={handleConnectPayout} disabled={connectingPayout}>
                {connectingPayout ? "Saving..." : hasBankAccount ? "Save changes" : "Save account"}
              </button>
              <button type="button" className="ss-btn-cancel" onClick={cancelPayoutForm}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>


      {/* ── Work Type ── */}
      <div className="ss-section">
        <p className="ss-section-label">Work Type</p>
        <p className="ss-hint">Are you a mobile barber or do you work from a fixed location?</p>

        <div className="ss-worktype-grid">
          <button
            type="button"
            className={`ss-worktype-card ${form.workType === "mobile" ? "ss-worktype-card--on" : ""}`}
            onClick={() => update({ workType: "mobile" })}
          >
            🚗 Mobile
          </button>
          <button
            type="button"
            className={`ss-worktype-card ${form.workType === "stationed" ? "ss-worktype-card--on" : ""}`}
            onClick={() => update({ workType: "stationed" })}
          >
            ✂ Stationed
          </button>
        </div>

        {form.workType === "mobile" && (
          <div className="ss-location-toggle">
            <button
              type="button"
              className={`ss-toggle-btn ${locationSharing ? "ss-toggle-btn--on" : ""}`}
              onClick={() => setLocationSharing((v) => !v)}
            >
              📍 {locationSharing ? "Live location: ON" : "Live location: OFF"}
            </button>
            {locationStatus && <p className="ss-hint">{locationStatus}</p>}
            <p className="ss-hint">
              While this is on, your device shares its live GPS position so clients can see you on the map.
              Turn it off any time.
            </p>
          </div>
        )}
      </div>

      {/* ── Profile ── */}
      <div className="ss-section">
        <p className="ss-section-label">Profile</p>

        <div className="ss-field">
          <label>Bio</label>
          <textarea value={form.desc} onChange={(e) => update({ desc: e.target.value })} rows={3} />
        </div>

        {form.workType !== "mobile" && (
          <div className="ss-field">
            <label>Location</label>
            <input
              value={form.location}
              onChange={(e) => update({ location: e.target.value })}
              placeholder="e.g. 14 Bode Thomas St, Surulere, Lagos"
            />
            <span className="ss-hint">Your fixed shop address — shown to clients and used to place you on the map</span>
          </div>
        )}

        <div className="ss-field">
          <label>Specialties</label>
          <textarea
            value={form.specialties}
            onChange={(e) => update({ specialties: e.target.value })}
            rows={3}
            placeholder="Separate with commas"
          />
        </div>
      </div>

      {/* ── Roles ── */}
      <div className="ss-section">
        <p className="ss-section-label">Roles</p>
        <p className="ss-hint">Select every service you offer</p>

        {homepageServices.length === 0 ? (
          <p className="ss-hint">No services set up yet.</p>
        ) : (
          <div className="ss-chip-grid">
            {homepageServices.map((s) => (
              <button
                key={s._id}
                type="button"
                className={`ss-chip ${form.roles.includes(s.name) ? "ss-chip--on" : ""}`}
                onClick={() => toggleRole(s.name)}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Working Days ── */}
      <div className="ss-section">
        <p className="ss-section-label">Working Days</p>
        <div className="ss-chip-grid">
          {Object.entries(DAY_SHORT).map(([full, short]) => (
            <button
              key={full}
              type="button"
              className={`ss-chip ${form.workDays.includes(short) ? "ss-chip--on" : ""}`}
              onClick={() => toggleDay(short)}
            >
              {short}
            </button>
          ))}
        </div>
      </div>

      {/* ── Schedule (hours) ── */}
      <div className="ss-section">
        <p className="ss-section-label">Hours</p>
        <p className="ss-hint">Set your hours for each day you work — leave a day off to mark it unavailable</p>

        {DAYS.map((day) => {
          const dayData = form.schedule?.[day];
          const isOn = !!dayData;

          return (
            <div key={day} className="ss-day-row">
              <div className="ss-day-toggle">
                <button
                  type="button"
                  className={`ss-day-chip ${isOn ? "ss-day-chip--on" : ""}`}
                  onClick={() => toggleScheduleDay(day)}
                >
                  {day.slice(0, 2)}
                </button>
                <span className="ss-day-label">{day}</span>
              </div>

              {isOn ? (
                <div className="ss-day-times">
                  <input
                    type="time"
                    value={dayData.startTime}
                    onChange={(e) => updateScheduleField(day, "startTime", e.target.value)}
                  />
                  <span>—</span>
                  <input
                    type="time"
                    value={dayData.endTime}
                    onChange={(e) => updateScheduleField(day, "endTime", e.target.value)}
                  />
                  <label>Booking Interval</label>
                  <select
                      value={dayData.slotDuration}
                      onChange={(e)=>
                          updateScheduleField(
                              day,
                              "slotDuration",
                              Number(e.target.value)
                          )
                      }
                  >

                    <option value={5}>5 mins</option>

                    <option value={10}>10 mins</option>

                    <option value={15}>15 mins</option>

                    <option value={20}>20 mins</option>

                    <option value={30}>30 mins</option>

                  </select>
                  <label>Maximum Bookings</label>
                  <input
                    type="number"
                    min="1"
                    className="ss-max-bookings"
                    value={dayData.maxBookings}
                    onChange={(e) => updateScheduleField(day, "maxBookings", Number(e.target.value))}
                    placeholder="Max/day"
                  />
                </div>
              ) : (
                <span className="ss-day-off">Unavailable</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="ss-footer">
        <button className="ss-btn-save" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save Changes"}
        </button>
        <button className="ss-btn-cancel" onClick={() => navigate(`/staffprofile/${id}`)}>
          Cancel
        </button>
      </div>
    </div>
  );
}