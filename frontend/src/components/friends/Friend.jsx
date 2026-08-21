import "./friend.css";
import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";

import { AuthContext } from "../context/AuthContext";
import { StaffAuthContext } from "../context/StaffAuthContext";

export default function Friend() {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);

  const [friends, setFriends] = useState([]);
  const navigate = useNavigate();
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;

  const getImage = (img) => {
    if (!img) return PF + "person/noAvatar.png";
    if (img.startsWith("http")) return img;
    return PF + img;
  };

  useEffect(() => {
    const fetchFriends = async () => {

      if (!user && !staff) {
        console.log("No logged in user");
        return;
      }

      try {
        let res;

        if (user) {
          res = await axios.get(`/api/user/${user._id}/groomers`);
        } else {
          res = await axios.get(`/api/staff/${staff._id}/clients`);
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
            <button
              className="friendBackbtn"
              onClick={() =>
                navigate(-1)
              }
            >
              <ChevronLeftIcon />
            </button>

            <h3>
              {user ? "My Groomers" : "My Clients"}
            </h3>
        </div>
 
        <span className="friend-count">
          {friends.length}
        </span>
      </div>

      {friends.map((friend) => (
      
        <div
          key={friend._id}
          className="friend-row"
          onClick={() => {
            if (user) {
              // logged in as a user, so friends here are staff (groomers)
              navigate(`/staffprofile/${friend._id}`);
            } else {
              // logged in as staff, so friends here are users (clients)
              navigate(`/userprofile/${friend.username}`);
            }
          }}
        >
        <div className="friend-avatar-wrap">
          <img
            src={getImage(friend.profilePicture)}
            alt=""
            className="friend-avatar"
          />
        </div>

        <div className="friend-info">
          <p className="friend-name">
            {friend.username}
          </p>

          <p className="friend-status">
            {user ? friend.role : "Client"}
          </p>
        </div>
      </div>
      ))}
    </div>
  );
}