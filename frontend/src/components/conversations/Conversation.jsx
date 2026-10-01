import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./conversation.css";
import api from "../../api";

export default function Conversation({ conversation, currentUser, onlineUsers }) {
  const [member, setMember] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;

  useEffect(() => {
    const friendId = conversation.members.find((m) => m !== currentUser._id);
    if (!friendId) {
      setLoaded(true);
      return;
    }

    let cancelled = false;

    const getMember = async () => {
      try {
        const res = await api.get(`/api/conversation/member?id=${friendId}`);
        if (!cancelled) setMember(res.data);
      } catch (err) {
        if (err.response?.status === 404) {
          if (!cancelled) {
            setMember({
              username: "Deleted account",
              profilePicture: null,
              memberType: null,
            });
          }
        } else {
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    getMember();
    return () => { cancelled = true; };
  }, [currentUser, conversation]);

  if (!loaded) return null;
  if (!member) return null;

  const profileLink =
    member.memberType === "Staff"
      ? `/staffprofile/${member._id}`
      : member.memberType === "User"
      ? `/userprofile/${member.username}`
      : "#"; // deleted account — nowhere to link to

  const isOnline = member._id ? onlineUsers?.includes(String(member._id)) : false;
  const unreadCount = conversation.unreadCount || 0;

  return (
    <div className={`conversation ${unreadCount > 0 ? "conversationUnread" : ""}`}>
      <div className="conversationRight">
        <Link to={profileLink} className="conversationImgWrapper" onClick={(e) => !member._id && e.preventDefault()}>
          <img
            src={
              member.profilePicture
                ? member.profilePicture.startsWith("http")
                  ? member.profilePicture
                  : PF + member.profilePicture
                : `${PF}person/noAvatar.png`
            }
            alt=""
            className="conversationImg"
          />
          {isOnline && <span className="onlineDot"></span>}
        </Link>
        <span className="conversationName">{member.username}</span>
      </div>
      <div className="conversationMeta">
        <span className="conversationTime">now</span>
        {unreadCount > 0 && (
          <span className="conversationUnreadBadge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
    </div>
  );
}