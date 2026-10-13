import "./servicedetail.css";
import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Topbar from "../../components/topbar/Topbar";
import Footer from "../../components/footer/Footer";
import Cart from "../../components/cart/Cart";
import { TbCurrencyNaira } from "react-icons/tb";
import { useCart } from "../../components/context/CartContext";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import api from "../../api";


export default function ServiceDetail() {
  const { serviceId } = useParams();
  const { addToCart } = useCart();
  const { staff } = useContext(StaffAuthContext);

  const navigate = useNavigate();
  const location = useLocation();

  const [serviceDetails, setServiceDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saveError, setSaveError] = useState("");

  const [newDetail, setNewDetail] = useState({
    name: "",
    desc: "",
    duration: "",
    price: "",
    img: "",
    file: null,
  });
  const PF = "/assets/";

  const getImage = (img) => {
    if (!img) return PF + "person/noAvatar.png";
    if (img.startsWith("http")) return img;
    return PF + img;
  };

  // ---- Who owns this service? ----
  // The profile page passes the owner's id when you click a service card.
  // If the page was opened another way (shared link, refresh), fall back to
  // the owner of the first service detail that was loaded.
  const ownerId = String(
    location.state?.ownerId || serviceDetails[0]?.staffId || ""
  );

  // Only the logged-in staff member who owns the service can add details.
  const isServiceOwner =
    Boolean(staff?._id) && ownerId !== "" && String(staff._id) === ownerId;

  // Edit / Delete are checked on each individual detail.
  const canManageDetail = (detail) =>
    Boolean(staff?._id) && String(detail.staffId) === String(staff._id);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.get(`/api/servicedetail/service/${serviceId}`);
        if (!cancelled) {
          setServiceDetails(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        console.error("Failed to load service details:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setNewDetail((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];

    if (file) {
      const preview = URL.createObjectURL(file);

      setNewDetail((prev) => ({
        ...prev,
        img: preview,
        file,
      }));
    }
  };

  const handleAddServiceDetail = async (e) => {
    e.preventDefault();
    setSaveError("");

    // Safety net: even if the form was somehow opened, only the owner can save.
    if (!isServiceOwner) {
      setSaveError("You can only change your own services.");
      return;
    }

    try {
      let url = newDetail.img;

      // only upload a new image if the user picked one
      if (newDetail.file) {
        const formData = new FormData();
        formData.append("file", newDetail.file);
        const uploadRes = await api.post("/api/upload", formData);
        url = uploadRes.data.url;
      }

      const payload = {
        name: newDetail.name,
        desc: newDetail.desc,
        duration: newDetail.duration,
        price: Number(newDetail.price),
        img: url,
        serviceId,
        staffId: staff._id,
      };

      if (editingId) {
        // update existing
        const res = await api.put(`/api/servicedetail/${editingId}`, payload);
        const updatedDetail = res.data;

        setServiceDetails((prev) =>
          prev.map((d) => (d._id === editingId ? updatedDetail : d))
        );
      } else {
        // create new
        const res = await api.post("/api/servicedetail", payload);
        const savedDetail = res.data;

        setServiceDetails((prev) => [...prev, savedDetail]);
      }

      setShowForm(false);
      setEditingId(null);
      setNewDetail({
        name: "",
        desc: "",
        duration: "",
        price: "",
        img: "",
        file: null,
      });
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      setSaveError(
        (typeof data === "string" && data) ||
          data?.message ||
          "Couldn't save. Please try again."
      );
    }
  };

  const handleEditClick = (detail) => {
    if (!canManageDetail(detail)) return;

    setEditingId(detail._id);
    setNewDetail({
      name: detail.name,
      desc: detail.desc,
      duration: detail.duration,
      price: detail.price,
      img: detail.img,
      file: null, // no new file selected unless user picks one
    });
    setShowForm(true);
  };

  const handleDeleteServiceDetail = async (detail) => {
    if (!canManageDetail(detail)) return;
    if (!window.confirm("Delete this service detail?")) return;

    try {
      await api.delete(`/api/servicedetail/${detail._id}`);
      setServiceDetails((prev) => prev.filter((d) => d._id !== detail._id));
    } catch (err) {
      console.error(err);
    }
  };


  if (loading) {
    return (
      <>
        <Topbar />
        <div className="ServiceBody">Loading...</div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Topbar />

      <div className="ServiceBody">
        <div className="CutCardContainer">

          <button
            className="SRVDTbtn"
            onClick={() =>
              navigate(-1)
            }
          >
            <ChevronLeftIcon />
          </button>


          {serviceDetails.length === 0 ? (
            <h3>No service details added yet.</h3>
          ) : (
           serviceDetails.map((detail) => (
            <div className="CutCard" key={detail._id}>
              <div className="CutDetails">
                <img src={getImage(detail.img)} alt={detail.name} />

                <div className="CutCardText">
                  <h5 className="CutCardHeader">{detail.name}</h5>
                  <h6 className="CutCardWriteUp">{detail.desc}</h6>

                  <div className="CutCardPandD">
                    <h3 className="Price">
                      <TbCurrencyNaira className="PriceIcon" />
                      {detail.price.toLocaleString()}
                    </h3>
                    <h6 className="Duration">{detail.duration}</h6>
                  </div>

                  <button
                    className="CutCardButton"
                    onClick={() =>
                      addToCart({
                        ...detail,
                        itemId: detail._id,
                        serviceDetailId: detail._id,
                        itemType: "service",
                      })
                    }
                  >
                    Schedule
                  </button>

                  {/* Only the staff member who owns this detail sees these */}
                  {canManageDetail(detail) && (
                    <div className="CutCardStaffActions">
                      <button
                        className="editBtn"
                        onClick={() => handleEditClick(detail)}
                      >
                        Edit
                      </button>
                      <button
                        className="deleteBtn"
                        onClick={() => handleDeleteServiceDetail(detail)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
          )}

          {/* Only the owner of this service can add a new detail */}
          {isServiceOwner && (
            <button
              className="addServiceBtn"
              onClick={() => setShowForm(true)}
            >
              + Add Service Detail
            </button>
          )}
        </div>

        <Cart  showBackButton={false}/>
      </div>

      {showForm && isServiceOwner && (
        <div
          className="modalOverlay"
          onClick={() => setShowForm(false)}
        >
          <div
            className="modalContent"
            onClick={(e) => e.stopPropagation()}
          >

            <h3>{editingId ? "Edit Service Detail" : "Add Service Detail"}</h3>

            <form onSubmit={handleAddServiceDetail}>

              <label>
                Name
                <input
                  type="text"
                  name="name"
                  value={newDetail.name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  name="desc"
                  value={newDetail.desc}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Duration
                <input
                  type="text"
                  name="duration"
                  value={newDetail.duration}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Price
                <input
                  type="number"
                  name="price"
                  value={newDetail.price}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  required={!editingId}
                />
              </label>

              {newDetail.img && (
                <img
                  src={newDetail.img}
                  alt="Preview"
                  className="imagePreview"
                />
              )}

              {saveError && (
                <p style={{ color: "#c0392b", fontSize: 13, margin: "8px 0" }}>
                  {saveError}
                </p>
              )}

              <div className="modalActions">

                <button
                  type="button"
                  className="cancelBtn"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setNewDetail({
                      name: "",
                      desc: "",
                      duration: "",
                      price: "",
                      img: "",
                      file: null,
                    });
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="submitBtn"
                >
                  Save
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      <Footer />
    </>
  );
}