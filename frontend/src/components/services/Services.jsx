import './services.css'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination } from 'swiper/modules'
import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { StaffAuthContext } from '../context/StaffAuthContext';

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

export default function Services({ staffId }) {
  const { staff } = useContext(StaffAuthContext);
  const [services, setServices] = useState([])

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

  const handleAddService = async (e) => {
    e.preventDefault()
    if (!newService.label.trim() || !newService.img) return

    try {
      const formData = new FormData()
      formData.append('file', newService.file)

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const { url } = await uploadRes.json()

      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newService.label,
          img: url,
          staffId: staff._id,   // <-- attach the logged-in staff
        }),
      })

      if (!res.ok) throw new Error('Failed to save service')
      const saved = await res.json()

      URL.revokeObjectURL(newService.img) // Clean up the preview URL
      setServices((prev) => [...prev, saved])
      setNewService({ img: '', label: '' })
      setShowForm(false)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="serviceWrapper">
      <div className="serviceHeader">
        {staff?._id === staffId && (
          <button className="addServiceBtn" onClick={() => setShowForm(true)}>
            + Add Service
          </button>
        )}
      </div>

      <Swiper
        modules={[Navigation, Pagination]}
        spaceBetween={20}
        loop={false}
        slidesPerView={3}
        navigation
        pagination={{ clickable: true }}
        breakpoints={{
          640: { slidesPerView: 2 },
          1024: { slidesPerView: 3 },
        }}
      >
        {services.map((service) => (
          <SwiperSlide key={service._id}>
            <Link to={`/servicedetail/${service._id}`} className="serviceCard">
              <div className="serviceBox">
                <img src={service.img} alt={service.label} />
                <span>{service.label}</span>
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
                if (newService.img) URL.revokeObjectURL(newService.img);
                setNewService({ img: '', label: '' });
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