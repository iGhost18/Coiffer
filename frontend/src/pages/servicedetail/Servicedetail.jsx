import "./servicedetail.css";
import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import Topbar from "../../components/topbar/Topbar";
import Footer from "../../components/footer/Footer";
import Cart from "../../components/cart/Cart";
import { TbCurrencyNaira } from "react-icons/tb";
import { useCart } from "../../components/context/CartContext";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";
import { useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";


export default function ServiceDetail() {
  const { serviceId } = useParams();
  const { addToCart } = useCart();
  const { staff } = useContext(StaffAuthContext);
  
  // inside the component
  const navigate = useNavigate();

  const [serviceDetails, setServiceDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);

  const [newDetail, setNewDetail] = useState({
    name: "",
    desc: "",
    duration: "",
    price: "",
    img: "",
    file: null,
  });
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;

  const getImage = (img) => {
    if (!img) return PF + "person/noAvatar.png";
    if (img.startsWith("http")) return img;
    return PF + img;
  };

  useEffect(() => {
    fetch(`/api/servicedetail/service/${serviceId}`)
      .then((res) => res.json())
      .then((data) => {
        setServiceDetails(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
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

    try {
      // upload image
      const formData = new FormData();
      formData.append("file", newDetail.file);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Image upload failed");
      const { url } = await uploadRes.json();

      // save detail
      const res = await fetch("/api/servicedetail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newDetail.name,
          desc: newDetail.desc,
          duration: newDetail.duration,
          price: Number(newDetail.price),
          img: url,
          serviceId,
          staffId: staff._id,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save service detail");
      }

      const savedDetail = await res.json();

      setServiceDetails((prev) => [...prev, saved]);

      setShowForm(false);

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

                    <h5 className="CutCardHeader">
                      {detail.name}
                    </h5>

                    <h6 className="CutCardWriteUp">
                      {detail.desc}
                    </h6>

                    <div className="CutCardPandD">

                      <h3 className="Price">
                        <TbCurrencyNaira className="PriceIcon" />
                        {detail.price.toLocaleString()}
                      </h3>

                      <h6 className="Duration">
                        {detail.duration}
                      </h6>

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

                  </div>

                </div>
              </div>
            ))
          )}
            
          {staff && (
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

      {showForm && (
        <div
          className="modalOverlay"
          onClick={() => setShowForm(false)}
        >
          <div
            className="modalContent"
            onClick={(e) => e.stopPropagation()}
          >

            <h3>Add Service Detail</h3>

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
                  required
                />
              </label>

              {newDetail.img && (
                <img
                  src={newDetail.img}
                  alt="Preview"
                  className="imagePreview"
                />
              )}

              <div className="modalActions">

                <button
                  type="button"
                  className="cancelBtn"
                  onClick={() => setShowForm(false)}
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