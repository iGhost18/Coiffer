import './userprofile.css';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api"; 
import 'swiper/css';
import Collection from "../../components/collections/Collections";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChangePasswordModal from "../../components/changepassword/Changepasswordmodal";
import DeleteAccountModal from "../../components/deleteaccount/Deleteaccountmodal";
import { AuthContext } from "../../components/context/AuthContext";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";


export default function Userprofile() {
  const { user: authUser, dispatch: userDispatch } = useContext(AuthContext);
  const { staff, dispatch: staffDispatch } = useContext(StaffAuthContext);
  const currentUser = authUser || staff;
  const username = useParams().username || currentUser?.username;
  const navigate = useNavigate();

  const PF = process.env.REACT_APP_PUBLIC_FOLDER;
  
  const [saved, setSaved] = useState(false);
  const [isLike, setIsLike] = useState(false);
  const [collection, setCollection] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [user, setUser] = useState({});
  const [isClient, setIsClient] = useState(false);
  const fileInputRef = useRef(null);
  const profilePicRef = useRef(null);

  // History (inline expandable panel)
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bookingHistory, setBookingHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Personal Note (inline expandable panel, same pattern as History)
  const [noteOpen, setNoteOpen] = useState(false);

  // Modals
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  
  const isOwnProfile = currentUser?._id === user?._id;

  const getImage = (img) => {
    if (!img) return PF + "person/noAvatar.png";
    if (img.startsWith("http")) return img;
    return PF + img;
  };

  useEffect(() => {

    if (!username) return;

    const fetchUser = async () => {
      try {

        const res = await api.get(
          `/api/user?username=${username}`
        );

        setUser(res.data || {});

        setCollection(
          res.data?.collection || []
        );

        setFeatured(
          res.data?.featured || []
        );

      } catch (err) {
        console.log(err);
      }
    };

    fetchUser();

  }, [username]);

  useEffect(() => {
    if (staff && user) {
      setIsClient(
        staff?.clients?.includes(user._id)
      );
    }
  }, [staff, user]);

  useEffect(() => {
    if (user?.likes && currentUser) {
      setIsLike(user.likes.includes(currentUser._id));
    }
  }, [user, currentUser]);

  const handleLike = async () => {
    if (!currentUser?._id || !user?._id) return;

    try {
      if (isLike) {
        await api.put(`/api/user/${user._id}/unlike`, { likerId: currentUser._id });
      } else {
        await api.put(`/api/user/${user._id}/like`, { likerId: currentUser._id });
      }

      setIsLike((prev) => !prev);

      setUser((prev) => ({
        ...prev,
        likes: isLike
          ? prev.likes.filter((l) => l !== currentUser._id)
          : [...(prev.likes || []), currentUser._id],
      }));
      setIsLike((prev) => !prev);
    } catch (err) {
      console.error(err);
    }
};
  

  const handleSave = async () => {
    try {

      await api.put(
        `/api/user/${user._id}`,
        { ...user, collection, featured, userId: currentUser._id }
      );

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2500);

    } catch (err) {
      console.log(err);
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);

    try {
      const uploadedUrls = [];

      for (const file of files) {
        const formData = new FormData();

        formData.append("file", file);

        const res = await api.post("/api/upload", formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        uploadedUrls.push(res.data.url);
      }

      setCollection((prev) => [
        ...prev,
        ...uploadedUrls,
      ]);

    } catch (err) {
      console.log(err);
    }
  };

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const imageUrl = res.data.url;
      setUser((prev) => ({ ...prev, profilePicture: imageUrl }));

      // Persist immediately instead of waiting for "Save Changes"
      await api.put(`/api/user/${user._id}`, {
        profilePicture: imageUrl,
        userId: currentUser._id,
      });

      // Keep AuthContext (and therefore the Topbar) in sync
      if (authUser) {
        userDispatch({ type: "UPDATE_USER", payload: { profilePicture: imageUrl } });
      }
    } catch (err) {
      console.log(err);
    }
  };

  const toggleFeatured = (url) => {
    setFeatured((prev) => {
      if (prev.includes(url)) {
        return prev.filter((u) => u !== url);
      }

      if (prev.length >= 7) {
        alert("You can only feature up to 7 images");
        return prev;
      }

      return [...prev, url];
    });
  };

  const update = (field) => (e) => {
    setUser(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleMessage = async () => {
    try {
      if (!currentUser?._id || !user?._id) {
        console.log("Missing user IDs");
        return;
      }

      if (currentUser._id === user._id) {
        return;
      }

      const res = await api.post("/api/conversation", {
        senderId: currentUser._id,
        receiverId: user._id,
      });

      navigate("/messenger", {
        state: {
          conversationId: res.data?._id,
        },
      });
    } catch (err) {
      console.log("Message error:", err);
    }
  };

  const handleAddClient = async () => {
    if (!user || !staff) {
      console.log("User or staff not loaded yet");
      return;
    }
    try {
      await api.put(
        `/api/staff/${staff._id}/addClient`,
        { userId: user._id }
      );

      setIsClient(true);

      staffDispatch({
        type: "UPDATE_STAFF",
        payload: {
          clients: [...(staff.clients || []), user._id],
        },
      });
    } catch (err) {
      console.error(err);
    }
  };

  // ---- History ----
  const toggleHistory = async () => {
    const opening = !historyOpen;
    setHistoryOpen(opening);

    if (opening && !historyLoaded) {
      setHistoryLoading(true);
      try {
        const res = await api.get(`/api/booking/user/${user._id}`);
        setBookingHistory(Array.isArray(res.data) ? res.data : []);
        setHistoryLoaded(true);
      } catch (err) {
        console.log(err);
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  // ---- Change Password ----
  const handlePasswordSuccess = () => {
    setShowChangePassword(false);
    setPasswordSuccess(true);
    setTimeout(() => setPasswordSuccess(false), 2500);
  };

  // ---- Delete Account ----
  const handleDeleteAccount = async () => {
    try {
      await api.delete(`/api/user/${user._id}`, {
        data: { userId: currentUser._id },
      });

      if (authUser) userDispatch({ type: "LOGOUT" });
      if (staff) staffDispatch({ type: "LOGOUT" });

      navigate("/login");
    } catch (err) {
      console.log(err);
      alert("Couldn't delete your account. Try again.");
    }
  };
    
  
  return (
    <div className="UserProfile">

      <button className="header-btn ProfileBackBtn" onClick={() => navigate(-1)}>
        <ChevronLeftIcon />
      </button>

      {/* LEFT */}
      <div className="UserProfileLeft">
        <div className="UserProfileTop">
          <div className="UserProfileTophead">
            <img src={getImage(user.profilePicture)} alt="" className="UserProfileTopImg" />
            <h5 className="Username">{user?.username}</h5>
          </div>

          <div className="UserStats">
            <div className="StatItem">
              <span className="StatNum">{user?.followings?.length ?? '0'}</span>
              <span className="StatLabel">Followings</span>
            </div>
            <div className="StatItem">
              <span className="StatNum">{user?.cuts?.length ?? '0'}</span>
              <span className="StatLabel">Appointments</span>
            </div>
            <div className="StatItem">
              <span className="StatNum">{user?.likes?.length ?? '0'}</span>
              <span className="StatLabel">likes</span>
            </div>
         </div>
         <div>
            <h4 className='Bio'>{user?.bio}</h4>
         </div>
          {(staff || (authUser && authUser._id !== user._id)) && (
            <div className="HeaderButtons">
              <button className="MessageBtn" onClick={handleMessage}>
                Message
              </button>

              <button
                className={`LikeBtn ${isLike ? "liked" : ""}`}
                onClick={handleLike}
                disabled={!currentUser?._id || currentUser._id === user?._id}
              >
                {isLike ? "♥ Liked" : "♡ Like"}
              </button>

              {staff && (
                <button
                  className="MessageBtn"
                  onClick={handleAddClient}
                  disabled={isClient}
                >
                  {isClient ? "Client ✓ " : "Client + "}
                </button>
              )}
            </div>
          )}
          <div className="HeaderBottom">
            <div className="UserCity">
              <p>
              📍 {user.city || user.state || user.country
                ? `${user.city || ""} ${user.state || ""} ${user.country || ""}`
                : "Location not specified"}
              </p>
            </div>
            <div className="JoinDate">
              <h5>📅 Joined: May 2026</h5>
            </div>
          </div>
        </div>

        <hr className='line' />

        <div className="UserProfileLeftCenter">
          <h5>Gender : <span className='Text'>{user?.gender || '—'}</span></h5>
          <h5>Birthday: <span className='Text'>{user?.birthMonth && user?.birthDay ? `🎂 ${user.birthMonth}  ${user.birthDay}`: "—"}</span></h5>
          <h5>Hair Type : <span className='Text'>{user?.hairType || '—'}</span></h5>
          <h5>Hair Color : <span className='Text'>{user?.hairColor || '—'}</span></h5>
          <h5>Hair Style : <span className='Text'>{user?.hairStyle || '—'}</span></h5>
        </div>

        <div className="UserProfileBottom">
          {featured.length > 0 ? (
            <Swiper modules={[FreeMode]} freeMode spaceBetween={50} slidesPerView={4.5}>
              {featured.map((url, i) => (
                <SwiperSlide key={i}>
                  <img src={url} alt="" className='SlideImg' />
                </SwiperSlide>
              ))}
            </Swiper>
          ) : (
            <p className="NoFeatured">No featured photos yet.<br />Select from your collection →</p>
          )}
        </div>
      </div>

      {/* CENTER — Collection */}
      <Collection
        collection={collection}
        featured={featured}
        toggleFeatured={toggleFeatured}
        fileInputRef={fileInputRef}
        handleUpload={handleUpload}
        showBackButton={false}
      />
 

      {/* RIGHT — Settings */} 
      {isOwnProfile && ( 
        <div className="UserProfileRight">
          <h4 className="SetUserTitle">Set Account</h4>

          <div className="UserImg">
            <input  type='file' accept='image/*' ref={profilePicRef} 
              style={{display: 'none'}} onChange={handleProfilePicUpload}
            />
            <div className="ProfileImgCircle">
              <img src={getImage(user.profilePicture)} alt="" className="ProfileImgPreview" />
            </div>
            <p className="ProfileUsername">{user.username || 'username'}</p>
            <button className="ChangeImg" onClick={() => profilePicRef.current.click()}>Change Photo</button>
          </div>

          <div className="FieldGrids">
            <div className="Field">
              <label>Name</label>
              <input type="text" value={user.name || ""} onChange={update('name')} placeholder="Full name" />
            </div>
            <div className="Field">
              <label>Username</label>
              <input type="text" value={user.username || ""} onChange={update('username')} placeholder="@username" />
            </div>
            <div className="Field">
              <label>Email</label>
              <input type="email" value={user.email || ""} onChange={update('email')} placeholder="email@example.com" />
            </div>
            <div className="Field">
              <label>Phone</label>
              <input type="tel" value={user.phone || ""} onChange={update('phone')} placeholder="+1 555 000 0000" />
            </div>
          <div className="Field">
              <label>Birthday</label>

              {/* Month */}
              <select
                value={user?.birthMonth || ""}
                onChange={update("birthMonth")}
              >
                <option value="">Month</option>
                <option value="Jan">January</option>
                <option value="Feb">February</option>
                <option value="Mar">March</option>
                <option value="Apr">April</option>
                <option value="May">May</option>
                <option value="June">June</option>
                <option value="July">July</option>
                <option value="Aug">August</option>
                <option value="Sept">September</option>
                <option value="Oct">October</option>
                <option value="Nov">November</option>
                <option value="Dec">December</option>
              </select>

              {/* Day */}
              <select
                value={user?.birthDay || ""}
                onChange={update("birthDay")}
              >
                <option value="">Day</option>
                {[...Array(31)].map((_, i) => (
                  <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
            <div className="Field">
              <label>State</label>
              <input type="text" value={user.state || ""} onChange={update('state')} placeholder="State" />
            </div>
            <div className="Field">
              <label>City</label>
              <input type="text" value={user.city || ""} onChange={update('city')} placeholder="City" />
            </div>
            <div className="Field">
              <label>Country</label>
              <input type="text" value={user.country || ""} onChange={update('country')} placeholder="country" />
            </div>
            <div className="Field">
              <label>Bio</label>
              <input type="text" value={user.bio || ""} onChange={update('bio')} placeholder="Bio" />
            </div>

            <div className="Field">
              <label>Gender</label>
              <select value={user.gender} onChange={update('gender')}>
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
            <div className="Field">
              <label>Hair Type</label>
              <select value={user.hairType} onChange={update('hairType')}>
                <option value="">Select</option>
                <option>Type 1 - Straight</option>
                <option>Type 2 - Wavy</option>
                <option>Type 3 - Curly</option>
                <option>Type 4a</option>
                <option>Type 4b</option>
                <option>Type 4c</option>
              </select>
            </div>
            <div className="Field">
              <label>Hair Color</label>
              <select value={user.hairColor} onChange={update('hairColor')}>
                <option value="">Select</option>
                <option>Black</option>
                <option>Dark Brown</option>
                <option>Light Brown</option>
                <option>Blonde</option>
                <option>Red</option>
                <option>Grey</option>
                <option>White</option>
                <option>Dyed</option>
              </select>
            </div>
            <div className="Field">
              <label>Current Hairstyle</label>
              <select value={user.hairStyle} onChange={update('hairStyle')}>
                <option value="">Select</option>
                <option>Burst Fade</option>
                <option>Taper Fade</option>
                <option>Skin Fade</option>
                <option>Afro</option>
                <option>Braids</option>
                <option>Locs</option>
                <option>Caesar Cut</option>
                <option>Waves</option>
                <option>Buzz Cut</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="MoreSection">
            <div className="MoreItem" onClick={toggleHistory}>
              📋 History {historyOpen ? "▲" : "▼"}
            </div>

            {historyOpen && (
              <div className="HistoryPanel">
                {historyLoading && <p className="HistoryEmpty">Loading...</p>}

                {!historyLoading && bookingHistory.length === 0 && (
                  <p className="HistoryEmpty">No bookings yet.</p>
                )}

                {!historyLoading &&
                  bookingHistory.map((b) => (
                    <div className="HistoryItem" key={b._id}>
                      <div className="HistoryItemTop">
                        <span className="HistoryItemServices">
                          {b.services?.map((s) => s.name).join(", ")}
                        </span>
                        <span className={`HistoryItemStatus HistoryItemStatus--${b.status}`}>
                          {b.status}
                        </span>
                      </div>
                      <div className="HistoryItemMeta">
                        {new Date(b.appointmentDate).toLocaleDateString()} · {b.appointmentTime}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <div className="MoreItem" onClick={() => setNoteOpen((prev) => !prev)}>
              📝 Personal Note {noteOpen ? "▲" : "▼"}
            </div>

            {noteOpen && (
              <div className="NotePanel">
                <textarea
                  className="NoteTextarea"
                  value={user.personalNote || ""}
                  onChange={update('personalNote')}
                  placeholder="Keep any details here — only you can see this."
                  rows={4}
                />
                <p className="NoteHint">Saved when you hit "Save Changes" below.</p>
              </div>
            )}

            <div className="MoreItem" onClick={() => setShowChangePassword(true)}>
              🔒 Change Password
              {passwordSuccess && <span className="MoreItemSuccess"> ✓ Updated</span>}
            </div>
            <div className="MoreItem danger" onClick={() => setShowDeleteAccount(true)}>
              🗑 Delete user
            </div>
          </div>

          {isOwnProfile && (
            <button className="SaveBtn" onClick={handleSave}>
              {saved ? "✓ Saved" : "Save Changes"}
            </button>
          )}
        </div>
      )}

      {showChangePassword && (
        <ChangePasswordModal
          userId={user._id}
          onCancel={() => setShowChangePassword(false)}
          onSuccess={handlePasswordSuccess}
        />
      )}

      {showDeleteAccount && (
        <DeleteAccountModal
          onCancel={() => setShowDeleteAccount(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </div>
  );
}