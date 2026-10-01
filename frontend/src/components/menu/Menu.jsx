import './menu.css';
import { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import GrainTwoToneIcon from '@mui/icons-material/GrainTwoTone';
import CollectionsTwoToneIcon from '@mui/icons-material/CollectionsTwoTone';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import PeopleIcon from '@mui/icons-material/People';
import EventAvailableTwoToneIcon from '@mui/icons-material/EventAvailableTwoTone';
import ShoppingCartTwoToneIcon from '@mui/icons-material/ShoppingCartTwoTone';
import BookmarksTwoToneIcon from '@mui/icons-material/BookmarksTwoTone';
import MapTwoToneIcon from '@mui/icons-material/MapTwoTone';
import LogoutTwoToneIcon from '@mui/icons-material/LogoutTwoTone';
import SignOutModal from '../signout/Signoutmodal';
import api from '../../api';
import socket from '../../socket';

import { AuthContext } from "../context/AuthContext";
import { StaffAuthContext } from "../context/StaffAuthContext";

export default function Menu() {
    const [isOpen, setIsOpen] = useState(false);
    const [showSignOut, setShowSignOut] = useState(false);
    const navigate = useNavigate();

    const { user, dispatch: userDispatch } = useContext(AuthContext);
    const { staff, dispatch: staffDispatch } = useContext(StaffAuthContext);

    const currentUser = user || staff;

    const [cartCount, setCartCount] = useState(0);
    const [scheduleCount, setScheduleCount] = useState(0);

    const location = useLocation();

    useEffect(() => {
        if (!currentUser?._id) return;

        const fetchCounts = async () => {
            try {
            const cartRes = await api.get(`/api/cart/${staff ? "staff" : "user"}/${currentUser._id}`);
            setCartCount(cartRes.data?.items?.length || 0);

            const scheduleRes = await api.get(`/api/schedule/count/${currentUser._id}`);
            setScheduleCount(scheduleRes.data.count || 0);
            } catch (err) {
            console.log(err);
            }
        };

        fetchCounts();
    }, [currentUser, staff, location.pathname]); // re-fetch whenever the route changes

    const handleSignOut = async () => {
        try {
            await api.post("/api/auth/logout");
        } catch (err) {
            console.error("Logout request failed:", err);
            // proceed with client-side logout regardless — don't trap the user
        } finally {
            socket.disconnect();

            if (user) userDispatch({ type: "LOGOUT" });
            if (staff) staffDispatch({ type: "LOGOUT" });

            setShowSignOut(false);
            setIsOpen(false);
            navigate("/login");
        }
    };


  return (
    <>
        <button 
            onClick={() => setIsOpen(!isOpen)} 
            className='TopbarIconMenuButton'
            style={{ color: isOpen ? '#e63946' : '#f5f0e8', transition: 'color 0.2s ease' }}
        >
            <GrainTwoToneIcon size={22} />
        </button>

        {isOpen && <div className='Overlay' onClick={() => setIsOpen(false)} />}

        <nav className='MenuList' style={{ transform: isOpen ?  'translateX(0)' : 'translateX(100%)' }}>
            <h2 className='MenuHeader'>Menu</h2>
            <ul>
                <li>
                    <Link to='/collections' onClick={() => setIsOpen(false)}>
                        <CollectionsTwoToneIcon />
                        <span className='MenuListItem'>Collections</span>
                    </Link>
                </li>
                <li>
                    <Link to='/friends' onClick={() => setIsOpen(false)}>
                        {staff ? <PeopleIcon /> : <Diversity3Icon />}
                        <span className='MenuListItem'>{staff ? "Clients" : "Groomers"}</span>
                    </Link>
                </li>
                <li>
                    <Link to='/schedule' onClick={() => setIsOpen(false)}>
                        <EventAvailableTwoToneIcon />
                        <span className='MenuListItem'>Schedule</span>
                        {scheduleCount > 0 && (
                            <span className="MenuListItemBadge">
                                {scheduleCount}
                            </span>
                        )}
                    </Link>
                </li>
                <li>
                    <Link to='/cart' onClick={() => setIsOpen(false)}>
                        <ShoppingCartTwoToneIcon />
                        <span className='MenuListItem'>Cart</span>
                        {cartCount > 0 && (
                            <span className="MenuListItemBadge">
                                {cartCount}
                            </span>
                        )}
                    </Link>
                </li>
                <li>
                    <Link to='/map' onClick={() => setIsOpen(false)}>
                        <MapTwoToneIcon />
                        <span className='MenuListItem'>Map</span>
                    </Link>
                </li>
                <li>
                    <Link to='/saves' onClick={() => setIsOpen(false)}>
                        <BookmarksTwoToneIcon />
                        <span className='MenuListItem'>Saves</span>
                    </Link>
                </li>

                <hr className='hr' />
                <li>
                    <button
                        type="button"
                        className="MenuSignOutBtn"
                        onClick={() => setShowSignOut(true)}
                    >
                        <LogoutTwoToneIcon />
                        <span className='MenuListItem'>Sign out</span>
                    </button>
                </li>

            </ul>
        </nav>

        {showSignOut && (
            <SignOutModal
                onCancel={() => setShowSignOut(false)}
                onConfirm={handleSignOut}
            />
        )}
    </>
  );
}