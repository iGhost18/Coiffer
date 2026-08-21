import './feed.css';
import Post from "../post/Post";
import Topbar from "../topbar/Topbar";
import { useState, useEffect, useContext } from 'react';
import api from '../../api';
import { AuthContext } from '../context/AuthContext';
import { StaffAuthContext } from '../context/StaffAuthContext';


export default function Feed({username}) {
  const [activeTab, setActiveTab] = useState("all");
  const [posts, setPosts] = useState([]);
  const {user} = useContext(AuthContext);
  const {staff} = useContext(StaffAuthContext);
  const currentUser = user || staff;


  useEffect(() => {
    const fetchPosts = async () => {
      try {
        let res;

        if (activeTab === "all") {
          res = await api.get("/api/post/timeline");
        }

        if (activeTab === "following") {
          res = await api.get(`/api/post/following/${currentUser._id}`);
        }

        await api.put(
          "/api/notification/read-posts/" +
          currentUser._id
        );
        
        setPosts(Array.isArray(res.data) ? res.data : []);

      } catch (err) {
        console.log(err);
      }
    };

    fetchPosts();
  }, [activeTab, currentUser]);

  return (
    <div className='Feed'>
      <Topbar />

      <div className="FeedWrapper">

        <div className="StickyTab">
          <div className="FeedTabs">

            <span
              className={`FeedTab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Posts
            </span>

            {currentUser && (
              <span
                className={`FeedTab ${activeTab === "following" ? "active" : ""}`}
                onClick={() => setActiveTab("following")}
              >
                Following
              </span>
            )}

          </div>
        </div>
        
        <div className="FeedPosts">
          {posts.map((post)=>(
            <Post key={post._id} post={post}/>
          ))}
        </div>
      </div>
    </div>
  )
}