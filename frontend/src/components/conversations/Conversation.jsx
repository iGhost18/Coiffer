import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./conversation.css";
import api from "../../api";

export default function Conversation({ conversation, currentUser, onlineUsers }) {
  const [member, setMember] = useState(null);
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;

  useEffect(() => {
    const friendId = conversation.members.find((m) => m !== currentUser._id);
    if (!friendId) return;

    const getMember = async () => {
      try {
        const res = await api.get(`/api/conversation/member?id=${friendId}`);
        setMember(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    getMember();
  }, [currentUser, conversation]);

  if (!member) return null;

  const profileLink =
    member.memberType === "Staff"
      ? `/staffprofile/${member._id}`
      : `/userprofile/${member.username}`;

  const isOnline = onlineUsers?.includes(String(member._id));

 
  return (
    <div className="conversation">
      <div className="conversationRight">
        <Link to={profileLink} className="conversationImgWrapper">
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
      <span className="conversationTime">now</span>
    </div>
  );
}


