import './topbar.css';
import HomeFilledIcon from '@mui/icons-material/HomeFilled';
import CollectionsIcon from '@mui/icons-material/Collections';
import MailIcon from '@mui/icons-material/Mail';
import CircleNotificationsIcon from '@mui/icons-material/CircleNotifications';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
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
    const [postCount, setPostCount] = useState(0);


    useEffect(() => {
        if (!currentUser?._id) return;
        socket.emit("addUser", currentUser._id);
    }, [currentUser]);
    
    useEffect(() => {
        const handleNotification = (notification) => {
            setNotificationCount((prev) => prev + 1);
        };

        // Don't bump the badge for a message that arrives while the user
        // is already sitting inside /messenger with the chat open — they're
        // actively seeing it, so it isn't "unread" from the topbar's
        // point of view.
        const handleIncomingMessage = () => {
            if (window.location.pathname === "/messenger") return;
            setMessageCount((prev) => prev + 1);
        };

        socket.on("getNotification", handleNotification);
        socket.on("getMessage", handleIncomingMessage);

        return () => {
            socket.off("getNotification", handleNotification);
            socket.off("getMessage", handleIncomingMessage);
        };
    }, []);

    
    useEffect(() => {
        if (!currentUser?._id) return;

        const fetchPostCount = async () => {
            try {
                const res = await api.get(
                    `/api/post/count/${currentUser._id}`
                );
                setPostCount(res.data.count);
            } catch (err) {
                console.log("Failed to fetch post count:", err);
            }
        };

        fetchPostCount();
    }, [currentUser]);


    useEffect(() => {
        if (!currentUser?._id) return;

        const fetchUnreadMessageCount = async () => {
            try {
                const res = await api.get(
                    `/api/message/unread/${currentUser._id}`
                );

                setMessageCount(res.data.count);
            } catch (err) {
                console.log(
                    "Failed to fetch unread message count:",
                    err
                );
            }
        };

        // Initial count
        fetchUnreadMessageCount();

        // Messenger tells Topbar when messages have been read
        const handleMessagesRead = () => {
            fetchUnreadMessageCount();
        };

        window.addEventListener(
            "messagesRead",
            handleMessagesRead
        );

        return () => {
            window.removeEventListener(
                "messagesRead",
                handleMessagesRead
            );
        };
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser?._id) return;

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

                    <Link
                        to="/feed"
                        onClick={() => {
                            setPostCount(0);
                            if (currentUser?._id) {
                                api.put(`/api/post/mark-viewed/${currentUser._id}`).catch(console.error);
                            }
                        }}
                    >
                        <div className='TopbarIconItem'>
                            <CollectionsIcon/>
                            {postCount > 0 && (
                                <span className="TopbarIconBadge">
                                    {postCount}
                                </span>
                            )}
                        </div>
                    </Link>

                    <Link to="/messenger" onClick={() => setMessageCount(0)}>
                        <div className='TopbarIconItem'>
                            <MailIcon/>
                            {messageCount > 0 && (
                                <span className="TopbarIconBadge">
                                    {messageCount}
                                </span>
                            )}
                        </div>
                    </Link>
                        
                    <Link to="/store">
                        <div className='TopbarIconItem'>
                            <StorefrontRoundedIcon />
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
        <div className="TopbarRightGroup">
            <Link
                to={
                    user?.username
                    ? `/userprofile/${user.username}`
                    : staff?._id
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
    </div>
  )
}