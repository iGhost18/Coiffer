import { useState } from "react";
import "./captionmodal.css";

export default function CaptionModal({ previewUrl, isVideo, onCancel, onConfirm, posting }) {
  const [caption, setCaption] = useState("");

  return (
    <div className="CaptionModalOverlay" onClick={onCancel}>
      <div className="CaptionModalCard" onClick={(e) => e.stopPropagation()}>
        <div className="CaptionModalPreview">
          {isVideo ? (
            <video src={previewUrl} className="CaptionModalMedia" muted autoPlay loop playsInline />
          ) : (
            <img src={previewUrl} alt="" className="CaptionModalMedia" />
          )}
          <div className="CaptionModalScrim" />

          <textarea
                className="CaptionModalInput"
                placeholder="Add a caption…"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={300}
                rows={2}
                autoFocus
          />
        </div>

        <div className="CaptionModalActions">
          <button className="CaptionModalCancel" onClick={onCancel} disabled={posting}>
            Cancel
          </button>
          <button
            className="CaptionModalPost"
            onClick={() => onConfirm(caption.trim())}
            disabled={posting}
          >
            {posting ? "Posting…" : "Share to Story"}
          </button>
        </div>
      </div>
    </div>
  );
}