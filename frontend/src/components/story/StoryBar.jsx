import { useContext, useEffect, useRef, useState } from "react";
import "./storybar.css";
import api from "../../api";
import { AuthContext } from "../context/AuthContext";
import { StaffAuthContext } from "../context/StaffAuthContext";
import StoryViewer from "./StoryViewer";
import CaptionModal from "./CaptionModal";
import { MdAdd } from "react-icons/md";

export default function StoryBar() {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);
  const currentUser = user || staff;
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;

  const [groups, setGroups] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null); // index into groups, or null
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();

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

  const ownGroup = groups.find((g) => String(g.authorId) === String(currentUser?._id));
  const otherGroups = groups.filter((g) => String(g.authorId) !== String(currentUser?._id));

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileSelected = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;

    const isVideo = f.type.startsWith("video/");
    setPendingFile(f);
    setPendingPreviewUrl(URL.createObjectURL(f));
    setPendingIsVideo(isVideo);
  };

  const cancelPendingStory = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
  };

  const confirmPendingStory = async (caption) => {
    if (!pendingFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      const uploadRes = await api.post("/api/upload", formData);

      await api.post("/api/story", {
        url: uploadRes.data.url,
        type: pendingIsVideo ? "video" : "image",
        caption,
      });

      cancelPendingStory();
      await fetchFeed();
    } catch (err) {
      console.error("Failed to create story:", err);
      alert("Couldn't post your story. Try again.");
    } finally {
      setUploading(false);
    }
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
          posting={uploading}
        />
      )}
    </div>
  );
}