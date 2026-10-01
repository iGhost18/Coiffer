import "./friend.css";
import { useContext, useEffect, useState } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import socket from "../../socket";

import { AuthContext } from "../context/AuthContext";
import { StaffAuthContext } from "../context/StaffAuthContext";

export default function Friend() {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);

  const [friends, setFriends] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const navigate = useNavigate();
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;

  const getImage = (img) => {
    if (!img) return PF + "person/noAvatar.png";
    if (img.startsWith("http")) return img;
    return PF + img;
  };

  useEffect(() => {
    const currentUser = user || staff;
    if (!currentUser?._id) return;

    const handleUsers = (users) => {
      setOnlineUsers(users.map((u) => String(u.userId)));
    };

    socket.on("getUsers", handleUsers);

    const requestOnlineUsers = () => socket.emit("requestOnlineUsers");
    socket.on("connect", requestOnlineUsers);
    if (socket.connected) requestOnlineUsers();

    return () => {
      socket.off("getUsers", handleUsers);
      socket.off("connect", requestOnlineUsers);
    };
  }, [user, staff]);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!user && !staff) {
        console.log("No logged in user");
        return;
      }

      try {
        let res;
        if (user) {
          res = await api.get(`/api/user/${user._id}/groomers`);
        } else {
          res = await api.get(`/api/staff/${staff._id}/clients`);
        }
        setFriends(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.log(err);
      }
    };

    fetchFriends();
  }, [user, staff]);

  return (
    <div className="friend-list">
      <div className="friend-list-header">
        <div className="btnAndText">
          <button className="friendBackbtn" onClick={() => navigate(-1)}>
            <ChevronLeftIcon />
          </button>
          <h3>{user ? "My Groomers" : "My Clients"}</h3>
        </div>

        <span className="friend-count">{friends.length}</span>
      </div>

      {friends.map((friend) => {
        const isOnline = onlineUsers.includes(String(friend._id));

        return (
          <div
            key={friend._id}
            className="friend-row"
            onClick={() => {
              if (user) {
                navigate(`/staffprofile/${friend._id}`);
              } else {
                navigate(`/userprofile/${friend.username}`);
              }
            }}
          >
            <div className="friend-avatar-wrap">
              <img src={getImage(friend.profilePicture)} alt="" className="friend-avatar" />
              <span className={`status-dot ${isOnline ? "online" : "offline"}`}></span>
            </div>

            <div className="friend-info">
              <p className="friend-name">{friend.username}</p>
              <p className="friend-status">{user ? friend.role : "Client"}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}