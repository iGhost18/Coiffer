import "./saves.css";
import { useContext, useEffect, useState } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";

import Topbar from "../topbar/Topbar";
import Footer from "../footer/Footer";
import Post from "../post/Post";

import { AuthContext } from "../context/AuthContext";
import { StaffAuthContext } from "../context/StaffAuthContext";

export default function Saves() {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);
  const currentUser = user || staff;
  const navigate = useNavigate();

  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?._id) {
      setLoading(false);
      return;
    }

    const fetchSaved = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/post/saved/${currentUser._id}`);
        setSavedPosts(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSaved();
  }, [currentUser]);

  return (
    <>
      <Topbar />

      <div className="SavesPage">
        <div className="SavesHeader">
          <button className="saveBackbtn" onClick={() => navigate(-1)}>
            <ChevronLeftIcon />
          </button>

          <h2 className="SavesTitle">Saved posts</h2>
        </div>

        {loading && <p className="SavesEmpty">Loading...</p>}

        {!loading && savedPosts.length === 0 && (
          <p className="SavesEmpty">
            Nothing saved yet. Tap the bookmark icon on any post to keep it here.
          </p>
        )}

        {!loading &&
          savedPosts.map((post) => <Post key={post._id} post={post} />)}
      </div>

      <Footer />
    </>
  );
}