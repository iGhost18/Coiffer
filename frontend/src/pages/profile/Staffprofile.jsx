import "./staffprofile.css";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useContext } from "react";
import api from "../../api"; 
import Share from "../../components/share/Share";
import PostGrid from "../../components/post/PostGrid";
import PostModal from "../../components/post/PostModal";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";
import { AuthContext } from "../../components/context/AuthContext";
import Services from "../../components/services/Services";



export default function StaffProfile() {
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;
  const { id } = useParams();
  const [isFollowing, setIsFollowing] = useState(false);
  const [staffData, setStaffData] = useState({});
  const [posts, setPosts] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isGroomer, setIsGroomer] = useState(false);
  const [activeDay, setActiveDay] = useState("Monday");
  const { staff } = useContext(StaffAuthContext);
  const { user, dispatch: userDispatch } = useContext(AuthContext);


  const currentUser = user || staff;

  const navigate = useNavigate();


  useEffect(() => {

    const fetchStaff = async () => {

      try {

        const res = await api.get(
          `/api/staff/${id}`
        );

        const postsRes = await api.get(
          `/api/post/profile/${id}`
        );

        setStaffData(res.data || {});
        setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);

      } catch (err) {
        console.log(err);
      }
    };

    if(id) fetchStaff();

  }, [id]);


  useEffect(() => {
    if (staffData.followers && currentUser) {
      setIsFollowing(staffData.followers.includes(currentUser._id));
    }
  }, [staffData, currentUser]);

  useEffect(() => {
    if (user && staffData) {
      setIsGroomer(
        user?.groomers?.includes(staffData._id)
      );
    }
  }, [user, staffData]);

  const handleFollow = async () => {
    try {
      if (!currentUser?._id) return;

      if (isFollowing) {
        await api.put(`/api/staff/${id}/unfollow`, { userid: currentUser._id });
        setStaffData(prev => ({
          ...prev,
          followers: (prev.followers || []).filter(f => f !== currentUser._id)
        }));
      } else {
        await api.put(`/api/staff/${id}/follow`, { userid: currentUser._id });
        setStaffData(prev => ({
          ...prev,
          followers: [...(prev.followers || []), currentUser._id]
        }));
      }
      setIsFollowing(prev => !prev);
    } catch (err) {
      console.log(err);
    }
  };

  const handleMessage = async () => {
    try {
      if (!currentUser?._id || !staffData?._id) return;

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

  const handleAddGroomer = async () => {
    try {
      await api.put(
        `/api/staff/${staffData._id}/addClient`,
        { userId: user._id }
      );

      setIsGroomer(true);

      userDispatch({
        type: "UPDATE_USER",
        payload: {
          groomers: [...(user.groomers || []), staffData._id],
        },
      });
    } catch (err) {
      console.log(err);
    }
  };

  const getImage = (img, fallback = "person/noAvatar.png") => {
    if (!img) return PF + fallback;

    return img.startsWith("http") ? img : PF + img;
  };


  return (
    
    <div className="StaffProfile">

      <button className="header-btn StaffBackBtn" onClick={() => navigate(-1)}>
        <ChevronLeftIcon />
      </button>

      {/* ===== GALLERY ===== */}
      <div className="StaffGallery">
        <img src={getImage(staffData?.coverPictures?.[0], "person/noCover.png")}  alt=""/>
        <img src={getImage(staffData?.coverPictures?.[1], "person/noCover.png")}  alt="" className="centerImg" />
        <img src={getImage(staffData?.coverPictures?.[2], "person/noCover.png")}  alt=""/>
      </div>

      {/* ===== PROFILE INFO ===== */}
      <div className="ProfileHeader">
        <img
          src={getImage(staffData.profilePicture)}
          alt=""
          className="Avatar"
        />
        <div className="ProfileText">
          <h2>
            {staffData?.displayName || `${staffData?.firstName || ""} ${staffData?.lastName || ""}`.trim() || staffData?.username}
            <span className="Verified">✔</span>
          </h2>
          <p>@{staffData?.username}</p>
          <span className="Role">
            {staffData.roles?.length > 0 ? staffData.roles.join(" · ") : "Professional"}
          </span>
        </div>
        {currentUser && currentUser._id !== id && (
          <div className="HeaderButtons">
            <button className="MessageBtn" onClick={handleMessage}>
              Message
            </button>

            <button
              className={`FollowBtn ${isFollowing ? "following" : ""}`}
              onClick={handleFollow}
            >
              {isFollowing ? "✓ Following" : "+ Follow"}
            </button>

            {/* Groomer button only makes sense for clients adding a staff member,
                so keep it scoped to `user`, not staff-to-staff visits */}
            {user && (
              <button
                className="MessageBtn"
                onClick={handleAddGroomer}
                disabled={isGroomer}
              >
                {isGroomer ? "Groomer ✓ " : "Groomer +"}
              </button>
            )}
          </div>
        )}
        {staff?._id === id && (
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
          {staffData.location?.address
            ? staffData.location.address
            : "Location not specified"
          }
        </p>
        <p>📅 Joined: May 2026</p>
      </div>

      {/* ===== INFO CARDS ===== */}
      <div className="InfoCards">
        <div className="InfoCard">
          <h4>{staffData.workType || "Not specified"}</h4>
          <p>I come to you or you visit me</p>
        </div>
        <div className="InfoCard">
          <h4>Experience</h4>
          <p>{staffData.experience || 0}+ years professional barbering</p>
        </div>
        <div className="InfoCard highlight">
          <h2>{staffData.rating || "N/A"}</h2>
          <p>Rating</p>
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

        {/* Day Tabs - just for show, highlight available days */}
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

        {/* Single time slot displayed for every day */}
        {staffData.schedule?.[activeDay] ? (
        <div className="TimeSlotList">
          <div className="TimeSlotRow">
            <span className="SlotLabel">From</span>
            <span className="SlotTime">{staffData.schedule[activeDay].startTime}</span>
            <span className="SlotArrow">→</span>
            <span className="SlotLabel">To</span>
            <span className="SlotTime">{staffData.schedule[activeDay].endTime}</span>
          </div>
          <div className="SlotMeta">
            <span>{staffData.schedule[activeDay].slotDuration} min slots</span>
          </div>
        </div>
        ) : (
          <p className="NoSlots">Not available on {activeDay}</p>
        )}

      </div> 


      {/* ===== SERVICES ===== */}
      <div className="Service">
        <h3>My Services</h3>
        <Services staffId={id} />
      </div>
      
      {staff?._id === id && (
        <Share onPostCreated={(newPost) => setPosts(prev => [newPost, ...prev])} />
      )}

     {/* ===== POSTS ===== */}
      <div className="Posts">
        <h3>Recent Cuts</h3>

        <PostGrid
          posts={posts}
          onSelect={(index) => setSelectedIndex(index)}
        />

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