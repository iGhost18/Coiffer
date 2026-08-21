import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./staffsnapmap.css";

import { useGeolocation } from "../../Usegeolocation";
import { fetchStaff } from "../../data/Staffapi";
import { distanceKm, directionsUrl } from "../../Distance";
import { Link, useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import socket from "../../socket";

// import api from "./api"; // adjust path to your api.js

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const RADIUS_OPTIONS = [1, 3, 10, 25, 999999];
const DEFAULT_AVATAR = "/assets/person/noAvatar.png"; // same fallback used in StaffSettings.jsx



// Shared onError handler for <img> avatars — falls back to the default
// avatar if a stored photoUrl 404s or otherwise fails to load, not just
// when it's empty. onerror is cleared first so a broken default avatar
// can't trigger an infinite retry loop.
function handleAvatarError(e) {
  e.currentTarget.onerror = null;
  e.currentTarget.src = DEFAULT_AVATAR;
}

/* ---------------------------------------------------------------------
   Marker icon builders (Leaflet divIcons, styled via CSS classes)
   --------------------------------------------------------------------- */
function userIcon(accurate) {
  return L.divIcon({
    className: "",
    html: `<div class="me-marker ${accurate ? "pulse" : ""}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function staffIcon(person) {
  const safeName = escapeHtml(person.name);
  const safePhoto = escapeHtml(person.photoUrl);
  return L.divIcon({
    className: "",
    html: `
      <div class="staff-pin ${person.online ? "" : "offline"}">
        <div class="ring">
          <img src="${safePhoto}" alt="${safeName}" />
          <div class="dot"></div>
        </div>
      </div>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    popupAnchor: [0, -22],
  });
}

/* ---------------------------------------------------------------------
   Small helper components that need access to the Leaflet map instance
   --------------------------------------------------------------------- */
function RecenterOnFirstFix({ position }) {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (position && !hasCentered.current) {
      map.setView([position.lat, position.lng], 12);
      hasCentered.current = true;
    }
  }, [position, map]);

  return null;
}

function FlyToActive({ activeStaff }) {
  const map = useMap();

  useEffect(() => {
    if (activeStaff) {
      map.flyTo([activeStaff.lat, activeStaff.lng], 14, { duration: 0.6 });
    }
  }, [activeStaff, map]);

  return null;
}

// Flies to the user's own position on demand (button click), rather than
// only on first GPS fix. `trigger` is a click counter — using a counter
// instead of a boolean means clicking twice in a row (already centered)
// still re-triggers the effect.
function RecenterOnDemand({ position, trigger }) {
  const map = useMap();

  useEffect(() => {
    if (trigger > 0 && position) {
      map.flyTo([position.lat, position.lng], 15, { duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return null;
}

/* ---------------------------------------------------------------------
   Live status via WebSocket, backed by a MongoDB change stream server
   side (see src/api/staffApi.js).
   --------------------------------------------------------------------- */
function useLiveStaff(initialStaff) {
  const [staff, setStaff] = useState(initialStaff);
  const [onlineIds, setOnlineIds] = useState(new Set());

  useEffect(() => {
    setStaff(initialStaff);
  }, [initialStaff]);

  useEffect(() => {
    const handleGetUsers = (onlineUsers) => {
      setOnlineIds(new Set(onlineUsers.map((u) => String(u.userId))));
    };

    const requestOnlineUsers = () => socket.emit("requestOnlineUsers");

    socket.on("getUsers", handleGetUsers);
    // Fires immediately if already connected, and again on every
    // (re)connect — fixes the case where the socket isn't connected
    // yet at mount time and the first request gets dropped.
    socket.on("connect", requestOnlineUsers);
    if (socket.connected) requestOnlineUsers();

    return () => {
      socket.off("getUsers", handleGetUsers);
      socket.off("connect", requestOnlineUsers);
    };
  }, []);

  const liveStaff = staff.map((p) => ({
    ...p,
    online: onlineIds.has(String(p._id)),
  }));

  return [liveStaff, setStaff];
}

/* ---------------------------------------------------------------------
   Main component
   --------------------------------------------------------------------- */
export default function StaffSnapMap({ showBackButton = true }) {
  const { position: userPos, accurate, status: gpsStatus } = useGeolocation();
  const [rawStaff, setRawStaff] = useState([]);
  const [staff] = useLiveStaff(rawStaff);

  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(999999);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [recenterTick, setRecenterTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const data = await fetchStaff();
        setRawStaff(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setRawStaff([]);
      }
    };
    loadStaff();
  }, []);

  const withDistance = useMemo(() => {
    return staff.map((p) => {
      // Number(null) is 0, not NaN, so we check for null/undefined
      // BEFORE coercing — otherwise a missing location silently becomes
      // (0, 0), a real point off the coast of Africa ("Null Island").
      const lat = p.lat != null ? Number(p.lat) : null;
      const lng = p.lng != null ? Number(p.lng) : null;
      const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);

      return {
        ...p,
        lat,
        lng,
        hasLocation,
        photoUrl: p.photoUrl || DEFAULT_AVATAR,
        dist: hasLocation && userPos ? distanceKm(userPos.lat, userPos.lng, lat, lng) : null,
      };
    });
  }, [staff, userPos]);

  // Staff are split into two groups instead of just dropping the ones
  // with no location: "located" drive the map + main list, "unlocated"
  // still show up (so it's obvious who's missing, and why) but never
  // get plotted on the map or given a fake distance.
  const { located, unlocated } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesCommon = (p) => {
      const matchesQuery = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.role || "").toLowerCase().includes(q);
      const matchesStatus = !onlineOnly || p.online;
      return matchesQuery && matchesStatus;
    };

    const located = withDistance
      .filter((p) => p.hasLocation && matchesCommon(p) && (p.dist == null || p.dist <= radius))
      .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

    const unlocated = withDistance.filter((p) => !p.hasLocation && matchesCommon(p));

    return { located, unlocated };
  }, [withDistance, query, radius, onlineOnly]);

  const activeStaff = located.find((p) => p._id === activeId) || null;
  const onlineCount = staff.filter((p) => p.online).length;
  const offlineCount = staff.length - onlineCount;

  if (!userPos) {
    // Waiting on first GPS fix / fallback before mounting the map.
    return (
      <div className="staff-snap-map loading-screen">
        <div className="dot pulse-dot" />
        <p>{gpsStatus}</p>
      </div>
    );
  }

  return (
    <div className="staff-snap-map">
      <div className="app-grid">
        <aside id="sidebar">
          <div className="brand">
            {showBackButton && (
                <button
                  className="header-btn ProfileBackBtn"
                  onClick={() => navigate(-1)}
                >
                  <ChevronLeftIcon />
                </button>
              )}

            <div className="dot"></div>

            <div className="brand-text">
              <h1>Map</h1>
              <span>Live team locations, right now</span>
            </div>
          </div>

          <div className="controls">
            <div className="search-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search barber or service…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="row-controls">
              <select value={radius} onChange={(e) => setRadius(parseFloat(e.target.value))}>
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r >= 999999 ? "Any distance" : `Within ${r} km`}
                  </option>
                ))}
              </select>
              <select
                value={onlineOnly ? "online" : "all"}
                onChange={(e) => setOnlineOnly(e.target.value === "online")}
              >
                <option value="all">All staff</option>
                <option value="online">Online only</option>
              </select>
            </div>

            <button
              type="button"
              className="locate-btn"
              onClick={() => setRecenterTick((t) => t + 1)}
              title="Center the map on your location"
            >
              📍 <span>{gpsStatus}</span>
            </button>
          </div>

          <div className="stat-strip">
            <div className="pill">
              <div className="dot" style={{ background: "var(--live)" }} />
              <b>{onlineCount}</b>&nbsp;online
            </div>
            <div className="pill">
              <div className="dot" style={{ background: "var(--offline)" }} />
              <b>{offlineCount}</b>&nbsp;offline
            </div>
            <div className="pill">
              <b>{located.length}</b>&nbsp;shown
            </div>
          </div>

          <div id="list">
            {located.length === 0 && unlocated.length === 0 ? (
              <div className="empty-state">
                No staff match that search / radius.
                <br />
                Try widening the radius or clearing the search.
              </div>
            ) : (
              <>
                {located.map((p) => (
                  <div
                    key={p._id}
                    className={`staff-card ${p._id === activeId ? "active" : ""}`}
                    onClick={() => setActiveId(p._id)}
                  >
                    <div className="avatar-wrap">
                      <div className={`status-ring ${p.online ? "" : "offline"}`} />
                      <img src={p.photoUrl} alt={p.name} onError={handleAvatarError} />
                      <div className={`status-dot ${p.online ? "" : "offline"}`} />
                    </div>
                    <div className="staff-info">
                      <div className="name">{p.name}</div>
                      <div className="service">{p.role}</div>
                      <div className="meta">
                        <span>{p.online ? "🟢 Online" : "⚪ Offline"}</span>
                        {p.dist != null && (
                          <>
                            <span>·</span>
                            <span className="dist">{p.dist.toFixed(1)} km</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {unlocated.length > 0 && (
                  <>
                    <div className="list-subheader">
                      Location unavailable ({unlocated.length})
                    </div>
                    {unlocated.map((p) => (
                      <div key={p._id} className="staff-card unlocated" title="No location on file yet">
                        <div className="avatar-wrap">
                          <div className={`status-ring ${p.online ? "" : "offline"}`} />
                          <img src={p.photoUrl} alt={p.name} onError={handleAvatarError} />
                          <div className={`status-dot ${p.online ? "" : "offline"}`} />
                        </div>
                        <div className="staff-info">
                          <div className="name">{p.name}</div>
                          <div className="service">{p.role}</div>
                          <div className="meta">
                            <span>{p.online ? "🟢 Online" : "⚪ Offline"}</span>
                            <span>·</span>
                            <span className="dist">📍 Location unavailable</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </aside>

        <div id="map-wrap">
          <MapContainer center={[userPos.lat, userPos.lng]} zoom={12} zoomControl style={{ width: "100%", height: "100%" }}>
            <TileLayer url={DARK_TILES} attribution="&copy; OpenStreetMap &copy; CARTO" maxZoom={19} />
            <RecenterOnFirstFix position={userPos} />
            <RecenterOnDemand position={userPos} trigger={recenterTick} />
            <FlyToActive activeStaff={activeStaff} />

            <Marker position={[userPos.lat, userPos.lng]} icon={userIcon(accurate)} zIndexOffset={1000} />

            {located.map((p) => (
              <Marker
                key={p._id}
                position={[p.lat, p.lng]}
                icon={staffIcon(p)}
                eventHandlers={{
                  click: () => setActiveId(p._id),
                }}
              >
                <Popup>
                  <div className="popup-head">
                    <img src={p.photoUrl} alt={p.name} onError={handleAvatarError} />
                    <div>
                      <div className="name">{p.name}</div>
                      <div className="service">{p.role}</div>
                    </div>
                  </div>

                  <div className="popup-status">
                    <div
                      className="dot"
                      style={{
                        background: p.online ? "var(--live)" : "var(--offline)",
                      }}
                    />
                    {p.online ? "Online now" : "Offline"}
                  </div>

                  <div className="popup-dist">
                    {p.dist != null ? (
                      <>
                        <b>{p.dist.toFixed(1)} km</b> away
                      </>
                    ) : (
                      "Distance unknown"
                    )}
                  </div>

                  <div className="popup-actions">
                    <Link to={`/staffprofile/${p._id}`} className="profile-btn">
                      👤 View Profile
                    </Link>

                    {p.workType === "stationed" && (
                      <button
                        className="directions-btn"
                        onClick={() => {
                          const win = window.open(directionsUrl(userPos, p.lat, p.lng), "_blank", "noopener,noreferrer");
                          if (win) win.opener = null;
                        }}
                      >
                        🚗 Get Directions
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}