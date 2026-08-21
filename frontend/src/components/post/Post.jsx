import './post.css';
import { AiOutlineHeart, AiFillHeart } from "react-icons/ai";
import { BiComment } from "react-icons/bi";
import { MdRoom, MdLabel } from "react-icons/md";
import { BsBookmark, BsBookmarkFill } from "react-icons/bs";
import { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { format } from "timeago.js"
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { StaffAuthContext } from '../context/StaffAuthContext';
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";


export default function Post({ post }) {

    const [postStaff, setPostStaff] = useState({});
    const [liked, setLiked] = useState(false);
    const [liking, setLiking] = useState(false);
    const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
    const [saved, setSaved] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);
    const PF = process.env.REACT_APP_PUBLIC_FOLDER;
    const { user } = useContext(AuthContext);
    const { staff: currentStaff } = useContext(StaffAuthContext);

    const currentUser = user || currentStaff;

    // ---- Comments ----
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState(
        (post.comments || []).map((c) => ({ likes: [], replies: [], ...c }))
    );
    const [commenterInfo, setCommenterInfo] = useState({}); // userId -> { username, profilePicture }
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [openReplyFor, setOpenReplyFor] = useState(null); // commentId or null
    const [replyDrafts, setReplyDrafts] = useState({}); // commentId -> text

    const images = ( Array.isArray(post.img) ? post.img : post.img ? [post.img] : []).filter(img => img && img.trim() !=="");

    useEffect(() => {
        if (currentUser?._id) {
            setLiked(post.likes?.includes(currentUser._id));
            setSaved(post.savedBy?.includes(currentUser._id));
        }
    }, [currentUser, post.likes, post.savedBy]);


    useEffect(() => {
        if (!post.staffId) return;

        const fetchPostStaff = async () => {
            try {
                const res = await axios.get(`/api/staff/${post.staffId}`);
                setPostStaff(res.data);
            } catch (err) {
                if(err.response?.status === 404) {
                    setPostStaff({
                        username: "Deleted Staff",
                        profilePicture: null
                    });
                }else {
                    console.log(err);
                }
            }
        };
        fetchPostStaff();
    }, [post.staffId]);

    // Resolve usernames/avatars for whoever left a comment, the first
    // time the comment section is opened. Reuses the same member-lookup
    // route the Messenger already relies on.
    useEffect(() => {
        if (!showComments) return;

        const idsToResolve = [
            ...new Set(
                comments
                    .flatMap((c) => [c.userId, ...(c.replies || []).map((r) => r.userId)])
                    .filter((id) => id && !commenterInfo[id])
            ),
        ];

        if (idsToResolve.length === 0) return;

        const resolveCommenters = async () => {
            try {
                const results = await Promise.all(
                    idsToResolve.map((id) =>
                        axios
                            .get(`/api/conversation/member?id=${id}`)
                            .then((res) => [id, res.data])
                            .catch(() => [id, { username: "Unknown", profilePicture: null }])
                    )
                );

                setCommenterInfo((prev) => {
                    const next = { ...prev };
                    results.forEach(([id, info]) => {
                        next[id] = info;
                    });
                    return next;
                });
            } catch (err) {
                console.log(err);
            }
        };

        resolveCommenters();
    }, [showComments, comments, commenterInfo]);



    const handleLike = async () => {
        if (liking) return;
        setLiking(true);

        const wasLiked = liked;
        setLiked(!wasLiked);
        setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

        try {
            await axios.put(`/api/post/${post._id}/like`, {
                userId: currentUser._id,
                postOwnerId: post.staffId,
            });
        } catch (err) {
            console.log(err);
            setLiked(wasLiked);
            setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
        } finally {
            setLiking(false);
        }
    };

    const handleSave = async () => {
        if (!currentUser) return;

        // Optimistic toggle — flip the icon immediately, revert if the
        // request fails.
        setSaved((prev) => !prev);

        try {
            await axios.put(`/api/post/${post._id}/save`, {
                userId: currentUser._id,
            });
        } catch (err) {
            console.log(err);
            setSaved((prev) => !prev); // revert on failure
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();

        const text = newComment.trim();
        if (!text || !currentUser || submitting) return;

        setSubmitting(true);

        try {
            const res = await axios.post(`/api/post/${post._id}/comment`, {
                userId: currentUser._id,
                text,
            });

            // Use the server's saved comment (has a real _id) rather than
            // faking one locally — without the real _id, liking or
            // replying to this comment right after posting it wouldn't work.
            setComments((prev) => [...prev, { likes: [], replies: [], ...res.data }]);

            setCommenterInfo((prev) => ({
                ...prev,
                [currentUser._id]: {
                    username: currentUser.username,
                    profilePicture: currentUser.profilePicture,
                },
            }));

            setNewComment("");
        } catch (err) {
            console.log(err);
            alert("Couldn't post your comment. Try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleLikeComment = async (commentId) => {
        if (!currentUser) return;

        // Optimistic toggle
        setComments((prev) =>
            prev.map((c) => {
                if (c._id !== commentId) return c;
                const alreadyLiked = c.likes.includes(currentUser._id);
                return {
                    ...c,
                    likes: alreadyLiked
                        ? c.likes.filter((id) => id !== currentUser._id)
                        : [...c.likes, currentUser._id],
                };
            })
        );

        try {
            await axios.put(`/api/post/${post._id}/comment/${commentId}/like`, {
                userId: currentUser._id,
            });
        } catch (err) {
            console.log(err);
        }
    };

    const handleReplySubmit = async (commentId) => {
        const text = (replyDrafts[commentId] || "").trim();
        if (!text || !currentUser) return;

        try {
            const res = await axios.post(
                `/api/post/${post._id}/comment/${commentId}/reply`,
                { userId: currentUser._id, text }
            );

            setComments((prev) =>
                prev.map((c) =>
                    c._id === commentId
                        ? { ...c, replies: [...c.replies, res.data] }
                        : c
                )
            );

            setCommenterInfo((prev) => ({
                ...prev,
                [currentUser._id]: {
                    username: currentUser.username,
                    profilePicture: currentUser.profilePicture,
                },
            }));

            setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
            setOpenReplyFor(null);
        } catch (err) {
            console.log(err);
            alert("Couldn't post your reply. Try again.");
        }
    };
    const getImage = (img) => {
        if (!img) return PF + "person/noAvatar.png";

        return img.startsWith("http") ? img : PF + img;
    };

  return (

    <div className='Post'>
        <div className="PostWrapper">
            <div className="PostTop">
                <div className="PostTopLeft">
                    <Link to={postStaff?._id ? `/staffprofile/${postStaff._id}` : "#"}>
                       <img
                            className="PostProfileImg"
                            src={getImage(postStaff.profilePicture)}
                            alt=""
                        />
                    </Link>
                    <span className="PostUsername">{postStaff.username}</span>
                    <span className="PostDate">{new Date(post.createdAt).toDateString()}</span>
                </div>
            </div>
            {(post.feeling || post.location) && (
                <div className="PostMeta">
                    {post.feeling && (
                        <span className="PostMetaFeeling">is feeling {post.feeling}</span>
                    )}
                    {post.location && (
                        <span className="PostMetaLocation">
                            <MdRoom className="PostMetaIcon" /> {post.location}
                        </span>
                    )}
                </div>
            )}
            <div className="PostCenter">
                <span className="PostText">{post.desc}</span>
                {post.tags?.length > 0 && (
                    <div className="PostTags">
                        <MdLabel className="PostMetaIcon" />
                        <span>
                            with{" "}
                            {post.tags.map((tag, i) => (
                                <span key={tag.id || i}>
                                    <Link
                                        to={
                                            tag.memberType === "Staff"
                                                ? `/staffprofile/${tag.id}`
                                                : `/userprofile/${tag.username}`
                                        }
                                        className="PostTagLink"
                                    >
                                        {tag.username}
                                    </Link>
                                    {i < post.tags.length - 1 && ", "}
                                </span>
                            ))}
                        </span>
                    </div>
                )}
               {images.length > 0 && (
               <div className="PostImgWrapper">
                    {images.length === 1 ? (
                        <div className="PostImgSlide">
                            <img src={getImage(images[0])} alt="" className="PostImg" />
                        </div>
                    ) : (
                        <>
                            <Swiper
                                modules={[Pagination]}
                                pagination={{ clickable: true }}
                                loop={false}
                                onSlideChange={(swiper) => setActiveSlide(swiper.activeIndex)}
                            >
                                {images.map((url, i) => (
                                    <SwiperSlide key={i}>
                                    <img src={getImage(url)} alt="" className="PostImg" />
                                    </SwiperSlide>
                                ))}
                            </Swiper>
                            <span className="PostImgCounter">{activeSlide + 1} / {images.length}</span>
                        </>
                    )}
                    </div>
                )}
            </div>
            <div className="PostBottom">
                <div className="PostBottomLeft">
                    <span className="PostActionIcon" onClick={handleLike}>
                        {liked 
                            ? <AiFillHeart className=" LikeIconFilled"/>
                            : <AiOutlineHeart className=" LikeIconFilled"/>
                        }
                    </span>
                        <span className="PostLikeCounter">{likeCount}</span>
                    <span className="PostActionIcon" onClick={() => setShowComments((prev) => !prev)}>
                        <BiComment className="CommentIcon" />
                    </span>
                    {comments.length > 0 && (
                        <span
                            className="PostCommentCounter"
                            onClick={() => setShowComments((prev) => !prev)}
                        >
                            {comments.length}
                        </span>
                    )}
                </div>
                <div className="PostBottomRight">
                    <span className="PostActionIcon" onClick={handleSave}>
                        {saved 
                            ? <BsBookmarkFill className="SaveIconFilled" />
                            : <BsBookmark className="SaveIcon" />
                        }
                    </span>
                </div>
            </div>

            {showComments && (
                <div className="PostCommentsSection">
                    {comments.length === 0 ? (
                        <p className="PostNoComments">No comments yet. Be the first to say something.</p>
                    ) : (
                        <div className="PostCommentsList">
                            {comments.map((c) => {
                                const info = commenterInfo[c.userId] || {};
                                const commentLiked = currentUser && c.likes.includes(currentUser._id);
                                const profileLink =
                                    info.memberType === "Staff"
                                        ? `/staffprofile/${c.userId}`
                                        : info.memberType === "User"
                                        ? `/userprofile/${info.username}`
                                        : "#"; // memberType not resolved yet

                                return (
                                    <div className="PostComment" key={c._id}>
                                        <Link to={profileLink}>
                                            <img
                                                className="PostCommentAvatar"
                                                src={info.profilePicture || "/assets/person/noAvatar.png"}
                                                alt=""
                                            />
                                        </Link>
                                        <div className="PostCommentBody">
                                            <span className="PostCommentUsername">
                                                {info.username || "..."}
                                            </span>
                                            <span className="PostCommentText">{c.text}</span>

                                            <div className="PostCommentMeta">
                                                <span className="PostCommentTime">{format(c.createdAt)}</span>

                                                <span
                                                    className={`PostCommentAction ${commentLiked ? "liked" : ""}`}
                                                    onClick={() => handleLikeComment(c._id)}
                                                >
                                                    {commentLiked ? "Liked" : "Like"}
                                                    {c.likes.length > 0 && ` (${c.likes.length})`}
                                                </span>

                                                <span
                                                    className="PostCommentAction"
                                                    onClick={() =>
                                                        setOpenReplyFor((prev) => (prev === c._id ? null : c._id))
                                                    }
                                                >
                                                    Reply
                                                </span>
                                            </div>

                                            {c.replies.length > 0 && (
                                                <div className="PostRepliesList">
                                                    {c.replies.map((r, ri) => {
                                                        const replyInfo = commenterInfo[r.userId] || {};
                                                        const replyProfileLink =
                                                            replyInfo.memberType === "Staff"
                                                                ? `/staffprofile/${r.userId}`
                                                                : replyInfo.memberType === "User"
                                                                ? `/userprofile/${replyInfo.username}`
                                                                : "#";

                                                        return (
                                                            <div className="PostReply" key={r._id || ri}>
                                                                <Link to={replyProfileLink}>
                                                                    <img
                                                                        className="PostCommentAvatar PostReplyAvatar"
                                                                        src={replyInfo.profilePicture || "/assets/person/noAvatar.png"}
                                                                        alt=""
                                                                    />
                                                                </Link>
                                                                <div className="PostCommentBody">
                                                                    <span className="PostCommentUsername">
                                                                        {replyInfo.username || "..."}
                                                                    </span>
                                                                    <span className="PostCommentText">{r.text}</span>
                                                                    <span className="PostCommentTime">
                                                                        {format(r.createdAt)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {openReplyFor === c._id && currentUser && (
                                                <form
                                                    className="PostReplyForm"
                                                    onSubmit={(e) => {
                                                        e.preventDefault();
                                                        handleReplySubmit(c._id);
                                                    }}
                                                >
                                                    <input
                                                        type="text"
                                                        className="PostCommentInput"
                                                        placeholder={`Reply to ${info.username || "..."}`}
                                                        value={replyDrafts[c._id] || ""}
                                                        onChange={(e) =>
                                                            setReplyDrafts((prev) => ({
                                                                ...prev,
                                                                [c._id]: e.target.value,
                                                            }))
                                                        }
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="submit"
                                                        className="PostCommentSubmit"
                                                        disabled={!(replyDrafts[c._id] || "").trim()}
                                                    >
                                                        Reply
                                                    </button>
                                                </form>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {currentUser && (
                        <form className="PostCommentForm" onSubmit={handleAddComment}>
                            <input
                                type="text"
                                className="PostCommentInput"
                                placeholder="Add a comment..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="PostCommentSubmit"
                                disabled={submitting || !newComment.trim()}
                            >
                                Post
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    </div>
  );
}