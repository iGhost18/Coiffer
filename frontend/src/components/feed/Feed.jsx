import './feed.css';
import Post from "../post/Post";
import Topbar from "../topbar/Topbar";
import StoryBar from "../../components/story/StoryBar";
import { useState, useEffect, useContext } from 'react';
import api from '../../api';
import { AuthContext } from '../context/AuthContext';
import { StaffAuthContext } from '../context/StaffAuthContext';


export default function Feed({ username }) {
  const [activeTab, setActiveTab] = useState("all");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);
  const currentUser = user || staff;
  const currentId = currentUser?._id;

  // If the user logs out while on the "Following" tab, fall back to "All"
  useEffect(() => {
    if (!currentId && activeTab === "following") {
      setActiveTab("all");
    }
  }, [currentId, activeTab]);

  useEffect(() => {
    let cancelled = false;

    const fetchPosts = async () => {
      setLoading(true);
      setError("");

      try {
        let res;

        if (activeTab === "following" && currentId) {
          res = await api.get(`/api/post/following/${currentId}`);
        } else {
          res = await api.get("/api/post/timeline");
        }

        if (cancelled) return;
        setPosts(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        if (cancelled) return;
        console.error("Feed load failed:", err.response?.status, err.response?.data);
        setPosts([]);
        setError("Couldn't load posts right now. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Marking posts as read is best-effort and logged-in only.
      // It runs AFTER the posts are on screen, so a failure here can
      // never hide the feed.
      if (currentId) {
        try {
          await api.put("/api/notification/read-posts/" + currentId);
        } catch (err) {
          console.error("Mark posts read failed:", err);
        }
      }
    };

    fetchPosts();

    return () => {
      cancelled = true;
    };
  }, [activeTab, currentId]);

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  };

  const handlePostUpdated = (postId, changes) => {
    setPosts((prev) =>
      prev.map((p) => (p._id === postId ? { ...p, ...changes } : p))
    );
  };

  return (
    <div className='Feed'>
      <Topbar />

      <div className="FeedWrapper">

        <div className="StickyTab">
          <div className="FeedTabs">

            <span
              className={`FeedTab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Posts
            </span>

            {currentUser && (
              <span
                className={`FeedTab ${activeTab === "following" ? "active" : ""}`}
                onClick={() => setActiveTab("following")}
              >
                Following
              </span>
            )}

          </div>
        </div>

        <StoryBar />

        <div className="FeedPosts">
          {loading && posts.length === 0 && (
            <p style={{ textAlign: "center", color: "#888", padding: 20 }}>
              Loading posts...
            </p>
          )}

          {!loading && error && (
            <p style={{ textAlign: "center", color: "#c0392b", padding: 20 }}>
              {error}
            </p>
          )}

          {!loading && !error && posts.length === 0 && (
            <p style={{ textAlign: "center", color: "#888", padding: 20 }}>
              {activeTab === "following"
                ? "Nothing here yet. Follow some experts to see their posts."
                : "No posts yet."}
            </p>
          )}

          {posts.map((post) => (
            <Post
              key={post._id}
              post={post}
              onPostDeleted={handlePostDeleted}
              onPostUpdated={handlePostUpdated}
            />
          ))}
        </div>
      </div>
    </div>
  );
}