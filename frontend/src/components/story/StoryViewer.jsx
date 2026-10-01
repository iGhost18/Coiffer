import { useEffect, useRef, useState } from "react";
import "./storyviewer.css";
import api from "../../api";
import { MdClose, MdVisibility } from "react-icons/md";

const IMAGE_DURATION_MS = 5000;

export default function StoryViewer({ groups, startIndex, currentUserId, onClose }) {
  const [authorIdx, setAuthorIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0–100 for the current story's bar
  const videoRef = useRef();
  const rafRef = useRef();
  const startTimeRef = useRef();
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;

  const author = groups[authorIdx];
  const story = author?.stories[storyIdx];
  const isOwnStory = author && String(author.authorId) === String(currentUserId);

  const markViewed = async (id) => {
    try {
      await api.put(`/api/story/${id}/view`);
    } catch (err) {
      console.error(err);
    }
  };

  const goNextStory = () => {
    if (!author) return;
    if (storyIdx < author.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (authorIdx < groups.length - 1) {
      setAuthorIdx((i) => i + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  };

  const goPrevStory = () => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (authorIdx > 0) {
      setAuthorIdx((i) => i - 1);
      setStoryIdx(0); // lands on first story of previous author — acceptable simple behavior
    }
  };

  // Reset + mark-viewed whenever the visible story changes
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    markViewed(story._id);

    if (story.media.type === "image") {
      startTimeRef.current = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const pct = Math.min(100, (elapsed / IMAGE_DURATION_MS) * 100);
        setProgress(pct);
        if (pct >= 100) {
          goNextStory();
        } else {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }
    // video progress is driven by the <video> element's own timeupdate event instead
  }, [authorIdx, storyIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVideoTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  };

  const getAvatar = (pic) => {
    if (!pic) return `${PF}person/noAvatar.png`;
    return pic.startsWith("http") ? pic : PF + pic;
  };

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  if (!author || !story) return null;

  const getUrl = (url) => url; // Cloudinary URLs are already absolute
  const viewCount = story.viewers?.length ?? story.viewerCount ?? null;

  return (
    <div className="StoryViewerOverlay" onClick={onClose}>
      <div className="StoryViewerCard" onClick={(e) => e.stopPropagation()}>
        <div className="StoryProgressRow">
          {author.stories.map((s, i) => (
            <div className="StoryProgressTrack" key={s._id}>
              <div
                className="StoryProgressFill"
                style={{
                  width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        <div className="StoryViewerHeader">
          <div className="StoryViewerIdentity">
            <img
              src={getAvatar(author.profilePicture)}
              alt=""
              className="StoryViewerAvatar"
            />
            <div className="StoryViewerIdentityText">
              <span className="StoryViewerUsername">{author.username}</span>
              {story.createdAt && (
                <span className="StoryViewerTime">{timeAgo(story.createdAt)}</span>
              )}
            </div>
          </div>
          <button className="StoryViewerClose" onClick={onClose} aria-label="Close">
            <MdClose />
          </button>
        </div>

        <div className="StoryMediaWrapper">
          {story.media.type === "video" ? (
            <video
              ref={videoRef}
              src={getUrl(story.media.url)}
              className="StoryMedia"
              autoPlay
              playsInline
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={goNextStory}
            />
          ) : (
            <img src={getUrl(story.media.url)} alt="" className="StoryMedia" />
          )}

          <div className="StoryBottomScrim" />

          {story.caption && <div className="StoryCaption">{story.caption}</div>}

          {isOwnStory && viewCount !== null && (
            <div className="StoryViewCount">
              <MdVisibility />
              <span>
                {viewCount} view{viewCount === 1 ? "" : "s"}
              </span>
            </div>
          )}

          <div className="StoryTapZoneLeft" onClick={goPrevStory} />
          <div className="StoryTapZoneRight" onClick={goNextStory} />
        </div>
      </div>
    </div>
  );
}