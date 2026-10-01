import { useState, useEffect } from "react";
import "./ratingslist.css";
import api from "../../api";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function Stars({ score }) {
  return (
    <span className="RatingsListStars">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= score ? "filled" : ""}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function RatingsList({ staffId }) {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;

  useEffect(() => {
    if (!staffId) return;

    let cancelled = false;

    const fetchRatings = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/rating/staff/${staffId}`, {
          params: { page, limit: 10 },
        });

        const data = Array.isArray(res.data) ? res.data : [];

        if (!cancelled) {
          setRatings((prev) => (page === 1 ? data : [...prev, ...data]));
          setHasMore(data.length === 10);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRatings();

    return () => {
      cancelled = true;
    };
  }, [staffId, page]);

  const getAvatar = (img) => {
    if (!img) return PF + "person/noAvatar.png";
    return img.startsWith("http") ? img : PF + img;
  };

  if (loading && page === 1) {
    return <p className="RatingsListEmpty">Loading reviews…</p>;
  }

  if (!loading && ratings.length === 0) {
    return <p className="RatingsListEmpty">No reviews yet. Be the first to leave one.</p>;
  }

  return (
    <div className="RatingsList">
      {ratings.map((r) => (
        <div className="RatingsListItem" key={r._id}>
          <img
            className="RatingsListAvatar"
            src={getAvatar(r.userId?.profilePicture)}
            alt=""
          />
          <div className="RatingsListBody">
            <div className="RatingsListTop">
              <span className="RatingsListUsername">
                {r.userId?.username || "Anonymous"}
              </span>
              <span className="RatingsListTime">{timeAgo(r.createdAt)}</span>
            </div>
            <Stars score={r.score} />
            {r.review && <p className="RatingsListText">{r.review}</p>}
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          className="RatingsListMoreBtn"
          onClick={() => setPage((p) => p + 1)}
          disabled={loading}
        >
          {loading ? "Loading…" : "Show more reviews"}
        </button>
      )}
    </div>
  );
}