import './services.css'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination } from 'swiper/modules'
import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { StaffAuthContext } from '../context/StaffAuthContext';

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import api from "../../api"; 

export default function Services({ staffId }) {
  const { staff } = useContext(StaffAuthContext);
  const [services, setServices] = useState([])
  const [editingId, setEditingId] = useState(null); 

  useEffect(() => {
    if (!staffId) return;

    fetch(`/api/services?staffId=${staffId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setServices(data);
        } else {
          console.error("Unexpected /api/services response:", data);
          setServices([]);
        }
      })
      .catch((err) => console.error(err));
  }, [staffId])

  const [showForm, setShowForm] = useState(false)
  const [newService, setNewService] = useState({ img: '', label: '' })

  const handleChange = (e) => {
    const { name, value } = e.target
    setNewService((prev) => ({ ...prev, [name]: value }))
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      setNewService((prev) => ({ ...prev, img: previewUrl, file }))
    }
  }
  const handleEditClick = (service) => {
    setEditingId(service._id);
    setNewService({
      label: service.label,
      img: service.img,
      file: null,
    });
    setShowForm(true);
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm("Delete this service?")) return;

    try {
      await api.delete(`/api/services/${id}`);
      setServices((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      console.error(err);
      alert(err.response?.data || "Failed to delete service.");
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault()
    if (!newService.label.trim() || !newService.img) return

    try {
      let url = newService.img;

      // only upload a new image if the user picked a new file
      if (newService.file) {
        const formData = new FormData()
        formData.append('file', newService.file)
        const uploadRes = await api.post('/api/upload', formData)
        url = uploadRes.data.url;
      }

      const payload = {
        label: newService.label,
        img: url,
        staffId: staff._id,
      };

      if (editingId) {
        const res = await api.put(`/api/services/${editingId}`, payload);
        const updated = res.data;
        setServices((prev) => prev.map((s) => (s._id === editingId ? updated : s)));
      } else {
        const res = await api.post('/api/services', payload);
        const saved = res.data;
        setServices((prev) => [...prev, saved]);
      }

      if (newService.file) URL.revokeObjectURL(newService.img);
      setNewService({ img: '', label: '' })
      setEditingId(null);
      setShowForm(false)
    } catch (err) {
      console.error(err)
      alert(err.response?.data || "Failed to save service.");
    }
  }

  return (
    <div className="serviceWrapper">
      <div className="serviceHeader">
        {staff?._id === staffId && !staff?.isAdmin && (
          <button className="addServiceBtn" onClick={() => setShowForm(true)}>
            + Add Service
          </button>
        )}

        {staff?._id === staffId && staff?.isAdmin && (
          <Link to="/dashboard" className="dashboardBtn">
            Dashboard
          </Link>
        )}
      </div>

      <Swiper
        modules={[Navigation, Pagination]}
        spaceBetween={16}
        loop={false}
        slidesPerView={1.2}    
        breakpoints={{
          500: { slidesPerView: 1.5, spaceBetween: 16 },
          768: { slidesPerView: 2, spaceBetween: 20 },
          1024: { slidesPerView: 3, spaceBetween: 20 },
        }}
      >
      {services.map((service) => (
        <SwiperSlide key={service._id}>
          <Link to={`/servicedetail/${service._id}`} className="serviceCard">
            <div className="serviceBox">
              <img src={service.img} alt={service.label} />
              <span>{service.label}</span>

              {staff?._id === staffId && (
                <div
                  className="serviceCardStaffActions"
                  onClick={(e) => e.preventDefault()} // don't navigate when clicking these
                >
                  <button
                    className="editServiceBtn"
                    onClick={(e) => {
                      e.preventDefault();
                      handleEditClick(service);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="deleteServiceBtn"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteService(service._id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </Link>
        </SwiperSlide>
      ))}
      </Swiper>

      {showForm && (
        <div className="modalOverlay" onClick={() => setShowForm(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Service</h3>
            <form onSubmit={handleAddService}>
              <label>
                Service Name
                <input
                  type="text"
                  name="label"
                  value={newService.label}
                  onChange={handleChange}
                  placeholder="e.g. beard trim"
                  required
                />
              </label>

              <label>
                Service Image
                <input type="file" accept="image/*" onChange={handleImageUpload} required />
              </label>

              {newService.img && (
                <img src={newService.img} alt="preview" className="imagePreview" />
              )}

              <div className="modalActions">
                <button type="button" className="cancelBtn" onClick={() => {
                  if (newService.file && newService.img) URL.revokeObjectURL(newService.img);
                  setNewService({ img: '', label: '' });
                  setEditingId(null);
                  setShowForm(false);
                }}>
                  Cancel
                </button>
                <button type="submit" className="submitBtn">
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}