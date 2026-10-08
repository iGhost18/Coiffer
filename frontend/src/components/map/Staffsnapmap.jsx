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

const LIGHT_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const RADIUS_OPTIONS = [1, 3, 10, 25, 999999];
const DEFAULT_AVATAR = "/assets/person/noAvatar.png";
const MOBILE_BREAKPOINT = 760;

function handleAvatarError(e) {
  e.currentTarget.onerror = null;
  e.currentTarget.src = DEFAULT_AVATAR;
}

/* ---------- Marker icon builders ---------- */
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
  const safeName = escapeHtml(person.username);
  const safePhoto = escapeHtml(person.photoUrl);
  return L.divIcon({
    className: "",
    html: `
      <div class="staff-pin ${person.online ? "" : "offline"}">
        <div class="ring">
          <img src="${safePhoto}" alt="${safeName}" />
        </div>
      </div>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    popupAnchor: [0, -22],
  });
}

/* ---------- Map helpers ---------- */
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

// offsetY (px) shifts the marker upward on screen so it isn't hidden
// behind the mobile bottom sheet.
function FlyToActive({ activeStaff, offsetY = 0 }) {
  const map = useMap();

  useEffect(() => {
    if (!activeStaff) return;
    const zoom = 14;
    const target = map
      .project([activeStaff.lat, activeStaff.lng], zoom)
      .add([0, offsetY]);
    map.flyTo(map.unproject(target, zoom), zoom, { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStaff, map]);

  return null;
}

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

function InvalidateSizeOnResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    map.invalidateSize();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

/* ---------- Live status ---------- */
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

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}

/* ---------- Shared pieces ---------- */
function StaffCard({ p, active, onSelect }) {
  const located = p.hasLocation;
  return (
    <div
      className={`staff-card ${active ? "active" : ""} ${located ? "" : "unlocated"}`}
      onClick={located ? () => onSelect(p._id) : undefined}
      title={located ? undefined : "No location on file yet"}
    >
      <div className="avatar-wrap">
        <div className={`status-ring ${p.online ? "" : "offline"}`} />
        <img src={p.photoUrl} alt={p.username} onError={handleAvatarError} />
        <div className={`status-dot ${p.online ? "" : "offline"}`} />
      </div>
      <div className="staff-info">
        <div className="name">{p.username}</div>
        <div className="service">{p.role}</div>
        <div className="meta">
          <span>{p.online ? "🟢 Online" : "⚪ Offline"}</span>
          {located && p.dist != null && (
            <>
              <span>·</span>
              <span className="dist">{p.dist.toFixed(1)} km</span>
            </>
          )}
          {!located && (
            <>
              <span>·</span>
              <span className="dist">📍 Location unavailable</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StaffActions({ p, userPos }) {
  return (
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
  );
}

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/* ---------- Main component ---------- */
export default function StaffSnapMap({ showBackButton = true, embedded = false }) {
  const { position: userPos, accurate, status: gpsStatus } = useGeolocation();
  const [rawStaff, setRawStaff] = useState([]);
  const [staff] = useLiveStaff(rawStaff);

  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(999999);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [recenterTick, setRecenterTick] = useState(0);
  const [sheet, setSheet] = useState("peek"); // mobile: "peek" | "open"
  const touchY = useRef(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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

  const { located, unlocated } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesCommon = (p) => {
      const matchesQuery =
        !q ||
        p.username.toLowerCase().includes(q) ||
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

  const selectStaff = (id) => {
    setActiveId(id);
    setSheet("peek"); // show the preview card, map flies to the pin
  };

  const onHandleTouchStart = (e) => {
    touchY.current = e.touches[0].clientY;
  };
  const onHandleTouchEnd = (e) => {
    if (touchY.current == null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchY.current = null;
    if (dy < -30) setSheet("open");
    else if (dy > 30) setSheet("peek");
  };

  if (!userPos) {
    return (
      <div className="staff-snap-map loading-screen">
        <div className="dot pulse-dot" />
        <p>{gpsStatus}</p>
      </div>
    );
  }

  const mapNode = (
    <MapContainer
      center={[userPos.lat, userPos.lng]}
      zoom={12}
      zoomControl={!isMobile}
      attributionControl={!isMobile}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer url={LIGHT_TILES} attribution="&copy; OpenStreetMap contributors" maxZoom={19} />
      <InvalidateSizeOnResize />
      <RecenterOnFirstFix position={userPos} />
      <RecenterOnDemand position={userPos} trigger={recenterTick} />
      <FlyToActive activeStaff={activeStaff} offsetY={isMobile ? 90 : 0} />

      <Marker position={[userPos.lat, userPos.lng]} icon={userIcon(accurate)} zIndexOffset={1000} />

      {located.map((p) => (
        <Marker
          key={p._id}
          position={[p.lat, p.lng]}
          icon={staffIcon(p)}
          eventHandlers={{ click: () => selectStaff(p._id) }}
        >
          {/* On mobile the preview lives in the bottom sheet instead */}
          {!isMobile && (
            <Popup minWidth={220} maxWidth={260}>
              <div className="popup-head">
                <img src={p.photoUrl} alt={p.username} onError={handleAvatarError} />
                <div>
                  <div className="name">{p.username}</div>
                  <div className="service">{p.role}</div>
                </div>
              </div>

              <div className="popup-status">
                <div
                  className="dot"
                  style={{ background: p.online ? "var(--live)" : "var(--offline)" }}
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

              <StaffActions p={p} userPos={userPos} />
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  );

  /* ================= MOBILE ================= */
  if (isMobile) {
    return (
      <div className={`staff-snap-map mobile ${embedded ? "embedded-map" : "full-map"}`}>
        <div id="map-wrap">{mapNode}</div>

        <div className="m-top">
          <div className="m-search-row">
            {showBackButton && (
              <button className="m-icon-btn" onClick={() => navigate(-1)} aria-label="Go back">
                <ChevronLeftIcon />
              </button>
            )}
            <div className="m-search">
              <SearchIcon />
              <input
                type="search"
                placeholder="Search barber or service…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="m-chips">
            <button
              type="button"
              className={`m-chip ${onlineOnly ? "on" : ""}`}
              onClick={() => setOnlineOnly((v) => !v)}
            >
              🟢 Online
            </button>
            {RADIUS_OPTIONS.map((r) => (
              <button
                type="button"
                key={r}
                className={`m-chip ${radius === r ? "on" : ""}`}
                onClick={() => setRadius(r)}
              >
                {r >= 999999 ? "Any distance" : `${r} km`}
              </button>
            ))}
          </div>
        </div>

        <div className={`m-sheet ${sheet} ${activeStaff ? "has-active" : ""}`}>
          <button
            type="button"
            className="m-locate"
            onClick={() => setRecenterTick((t) => t + 1)}
            aria-label="Center on my location"
            title={gpsStatus}
          >
            📍
          </button>

          <div
            className="m-handle"
            role="button"
            tabIndex={0}
            aria-label={sheet === "open" ? "Collapse list" : "Expand list"}
            onClick={() => setSheet((s) => (s === "open" ? "peek" : "open"))}
            onTouchStart={onHandleTouchStart}
            onTouchEnd={onHandleTouchEnd}
          >
            <span />
          </div>

          <div className="m-sheet-head">
            <span>
              <b>{located.length}</b> nearby · <b>{onlineCount}</b> online
            </span>
            <span className="m-attrib">© OpenStreetMap</span>
          </div>

          <div className="m-sheet-body">
            {sheet === "peek" ? (
              activeStaff ? (
                <div className="m-preview">
                  <button
                    type="button"
                    className="m-preview-close"
                    onClick={() => setActiveId(null)}
                    aria-label="Close preview"
                  >
                    ✕
                  </button>
                  <StaffCard p={activeStaff} active={false} onSelect={() => {}} />
                  <StaffActions p={activeStaff} userPos={userPos} />
                </div>
              ) : (
                <p className="m-hint">Tap a pin, or swipe up to see the list</p>
              )
            ) : (
              <div id="list">
                {located.length === 0 && unlocated.length === 0 ? (
                  <div className="empty-state">
                    No Expert match that search / radius.
                    <br />
                    Try widening the radius or clearing the search.
                  </div>
                ) : (
                  <>
                    {located.map((p) => (
                      <StaffCard key={p._id} p={p} active={p._id === activeId} onSelect={selectStaff} />
                    ))}
                    {unlocated.length > 0 && (
                      <>
                        <div className="list-subheader">
                          Location unavailable ({unlocated.length})
                        </div>
                        {unlocated.map((p) => (
                          <StaffCard key={p._id} p={p} active={false} onSelect={() => {}} />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ================= DESKTOP / TABLET (unchanged layout) ================= */
  return (
    <div className={`staff-snap-map ${embedded ? "embedded-map" : "full-map"}`}>
      <div className="app-grid">
        <aside id="sidebar">
          <div className="brand">
            {showBackButton && (
              <button className="header-btn ProfileBackBtn" onClick={() => navigate(-1)}>
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
              <SearchIcon />
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
                <option value="all">All Expert</option>
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
                No Expert match that search / radius.
                <br />
                Try widening the radius or clearing the search.
              </div>
            ) : (
              <>
                {located.map((p) => (
                  <StaffCard key={p._id} p={p} active={p._id === activeId} onSelect={selectStaff} />
                ))}

                {unlocated.length > 0 && (
                  <>
                    <div className="list-subheader">
                      Location unavailable ({unlocated.length})
                    </div>
                    {unlocated.map((p) => (
                      <StaffCard key={p._id} p={p} active={false} onSelect={() => {}} />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </aside>

        <div id="map-wrap">{mapNode}</div>
      </div>
    </div>
  );
}