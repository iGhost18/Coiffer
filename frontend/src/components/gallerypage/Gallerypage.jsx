import { useState, useRef, useEffect, useContext } from "react";
import api from "../../api";
import Gallery from "../gallery/Gallery";
import { AuthContext } from "../context/AuthContext";
import { StaffAuthContext } from "../context/StaffAuthContext";

export default function Gallerypage() {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);
  const currentUser = user || staff;

  const [photos, setPhotos] = useState([]);
  const [featured, setFeatured] = useState([]);
  const fileInputRef = useRef(null);

  const putUrl = staff
    ? `/api/staff/${currentUser?._id}`
    : `/api/user/${currentUser?._id}`;

  // Single helper so every save sends the same payload
  const saveToServer = (newPhotos, newFeatured) =>
    api.put(putUrl, {
      gallery: newPhotos, // backend field name unchanged
      featured: newFeatured,
      userId: currentUser._id,
      userid: currentUser._id,
    });

  useEffect(() => {
    if (!currentUser?._id) return;

    const fetchPhotos = async () => {
      try {
        const res = await api.get(
          staff
            ? `/api/staff/${currentUser._id}`
            : `/api/user?username=${currentUser.username}`
        );
        setPhotos(res.data?.gallery || []);
        setFeatured(res.data?.featured || []);
      } catch (err) {
        console.log(err);
      }
    };

    fetchPhotos();
  }, [currentUser?._id, staff]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

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

      const newPhotos = [...photos, ...uploadedUrls];
      setPhotos(newPhotos);

      if (currentUser?._id) await saveToServer(newPhotos, featured);
    } catch (err) {
      console.log(err);
    } finally {
      e.target.value = ""; // lets you re-select the same file
    }
  };

  const handleDelete = async (url) => {
    const newPhotos = photos.filter((u) => u !== url);
    const newFeatured = featured.filter((u) => u !== url);

    setPhotos(newPhotos);
    setFeatured(newFeatured);

    if (currentUser?._id) {
      try {
        await saveToServer(newPhotos, newFeatured);
      } catch (err) {
        console.log(err);
      }
    }
  };

  const toggleFeatured = async (url) => {
    let newFeatured;

    if (featured.includes(url)) {
      newFeatured = featured.filter((u) => u !== url);
    } else {
      if (featured.length >= 7) {
        alert("You can only feature up to 7 images");
        return;
      }
      newFeatured = [...featured, url];
    }

    setFeatured(newFeatured);

    if (currentUser?._id) {
      try {
        await saveToServer(photos, newFeatured);
      } catch (err) {
        console.log(err);
      }
    }
  };

  return (
    <Gallery
      photos={photos}
      featured={featured}
      toggleFeatured={toggleFeatured}
      fileInputRef={fileInputRef}
      handleUpload={handleUpload}
      handleDelete={handleDelete}
      isOwner={true}
    />
  );
}