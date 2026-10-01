import "./staffprofile.css";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useContext, useRef } from "react";
import api from "../../api";
import Share from "../../components/share/Share";
import PostGrid from "../../components/post/PostGrid";
import PostModal from "../../components/post/PostModal";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";
import { AuthContext } from "../../components/context/AuthContext";
import Services from "../../components/services/Services";
import Collection from "../../components/collections/Collections";
import RatingWidget from "../../components/rating/RatingWidget";
import RatingsList from "../../components/rating/RatingsList";
import { requireAuthAction } from "../../utils/requireAuthAction";





export default function StaffProfile() {
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;
  const { id } = useParams();
  const [isFollowing, setIsFollowing] = useState(false);
  const [staffData, setStaffData] = useState({});
  const [posts, setPosts] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isGroomer, setIsGroomer] = useState(false);
  const [activeDay, setActiveDay] = useState("Monday");
  const { staff, dispatch: staffDispatch } = useContext(StaffAuthContext);
  const { user, dispatch: userDispatch } = useContext(AuthContext);

  const currentUser = user || staff;
  const isOwnProfile = staff?._id === id;

  // Collection state
  const [collection, setCollection] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [collectionSaved, setCollectionSaved] = useState(false);
  const fileInputRef = useRef(null);

  // Rating state — the most recent completed booking this user has with
  // this staff member, so RatingWidget knows whether/what they can rate.
  const [completedBookingId, setCompletedBookingId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await api.get(`/api/staff/${id}`);
        const postsRes = await api.get(`/api/post/profile/${id}`);

        setStaffData(res.data || {});
        setCollection(res.data?.collection || []);
        setFeatured(res.data?.featured || []);
        setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
      } catch (err) {
        console.log(err);
      }
    };

    if (id) fetchStaff();
  }, [id]);

  useEffect(() => {
    if (staffData.followers && currentUser) {
      setIsFollowing(staffData.followers.includes(currentUser._id));
    }
  }, [staffData, currentUser]);

  useEffect(() => {
    if (user && staffData) {
      setIsGroomer(user?.groomers?.includes(staffData._id));
    }
  }, [user, staffData]);

  // Only regular Users (not staff viewing their own or another staff's
  // profile) can leave a rating, and only if they have a completed
  // booking with this specific staff member.
  useEffect(() => {
    const fetchCompletedBooking = async () => {
      if (!user?._id || !staffData?._id) {
        setCompletedBookingId(null);
        return;
      }

      try {
        const res = await api.get(`/api/booking/user/${user._id}`);
        const bookings = Array.isArray(res.data) ? res.data : [];

        const match = bookings.find(
          (b) =>
            b.status === "completed" &&
            String(b.staffId?._id || b.staffId) === String(staffData._id)
        );

        setCompletedBookingId(match ? match._id : null);
      } catch (err) {
        console.log(err);
        setCompletedBookingId(null);
      }
    };

    fetchCompletedBooking();
  }, [user, staffData]);

  const handleFollow = async () => {
    if (!currentUser?._id) {
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    try {
      if (isFollowing) {
        await api.put(`/api/staff/${id}/unfollow`, { userid: currentUser._id });
        setStaffData((prev) => ({
          ...prev,
          followers: (prev.followers || []).filter((f) => f !== currentUser._id),
        }));
      } else {
        await api.put(`/api/staff/${id}/follow`, { userid: currentUser._id });
        setStaffData((prev) => ({
          ...prev,
          followers: [...(prev.followers || []), currentUser._id],
        }));
      }
      setIsFollowing((prev) => !prev);
    } catch (err) {
      console.log(err);
    }
  };

  const handleMessage = async () => {
    if (!currentUser?._id) {
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    try {
      if (!staffData?._id) return;
  
      const res = await api.post("/api/conversation", {
        senderId: currentUser._id,
        receiverId: staffData._id,
      });

      navigate("/messenger", {
        state: {
          conversationId: res.data._id,
        },
      });
    } catch (err) {
      console.log(err);
    }
  };

  const handleToggleGroomer = async () => {
    if (!user?._id) {
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    try {
      if (!staffData?._id) return;

      if (isGroomer) {
        await api.put(`/api/staff/${staffData._id}/removeGroomer`, {});

        setIsGroomer(false);

        userDispatch({
          type: "UPDATE_USER",
          payload: {
            groomers: (user.groomers || []).filter((g) => g !== staffData._id),
          },
        });
      } else {
        await api.put(`/api/staff/${staffData._id}/addGroomer`, {});

        setIsGroomer(true);

        userDispatch({
          type: "UPDATE_USER",
          payload: {
            groomers: [...(user.groomers || []), staffData._id],
          },
        });
      }
    } catch (err) {
      console.log(err);
    }
  };

  // ---- Collection ----
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);

    try {
      const uploadedUrls = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await api.post("/api/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        uploadedUrls.push(res.data.url);
      }

      const updatedCollection = [...collection, ...uploadedUrls];
      setCollection(updatedCollection);

      // Persist immediately, same pattern as profile-picture upload —
      // no separate "Save" step for a staff member's own collection.
      await api.put(`/api/staff/${staffData._id}`, {
        collection: updatedCollection,
      });

      setCollectionSaved(true);
      setTimeout(() => setCollectionSaved(false), 2000);
    } catch (err) {
      console.log(err);
    }
  };

  const handleDeleteCollectionItem = async (url) => {
      const updatedCollection = collection.filter((u) => u !== url);
      const updatedFeatured = featured.filter((u) => u !== url);

      setCollection(updatedCollection);
      setFeatured(updatedFeatured);

      try {
        await api.put(`/api/staff/${staffData._id}`, {
          collection: updatedCollection,
          featured: updatedFeatured,
        });
      } catch (err) {
        console.log(err);
      }
  };

  const toggleFeatured = async (url) => {
    let updatedFeatured;

    if (featured.includes(url)) {
      updatedFeatured = featured.filter((u) => u !== url);
    } else {
      if (featured.length >= 7) {
        alert("You can only feature up to 7 images");
        return;
      }
      updatedFeatured = [...featured, url];
    }

    setFeatured(updatedFeatured);

    try {
      await api.put(`/api/staff/${staffData._id}`, {
        featured: updatedFeatured,
      });
    } catch (err) {
      console.log(err);
    }
  };

  const getImage = (img, fallback = "person/noAvatar.png") => {
    if (!img) return PF + fallback;
    return img.startsWith("http") ? img : PF + img;
  };

  const formatTime = (time) => {
    if (!time) return "";
    const [hourStr, minute] = time.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  return (
    <div className="StaffProfile">
      <button className="header-btn StaffBackBtn" onClick={() => navigate(-1)}>
        <ChevronLeftIcon />
      </button>

      {/* ===== GALLERY ===== */}
      <div className="StaffGallery">
        <img src={getImage(staffData?.coverPicture?.[0], "person/noCover.png")} alt="" />
        <img src={getImage(staffData?.coverPicture?.[1], "person/noCover.png")} alt="" className="centerImg" />
        <img src={getImage(staffData?.coverPicture?.[2], "person/noCover.png")} alt="" />
      </div>

      {/* ===== PROFILE INFO ===== */}
      <div className="ProfileHeader">
        <img src={getImage(staffData.profilePicture)} alt="" className="Avatar" />
        <div className="ProfileText">
          <h2>
            {staffData?.displayName ||
              `${staffData?.firstName || ""} ${staffData?.lastName || ""}`.trim() ||
              staffData?.username}
            <span className="Verified">✔</span>
          </h2>
          <p>@{staffData?.username}</p>

          <span className="Role">
            {staffData.isAdmin ? "Admin" : staffData.roles?.length > 0 ? staffData.roles.join(" · ") : "Professional"}
          </span>
        </div>
        {currentUser && currentUser._id !== id && (
          <div className="HeaderButtons">
            <button className="MessageBtn" onClick={handleMessage}>
              Message
            </button>

            <button className={`FollowBtn ${isFollowing ? "following" : ""}`} onClick={handleFollow}>
              {isFollowing ? "✓ Following" : "+ Follow"}
            </button>

            {user && (
              <button className="MessageBtn" onClick={handleToggleGroomer}>
                {isGroomer ? "Groomer ✓ " : "Groomer +"}
              </button>
            )}
          </div>
        )}
        {isOwnProfile && (
          <div className="HeaderButtons">
            <button className="MessageBtn" onClick={() => navigate(`/staffsettings/${id}`)}>
              Edit Profile
            </button>
          </div>
        )}
      </div>

      {/* ===== STATS ===== */}
      <div className="Stats">
        <div>
          <h3>{staffData.followers?.length || 0}</h3>
          <p>Followers</p>
        </div>
        <div>
          <h3>{staffData.followings?.length || 0}</h3>
          <p>Followings</p>
        </div>
        <div>
          <h3>{staffData.cuts?.length || 0}</h3>
          <p>Appointments Done</p>
        </div>
      </div>

      {/* ===== LOCATION ===== */}
      <div className="LocationRow">
        <p>
          📍{" "}
          {staffData.location?.address ? staffData.location.address : "Location not specified"}
        </p>
        <p>📅 Joined: May 2026</p>
      </div>

      {/* ===== INFO CARDS ===== */}
      <div className="InfoCards">
        <div className="InfoCard">
          <h4>{staffData.workType || "Not specified"}</h4>
          <p>
            {staffData.workType === "mobile"
              ? "I will come to you"
              : staffData.workType === "stationed"
              ? "You visit me"
              : "I come to you or you visit me"}
          </p>
        </div>
        <div className="InfoCard">
          <h4>Experience</h4>
          <p>{staffData.experience || 0}+ years professional barbering</p>
        </div>
        <div className="InfoCard highlight">
          <h2>{staffData.rating ? staffData.rating.toFixed(1) : "N/A"}</h2>
          <p>
            Rating
            {staffData.ratingCount > 0 && ` · ${staffData.ratingCount} review${staffData.ratingCount === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

    

      {/* ===== BIO ===== */}
      <div className="BioCard">
        <h4>Bio</h4>
        <p>{staffData.desc || "No bio yet."}</p>
      </div>

      <div className="BioCard">
        <h4>Specialties</h4>
        <div className="SpecialtyTags">
          {staffData.specialties?.map((spec) => (
            <span key={spec} className="SpecialtyTag">
              {spec}
            </span>
          ))}
        </div>
      </div>

      {/* ===== OPENING HOURS ===== */}
      <div className="OpeningHours">
        <h3>Working Schedule</h3>

        <div className="DayTabs">
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
            <span
              key={day}
              className={`DayTab ${activeDay === day ? "active" : ""}`}
              onClick={() => setActiveDay(day)}
            >
              {day}
            </span>
          ))}
        </div>

        {staffData.schedule?.[activeDay] ? (
          <div className="TimeSlotList">
            <div className="TimeSlotRow">
              <span className="SlotLabel">From</span>
              <span className="SlotTime">{formatTime(staffData.schedule[activeDay].startTime)}</span>
              <span className="SlotArrow">→</span>
              <span className="SlotLabel">To</span>
              <span className="SlotTime">{formatTime(staffData.schedule[activeDay].endTime)}</span>
            </div>
            <div className="SlotMeta">
              <span>{staffData.schedule[activeDay].slotDuration} min slots</span>
            </div>
          </div>
        ) : (
          <p className="NoSlots">Not available on {activeDay}</p>
        )}
      </div>

     {/* ===== RATE THIS PROFESSIONAL ===== */}
      {!isOwnProfile && user && (
        <div className="BioCard">
          <h4>Rate this professional</h4>
          <RatingWidget staffId={staffData._id} completedBookingId={completedBookingId} />
        </div>
      )}

      {/* ===== REVIEWS ===== */}
      <div className="BioCard">
        <h4>Reviews</h4>
        <RatingsList staffId={staffData._id} />
      </div>
  
      {/* ===== SERVICES ===== */}
      <div className="Service">
        <h3>My Services</h3>
        <Services staffId={id} />
      </div>

      {/* ===== COLLECTION ===== */}
      <div>
        {collectionSaved && <span className="sr-field-hint">✓ Saved</span>}
        <Collection
          collection={collection}
          featured={featured}
          toggleFeatured={toggleFeatured}
          fileInputRef={fileInputRef}
          handleUpload={handleUpload}
          handleDelete={handleDeleteCollectionItem}
          showBackButton={false}
          isOwner={isOwnProfile}
        />
      </div>

      {isOwnProfile && (
        <Share onPostCreated={(newPost) => setPosts((prev) => [newPost, ...prev])} />
      )}

      {/* ===== POSTS ===== */}
      <div className="Posts">
        <h3>LOOKBOOK</h3>

        <PostGrid posts={posts} onSelect={(index) => setSelectedIndex(index)} />

        {selectedIndex !== null && (
          <PostModal
            posts={posts}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            onClose={() => setSelectedIndex(null)}
          />
        )}
      </div>
    </div>
  );
}