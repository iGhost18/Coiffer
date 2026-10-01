import { useState, useEffect, useContext } from "react";
import "./ratingwidget.css";
import api from "../../api";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";


const SCORE_LABELS = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very good",
    5: "Excellent",
};

export default function RatingWidget({ staffId, completedBookingId }) {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [myRating, setMyRating] = useState(null);
    const [hoverScore, setHoverScore] = useState(0);
    const [review, setReview] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [justSaved, setJustSaved] = useState(false);

    useEffect(() => {
        if (!user || !staffId) return;
        api
            .get(`/api/rating/mine/${staffId}`)
            .then((res) => {
                setMyRating(res.data);
                if (res.data?.review) setReview(res.data.review);
            })
            .catch(() => {});
    }, [user, staffId]);

    const submitRating = async (score) => {
        if (!completedBookingId || submitting) return;

        setSubmitting(true);
        try {
            const res = await api.post("/api/rating", {
                staffId,
                bookingId: completedBookingId,
                score,
                review,
            });
            setMyRating(res.data);
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || "Couldn't submit your rating.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) {
      return (
        <div className="RatingWidget RatingWidget--locked">
          <p className="RatingHint">
            <span className="RatingLoginLink" onClick={() => navigate("/login")}>
              Log in
            </span>{" "}
            to rate this professional.
          </p>
        </div>
      );
    }

    if (!completedBookingId) {
        return (
            <div className="RatingWidget RatingWidget--locked">
                <p className="RatingHint">
                    You can rate this professional after a completed appointment.
                </p>
            </div>
        );
    }

    const activeScore = hoverScore || myRating?.score || 0;

    return (
        <div className="RatingWidget">
            <div className="RatingStarsRow">
                <div className="RatingStars">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <span
                            key={n}
                            className={`RatingStar ${n <= activeScore ? "filled" : ""} ${
                                submitting ? "disabled" : ""
                            }`}
                            onMouseEnter={() => setHoverScore(n)}
                            onMouseLeave={() => setHoverScore(0)}
                            onClick={() => submitRating(n)}
                        >
                            ★
                        </span>
                    ))}
                </div>

                {activeScore > 0 && (
                    <span className="RatingScoreLabel">{SCORE_LABELS[activeScore]}</span>
                )}
            </div>

            <div className="RatingReviewWrap">
                <textarea
                    className="RatingReviewInput"
                    placeholder="Leave a short review (optional)"
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    maxLength={500}
                />
                <span className="RatingCharCount">{review.length}/500</span>
            </div>

            <div className="RatingFooterRow">
                {myRating ? (
                    <span className="RatingSavedBadge">
                        ✓ Your rating: {myRating.score}★
                    </span>
                ) : (
                    <span className="RatingUnsavedHint">Tap a star to submit your rating</span>
                )}

                {justSaved && <span className="RatingJustSaved">Saved</span>}
            </div>
        </div>
    );
}