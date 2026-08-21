import { useEffect, useRef, useState } from "react";

// Fallback center used if GPS is unavailable or denied (Lagos, NG).
const FALLBACK = { lat: 6.5244, lng: 3.3792 };

/**
 * Tracks the user's live GPS position with navigator.geolocation.watchPosition.
 * Falls back to a fixed point if permission is denied or GPS isn't available.
 */
export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [accurate, setAccurate] = useState(false);
  const [status, setStatus] = useState("Locating you…");
  const watchId = useRef(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStatus("GPS unavailable — using default");
      setPosition(FALLBACK);
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccurate(true);
        setStatus("Live GPS active");
      },
      () => {
        setStatus("Location denied — using default");
        setPosition(FALLBACK);
        setAccurate(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  return { position, accurate, status };
}