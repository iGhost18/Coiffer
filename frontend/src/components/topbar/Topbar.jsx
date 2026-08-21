import './topbar.css';
import HomeFilledIcon from '@mui/icons-material/HomeFilled';
import CollectionsIcon from '@mui/icons-material/Collections';
import MailIcon from '@mui/icons-material/Mail';
import CircleNotificationsIcon from '@mui/icons-material/CircleNotifications';
import Menu from "../../components/menu/Menu";
import api from "../../api";
import socket from "../../socket";
import { Link } from 'react-router-dom';
import { useContext, useEffect, useState } from "react";
import { AuthContext } from '../context/AuthContext';
import { StaffAuthContext } from '../context/StaffAuthContext';



export default function Topbar() {
    const {user} = useContext(AuthContext);
    const {staff} = useContext(StaffAuthContext);
    const PF = process.env.REACT_APP_PUBLIC_FOLDER;

    const currentUser = user || staff;


    const [notificationCount, setNotificationCount] = useState(0);
    const [messageCount, setMessageCount] = useState(0);
    const [postCount] = useState(0);


    useEffect(() => {
        if (!currentUser?._id) return;
        socket.emit("addUser", currentUser._id);
    }, [currentUser]);
    
    useEffect(() => {
        const handleNotification = (notification) => {
            setNotificationCount((prev) => prev + 1);

            if (notification.type === "message") {
            setMessageCount((prev) => prev + 1);
            }
        };

        socket.on("getNotification", handleNotification);

        return () => {
            socket.off("getNotification", handleNotification);
        };
    }, []);

    useEffect(() => {

        if (!currentUser?._id) return;

        const fetchNotifications = async () => {
            try {
                const res = await api.get(
                    "/api/notification/" + currentUser._id
                );

                const notifications = Array.isArray(res.data)
                    ? res.data
                    : [];

                const unread = notifications.filter(
                    (n) => !n.isRead
                );

                setMessageCount(
                    unread.filter(
                        (n) => n.type === "message"
                    ).length
                );

            } catch (err) {
                console.log("Failed to fetch notifications:", err);
            }
        };

        fetchNotifications();

    }, [currentUser]);

    useEffect(() => {
        if (!(user || staff)) return;

        const currentUser = user || staff;

        const loadBadges = async () => {
            try {
                const notificationRes = await api.get(
                    `/api/notification/unread/${currentUser._id}`
                );

                setNotificationCount(notificationRes.data.count);
            } catch (err) {
                console.log(err);
            }
        };

        loadBadges();
    }, [currentUser]);

    const getImage = (img) => {
        if (!img) return PF + "person/noAvatar.png";

        if (img.startsWith("http")) {
            return img;
        }

        return PF + img;
    };

  return (
    <div className='TopbarContainer'>
        <Link to="/">
            <div className='TopbarLeft'>
                <img src="/assets/GhostLogo.png" alt="" className='Logo'/>
            </div>
        </Link>
        <div className='TopbarCenter'>
            <div className="TopbarCenterWrapper">
                <div className='TopbarIcons'>
                    <Link to="/">
                        <div className='TopbarIconItem'>
                            <HomeFilledIcon/>
                        </div>
                    </Link>
                    <Link to="/feed">
                        <div className='TopbarIconItem'>
                            <CollectionsIcon/>
                            {postCount > 0 && (
                                <span className="TopbarIconBadge">
                                    {postCount}
                                </span>
                            )}
                        </div>
                    </Link>
                    <Link to="/messenger">
                        <div className='TopbarIconItem'>
                            <MailIcon/>
                            {messageCount > 0 && (
                                <span className="TopbarIconBadge">
                                    {messageCount}
                                </span>
                            )}
                        </div>
                    </Link>
                    <Link to="/notification"  onClick={() => setNotificationCount(0)}>
                        <div className='TopbarIconItem'>
                            <CircleNotificationsIcon/>
                            {notificationCount > 0 && (
                                <span className="TopbarIconBadge">
                                    {notificationCount}
                                </span>
                            )}
                        </div>
                    </Link>
                </div>
            </div>
           
        </div>
        <Link
           to={
                user
                ? `/userprofile/${user.username}`
                : staff
                ? `/staffprofile/${staff._id}`
                : "/login"
            }
            className="TopbarRight"
            >
           <img
                src={getImage(currentUser?.profilePicture)}
                alt=""
                className="TopbarImg"
            />
        </Link>
        <Menu />
    </div>
  )
}
