import { useContext, useEffect, useRef, useState } from "react";
import "./storybar.css";
import api from "../../api";
import { AuthContext } from "../context/AuthContext";
import { StaffAuthContext } from "../context/StaffAuthContext";
import StoryViewer from "./StoryViewer";
import CaptionModal from "./CaptionModal";
import { MdAdd } from "react-icons/md";

const MAX_VIDEO_MB = 100; // same limit as the post composer

export default function StoryBar() {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);
  const currentUser = user || staff;
  const PF = "/assets/";

  const [groups, setGroups] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null); // index into groups, or null
  const fileInputRef = useRef();

  // Background upload state. The caption screen closes the moment you tap
  // Post, and the upload carries on here without blocking the page.
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [failedUpload, setFailedUpload] = useState(null); // { file, isVideo, caption }

  // Pending file staged for the caption modal, before actually uploading
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);
  const [pendingIsVideo, setPendingIsVideo] = useState(false);

  const fetchFeed = async () => {
    try {
      const res = await api.get("/api/story/feed");
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch story feed:", err);
    }
  };

  useEffect(() => {
    if (!currentUser?._id) return;
    fetchFeed();
  }, [currentUser]);

  // Clean up the local object URL when the modal closes/unmounts
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  // Warn before closing the tab while a story is still uploading
  useEffect(() => {
    if (!uploading) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const ownGroup = groups.find((g) => String(g.authorId) === String(currentUser?._id));
  const otherGroups = groups.filter((g) => String(g.authorId) !== String(currentUser?._id));

  const handlePickFile = () => {
    if (uploading) return; // one upload at a time
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;

    const isVideo = f.type.startsWith("video/");

    if (isVideo && f.size > MAX_VIDEO_MB * 1024 * 1024) {
      alert(`That video is over ${MAX_VIDEO_MB}MB. Pick a smaller clip.`);
      return;
    }

    setPendingFile(f);
    setPendingPreviewUrl(URL.createObjectURL(f));
    setPendingIsVideo(isVideo);
  };

  const cancelPendingStory = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
  };

  // Does the real work: upload the file, then create the story.
  const startUpload = async ({ file, isVideo, caption, muteAudio = false }) => {
    setUploading(true);
    setUploadProgress(0);
    setFailedUpload(null);

    let step = "uploading the video"; // tells us which request failed

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("resourceType", isVideo ? "video" : "image");
      // true = the server removes the audio track before storing the video
      formData.append("muteAudio", isVideo && muteAudio ? "true" : "false");

      const uploadRes = await api.post("/api/upload", formData, {
        onUploadProgress: (e) => {
          if (e.total) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      });

      step = "saving the story";

      await api.post("/api/story", {
        url: uploadRes.data.url,
        type: isVideo ? "video" : "image",
        caption,
      });

      await fetchFeed();
    } catch (err) {
      console.error("Failed to create story:", err);
      // Work out a readable reason so a failure is never a mystery
      const data = err.response?.data;
      const reason =
        (typeof data === "string" && data) ||
        data?.message ||
        (err.response ? `server error ${err.response.status}` : "network problem or timeout");

      // Keep the file so the person can retry without picking it again
      setFailedUpload({ file, isVideo, caption, muteAudio, message: `Failed while ${step}: ${reason}` });
    } finally {
      setUploading(false);
    }
  };

  // Tapping Post: close the caption screen right away, upload in the background.
  const confirmPendingStory = (caption, muteAudio = false) => {
    if (!pendingFile || uploading) return;

    const job = { file: pendingFile, isVideo: pendingIsVideo, caption, muteAudio };

    cancelPendingStory(); // the screen leaves immediately
    startUpload(job);     // no await: the page stays usable
  };

  const retryUpload = () => {
    if (failedUpload && !uploading) startUpload(failedUpload);
  };

  const getAvatar = (pic) => {
    if (!pic) return `${PF}person/noAvatar.png`;
    return pic.startsWith("http") ? pic : PF + pic;
  };

  if (!currentUser) return null;

  return (
    <div className="StoryBar">
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
        onChange={handleFileSelected}
      />

      {/* Own bubble — always first, always visible whether or not you have an active story */}
      <div className="StoryBubble">
        <div
          className={`StoryRing ${ownGroup ? "hasStory" : "noStory"}`}
          onClick={() => (ownGroup ? setViewerIndex(0) : handlePickFile())}
        >
          <img src={getAvatar(currentUser.profilePicture)} alt="" className="StoryAvatarImg" />
          {!ownGroup && (
            <span className="StoryAddIcon">
              <MdAdd />
            </span>
          )}
        </div>
        <span className="StoryLabel">{uploading ? "Posting…" : "Your story"}</span>
        {ownGroup && (
          <button className="StoryAddMore" onClick={handlePickFile} disabled={uploading}>
            +
          </button>
        )}
      </div>

      {otherGroups.map((g, idx) => {
        const allSeen = g.stories.every((s) => s.viewed);
        // +1 because index 0 in the combined viewer list is always "own"
        // when it exists — see combinedGroups below.
        const combinedIndex = ownGroup ? idx + 1 : idx;

        return (
          <div className="StoryBubble" key={String(g.authorId)}>
            <div
              className={`StoryRing ${allSeen ? "seen" : "unseen"}`}
              onClick={() => setViewerIndex(combinedIndex)}
            >
              <img src={getAvatar(g.profilePicture)} alt="" className="StoryAvatarImg" />
            </div>
            <span className="StoryLabel">{g.username}</span>
          </div>
        );
      })}

      {viewerIndex !== null && (
        <StoryViewer
          groups={ownGroup ? [ownGroup, ...otherGroups] : otherGroups}
          startIndex={viewerIndex}
          currentUserId={currentUser._id}
          onClose={() => {
            setViewerIndex(null);
            fetchFeed(); // refresh seen/unseen rings after viewing
          }}
        />
      )}

      {pendingFile && (
        <CaptionModal
          previewUrl={pendingPreviewUrl}
          isVideo={pendingIsVideo}
          onCancel={cancelPendingStory}
          onConfirm={confirmPendingStory}
          posting={false}
        />
      )}

      {/* Small, non-blocking upload status. The rest of the page stays usable. */}
      {uploading && (
        <div className="StoryUploadToast" role="status" aria-live="polite">
          <div className="StoryUploadText">
            <span>
              {uploadProgress < 100
                ? `Uploading story… ${uploadProgress}%`
                : "Finishing up…"}
            </span>
          </div>
          <div className="StoryUploadTrack">
            <div
              className="StoryUploadFill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {!uploading && failedUpload && (
        <div className="StoryUploadToast StoryUploadToast--error" role="alert">
          <div className="StoryUploadText">
            <span>Couldn't post your story.</span>
            {failedUpload.message && (
              <div className="StoryUploadDetail">{failedUpload.message}</div>
            )}
          </div>
          <div className="StoryUploadActions">
            <button
              type="button"
              className="StoryUploadBtn StoryUploadBtn--retry"
              onClick={retryUpload}
            >
              Retry
            </button>
            <button
              type="button"
              className="StoryUploadBtn"
              onClick={() => setFailedUpload(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}