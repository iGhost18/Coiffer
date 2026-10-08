import "./shareProfileModal.css";
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import CloseIcon from "@mui/icons-material/Close";

// Turns "John Doe" into "john-doe" for the downloaded QR filename
const toSlug = (value) =>
  String(value || "profile")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "profile";

export default function ShareProfileModal({ url, name, onClose }) {
  const [copied, setCopied] = useState(false);
  const qrWrapRef = useRef(null);
  const copyTimer = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Close on Escape and lock background scrolling while the modal is open
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(copyTimer.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for browsers/contexts without the Clipboard API
        const el = document.createElement("textarea");
        el.value = url;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }

      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleDownload = () => {
    const canvas = qrWrapRef.current?.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${toSlug(name)}-qr.png`;
    link.click();
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: name,
        text: `Check out ${name}'s profile`,
        url,
      });
    } catch (err) {
      // The user closing the share sheet throws an AbortError. Nothing to do.
    }
  };

  return (
    <div className="spm-overlay" onClick={onClose}>
      <div
        className="spm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="spm-close" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </button>

        <h3 id="spm-title" className="spm-title">
          Share profile
        </h3>
        <p className="spm-sub">{name}</p>

        {/* Rendered at 512px so the downloaded PNG is sharp; shown at 200px */}
        <div className="spm-qr" ref={qrWrapRef}>
          <QRCodeCanvas
            value={url}
            size={512}
            level="M"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#111111"
            style={{ width: 200, height: 200, display: "block" }}
          />
        </div>

        <p className="spm-hint">Scan with a phone camera to open this profile</p>

        <div className="spm-linkrow">
          <input
            className="spm-link"
            value={url}
            readOnly
            aria-label="Profile link"
            onFocus={(e) => e.target.select()}
          />
          <button className="spm-copy" onClick={handleCopy}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>

        <div className="spm-actions">
          <button className="spm-btn" onClick={handleDownload}>
            Download QR
          </button>

          {canNativeShare && (
            <button className="spm-btn spm-btn--primary" onClick={handleNativeShare}>
              Share…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}