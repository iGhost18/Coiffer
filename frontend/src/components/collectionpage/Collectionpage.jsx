import { useState, useRef, useEffect, useContext } from "react";
import api from "../../api";
import Collections from "../../components/collections/Collections";
import { AuthContext } from "../../components/context/AuthContext";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";

export default function CollectionsPage() {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);
  const currentUser = user || staff;

  const [collection, setCollection] = useState([]);
  const [featured, setFeatured] = useState([]);
  const fileInputRef = useRef(null);

    useEffect(() => {
        if (!currentUser?._id) return;

        const fetchCollection = async () => {
        try {
            const res = await api.get(
            staff
                ? `/api/staff/${currentUser._id}`
                : `/api/user?username=${currentUser.username}`
            );
            setCollection(res.data?.collection || []);
            setFeatured(res.data?.featured || []);
        } catch (err) {
            console.log(err);
        }
        };

        fetchCollection();
    }, [currentUser, staff]);

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

        const newCollection = [...collection, ...uploadedUrls];
        setCollection(newCollection);

        if (currentUser?._id) {
            const url = staff
            ? `/api/staff/${currentUser._id}`
            : `/api/user/${currentUser._id}`;
            await api.put(putUrl, {
                collection,
                featured: newFeatured,
                userId: currentUser._id,
                userid: currentUser._id,
            });
        }
        } catch (err) {
        console.log(err);
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
            const putUrl = staff
            ? `/api/staff/${currentUser._id}`
            : `/api/user/${currentUser._id}`;

            await axios.put(putUrl, {
                collection,
                featured: newFeatured,
                userId: currentUser._id,
                userid: currentUser._id,
            });
        } catch (err) {
            console.log(err);
        }
        }
    };

    return (
        <Collections
        collection={collection}
        featured={featured}
        toggleFeatured={toggleFeatured}
        fileInputRef={fileInputRef}
        handleUpload={handleUpload}
        />
    );
}