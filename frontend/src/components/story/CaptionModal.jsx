import { useState } from "react";
import { MdVolumeUp, MdVolumeOff } from "react-icons/md";
import "./captionmodal.css";

export default function CaptionModal({ previewUrl, isVideo, onCancel, onConfirm, posting }) {
  const [caption, setCaption] = useState("");
  // true = the audio track is removed from the story before it is uploaded
  const [muteAudio, setMuteAudio] = useState(false);

  return (
    <div className="CaptionModalOverlay" onClick={onCancel}>
      <div className="CaptionModalCard" onClick={(e) => e.stopPropagation()}>
        <div className="CaptionModalPreview">
          {isVideo ? (
            <video src={previewUrl} className="CaptionModalMedia" muted={muteAudio} autoPlay loop playsInline onClick={(e) => (e.target.paused ? e.target.play() : e.target.pause())} />
          ) : (
            <img src={previewUrl} alt="" className="CaptionModalMedia" />
          )}
          <div className="CaptionModalScrim" />

          {isVideo && (
            <button
              type="button"
              className={`CaptionModalMute ${muteAudio ? "CaptionModalMute--on" : ""}`}
              onClick={() => setMuteAudio((m) => !m)}
              aria-pressed={muteAudio}
              aria-label={muteAudio ? "Sound removed. Tap to keep sound" : "Sound on. Tap to remove sound"}
            >
              {muteAudio ? <MdVolumeOff /> : <MdVolumeUp />}
              <span>{muteAudio ? "Sound removed" : "Sound on"}</span>
            </button>
          )}

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
            onClick={() => onConfirm(caption.trim(), isVideo && muteAudio)}
            disabled={posting}
          >
            {posting ? "Posting…" : "Share to Story"}
          </button>
        </div>
      </div>
    </div>
  );
}