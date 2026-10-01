import React, {
  useContext,
  useEffect,
  useState,
} from "react";
import api from "../../api"; 
import socket from "../../socket";
import { useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

import "./notification.css";

import { AuthContext } from "../../components/context/AuthContext";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";
import { Link } from "react-router-dom";

const PF = process.env.REACT_APP_PUBLIC_FOLDER;


function NotificationItem({
  item,
  navigate,
  handleRead,
  formatTime,
}) {

  const profileLink = item.senderId
  ? item.senderModel === "Staff"
    ? `/staffprofile/${item.senderId._id}`
    : `/userprofile/${item.senderId.username}`
  : "#";

  return (
    <div
      className={`notification-item ${!item.isRead ? "unread" : ""}`}
      onClick={() => handleRead(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleRead(item)}
    >
      <Link
        to={profileLink}
        className="notification-avatar"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={
            item.senderId?.profilePicture
              ? (item.senderId.profilePicture.startsWith("http")
                  ? item.senderId.profilePicture
                  : PF + item.senderId.profilePicture)
              : PF + "person/noAvatar.png"
          }
          alt=""
          className="notification-avatar-img"
        />
      </Link>

      <div className="notification-content">
        <div className="notification-top">
          <h4>
            {item.senderId?.username || "Notification"}
          </h4>

          <span>{formatTime(item.createdAt)}</span>
        </div>

        <p>{item.text}</p>
      </div>

      {!item.isRead && (
        <div className="notification-dot"></div>
      )}
    </div>
  );
}

export default function Notification() {
  const navigate = useNavigate();

  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);

  const currentUser = user || staff;

  const [notifications, setNotifications] =
    useState([]);

  const [loading, setLoading] = useState(true);


  // ==========================
  // Register Logged User
  // ==========================
  useEffect(() => {
    if (!currentUser?._id) return;

    socket.emit(
      "addUser",
      currentUser._id
    );
  }, [currentUser]);

  // ==========================
  // Receive Live Notifications
  // ==========================
  useEffect(() => {
    const handleNotification = (notification) => {
      console.log("Notification received:", notification);

      setNotifications((prev) => {
        // Prevent duplicate notifications
        if (
          notification?._id &&
          prev.some(
            (item) => item._id === notification._id
          )
        ) {
          return prev;
        }

        return [notification, ...prev];
      });
    };

    socket.on("getNotification", handleNotification);

    return () => {
      socket.off("getNotification", handleNotification);
    };
  }, []);

  // ==========================
  // Load Notifications
  // ==========================
  useEffect(() => {
    if (!currentUser?._id) return;

    const fetchNotifications =
      async () => {
        try {
          const res = await api.get(
            `/api/notification/${currentUser._id}`
          );

          setNotifications(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
          console.log(err);
        } finally {
          setLoading(false);
        }
      };

    fetchNotifications();
  }, [currentUser]);

  // ==========================
  // Time Formatter
  // ==========================
  const formatTime = (date) => {
    const seconds = Math.floor(
      (Date.now() - new Date(date)) /
        1000
    );

    if (seconds < 60)
      return "Just now";

    if (seconds < 3600)
      return `${Math.floor(
        seconds / 60
      )} min ago`;

    if (seconds < 86400)
      return `${Math.floor(
        seconds / 3600
      )} hr ago`;

    if (seconds < 604800)
      return `${Math.floor(
        seconds / 86400
      )} day ago`;

    return new Date(
      date
    ).toLocaleDateString();
  };

  // ==========================
  // Mark One As Read
  // ==========================
  const handleRead = async (
    notification
  ) => {
    try {
      if (!notification.isRead) {
        await api.put(
          `/api/notification/${notification._id}/read`
        );

        setNotifications((prev) =>
          prev.map((item) =>
            item._id ===
            notification._id
              ? {
                  ...item,
                  isRead: true,
                }
              : item
          )
        );
      }

      if (notification.link) {
        navigate(notification.link);
      }
    } catch (err) {
      console.log(err);
    }
  };

  // ==========================
  // Mark All As Read
  // ==========================
  const markAllRead =
    async () => {
      try {
        await api.put(
          `/api/notification/read-all/${currentUser._id}`
        );

        setNotifications((prev) =>
          prev.map((item) => ({
            ...item,
            isRead: true,
          }))
        );
      } catch (err) {
        console.log(err);
      }
    };

  const unreadCount =
    notifications.filter(
      (n) => !n.isRead
    ).length;

    
  return (
    <div className="notification-page">
      {/* Header */}

      <header className="notification-header">
        <button
          className="notificationBackBtn"
          onClick={() =>
            navigate(-1)
          }
        >
          <ChevronLeftIcon />
        </button>

        <div className="notification-title">
          <h2>Notifications</h2>

          {unreadCount > 0 && (
            <span className="notification-count">
              {unreadCount}
            </span>
          )}
        </div>
      </header>

      {/* List */}

      <div className="notification-list">
        {loading ? (
          <div className="notification-empty">
            Loading...
          </div>
        ) : notifications.length ===
          0 ? (
          <div className="notification-empty">
            <NotificationsNoneIcon
              style={{
                fontSize: 60,
                color: "#bdbdbd",
              }}
            />

            <h3>
              You're all caught up!
            </h3>

            <p>
              No notifications yet.
            </p>
          </div>
        ) : (
          notifications.map((item) => (
            <NotificationItem
              key={item._id}
              item={item}
              navigate={navigate}
              handleRead={
                handleRead
              }
              formatTime={
                formatTime
              }
            />
          ))
        )}
      </div>

      {/* Footer */}

      {notifications.length >
        0 && (
        <div className="notification-footer">
          <button
            className="mark-read-button"
            onClick={
              markAllRead
            }
          >
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
}