import React, { useState, useMemo, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "../../components/context/ProductsContext";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";
import { Link } from 'react-router-dom';
import api from "../../api"; 
import "./dashboard.css";

const VIEW_META = {
  overview: ["Overview", "Everything running through the platform right now"],
  services: ["Homepage services", "Add, edit, or remove what shows on the homepage"],
  products: ["Store products", "Manage what's for sale in the store"],
  invites: ["Invites", "Generate and manage registration invites"],
  people: ["Professionals & users", "Everyone registered on the platform"],
  orders: ["Product orders", "Orders placed from the store"],
  bookings: ["Bookings", "Service requests from clients"],
  payments: ["Payments", "All money moving through the platform"],
};

const naira = (n) => "₦" + (n || 0).toLocaleString();

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

function EmptyState({ title, sub }) {
  return (
    <div className="empty">
      <div className="ic">◌</div>
      <div>
        <strong>{title}</strong>
      </div>
      <div>{sub}</div>
    </div>
  );
}

function Pill({ status }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

function Avatar({ src, fallbackText }) {
  const [error, setError] = useState(false);
  if (src && !error) {
    return <img src={src} alt="" className="av-img" onError={() => setError(true)} />;
  }
  return <div className="av">{fallbackText}</div>;
}

export default function DispatchAdmin() {
  const navigate = useNavigate();

  const [view, setView] = useState("overview");
  const [peopleTab, setPeopleTab] = useState("professionals");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [homepageServices, setHomepageServices] = useState([]);
  const [invites, setInvites] = useState([]);
  const [people, setPeople] = useState({ professionals: [], users: [] });
  const [viewTitle, viewSub] = VIEW_META[view];
  const peopleList = people[peopleTab];

  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [liveActivity, setLiveActivity] = useState([]);

  // Expandable detail rows
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedBookingId, setExpandedBookingId] = useState(null);

  const { products, addProduct, updateProduct, deleteProduct } = useProducts();

  const [prdName, setPrdName] = useState("");
  const [prdPrice, setPrdPrice] = useState("");
  const [prdAvailable, setPrdAvailable] = useState(true);
  const [prdImgUploading, setPrdImgUploading] = useState(false);
  const [prdImage, setPrdImage] = useState("");
  const [prdDescription, setPrdDescription] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [prdCategory, setPrdCategory] = useState("");
  const [prdDiscountPrice, setPrdDiscountPrice] = useState("");

  const [hsName, setHsName] = useState("");
  const [hsDesc, setHsDesc] = useState("");
  const [hsImg, setHsImg] = useState("");
  const [hsImgUploading, setHsImgUploading] = useState(false);

  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("");
  const [inviteResult, setInviteResult] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [sendingInviteId, setSendingInviteId] = useState(null);
  const [emailOnCreate, setEmailOnCreate] = useState(true);

  const { staff } = useContext(StaffAuthContext);

  // Switches the active section and closes the mobile drawer, since on
  // small screens picking a nav item should return you to the content.
  const goToView = (nextView) => {
    setView(nextView);
    setSidebarOpen(false);
  };

    const resetForm = () => {
    setPrdName("");
    setPrdPrice("");
    setPrdImage("");
    setPrdDescription("");
    setPrdAvailable(true);
    setPrdCategory("");
    setPrdDiscountPrice("");
    setEditingId(null);
  };

  const startEdit = (p) => {
    setEditingId(p._id);
    setPrdName(p.name);
    setPrdPrice(p.price);
    setPrdImage(p.image);
    setPrdDescription(p.description);
    setPrdAvailable(p.availability);
    setPrdCategory(p.category || "");
    setPrdDiscountPrice(p.discountPrice || "");
  };



  const filteredPeopleList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return peopleList;
    return peopleList.filter((p) => {
      const name = peopleTab === "professionals"
        ? (p.displayName || `${p.firstName} ${p.lastName}`)
        : (p.firstName || p.lastName ? `${p.firstName} ${p.lastName}` : p.username);
      return (name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q);
    });
  }, [peopleList, searchQuery, peopleTab]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      o._id.toLowerCase().includes(q) ||
      (o.contact?.name || "").toLowerCase().includes(q) ||
      (o.customerId?.username || "").toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) =>
      b._id.toLowerCase().includes(q) ||
      (b.contact?.name || "").toLowerCase().includes(q) ||
      (b.staffId?.username || "").toLowerCase().includes(q)
    );
  }, [bookings, searchQuery]);

  const filteredInvites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return invites;
    return invites.filter((i) => i.email.toLowerCase().includes(q));
  }, [invites, searchQuery]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const filteredHomepageServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return homepageServices;
    return homepageServices.filter((s) => s.name.toLowerCase().includes(q));
  }, [homepageServices, searchQuery]);

  const handleSubmit = () => {
    if (!prdName.trim()) return;
    const payload = {
      name: prdName,
      price: prdPrice,
      image: prdImage,
      description: prdDescription,
      available: prdAvailable,
      category: prdCategory.trim(),
      discountPrice: prdDiscountPrice === "" ? null : Number(prdDiscountPrice),
    };
    if (editingId) {
      updateProduct(editingId, payload);
    } else {
      addProduct(payload);
    }
    resetForm();
  };

  const handleProductImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setPrdImgUploading(true);
      const data = new FormData();
      data.append("file", file);
      const res = await api.post("/api/upload", data);
      setPrdImage(res.data.url);
    } catch (err) {
      console.error(err);
    } finally {
      setPrdImgUploading(false);
    }
  };

  const updateDeliveryStatus = async (orderId, deliveryStatus) => {
    try {
      await api.put(`/api/order/${orderId}/delivery-status`, {
        deliveryStatus,
      });

      // Update the order immediately in the UI
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order._id === orderId
            ? {
                ...order,
                deliveryStatus,
              }
            : order
        )
      );
    } catch (error) {
      console.error(
        "Failed to update delivery status:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to update delivery status"
      );
    }
  };

  const DELIVERY_STEPS = [
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
  ];

  // ---------- PEOPLE ----------
  useEffect(() => {
    const fetchProfessionals = async () => {
      try {
        const res = await api.get("/api/staff/admin/all");
        setPeople((prev) => ({ ...prev, professionals: Array.isArray(res.data) ? res.data : [] }));
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfessionals();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get("/api/user/all");
        setPeople((prev) => ({ ...prev, users: Array.isArray(res.data) ? res.data : [] }));
      } catch (err) {
        console.error(err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (homepageServices.length === 0) {
      setInvRole("");
      return;
    }
    const stillValid = homepageServices.some((s) => s.name === invRole);
    if (!stillValid) {
      setInvRole(homepageServices[0].name);
    }
  }, [homepageServices]);

  function logActivity(event, detail) {
    setLiveActivity((prev) =>
      [{ event, detail, when: "just now", timestamp: Date.now() }, ...prev].slice(0, 6)
    );
  }

  // ---------- SERVICES ----------
  async function handleHomepageServiceImgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setHsImgUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setHsImg(res.data.url);
    } catch (err) {
      console.error(err);
      alert("Image upload failed.");
    } finally {
      setHsImgUploading(false);
    }
  }

  async function addHomepageService() {
    const name = hsName.trim();
    const desc = hsDesc.trim();

    if (!name) {
      alert("Give the service a name first.");
      return;
    }
    if (!hsImg) {
      alert("Upload a photo for the service first.");
      return;
    }

    try {
      const res = await api.post("/api/homepage-services", { name, desc, img: hsImg });
      setHomepageServices((prev) => [res.data, ...prev]);
      setHsName("");
      setHsDesc("");
      setHsImg("");
      logActivity("Homepage service added", name);
    } catch (err) {
      console.error(err);
      alert("Couldn't add service. Try again.");
    }
  }

  async function editHomepageService(id) {
    const s = homepageServices.find((x) => x._id === id);
    if (!s) return;

    const name = prompt("Service name", s.name);
    if (name === null) return;

    const desc = prompt("Description", s.desc);
    if (desc === null) return;

    try {
      const res = await api.put(`/api/homepage-services/${id}`, { name, desc });
      setHomepageServices((prev) => prev.map((x) => (x._id === id ? res.data : x)));
    } catch (err) {
      console.error(err);
      alert("Couldn't save changes.");
    }
  }

  async function deleteHomepageService(id) {
    try {
      await api.delete(`/api/homepage-services/${id}`);
      setHomepageServices((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      console.error(err);
      alert("Couldn't remove service.");
    }
  }

  async function sendInviteEmail(invite) {
    setSendingInviteId(invite._id);
    try {
      await api.post("/api/invite-request/send", {
        email: invite.email,
        token: invite.token,
      });
      alert(`Invite emailed to ${invite.email}`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Couldn't send the invite email.");
    } finally {
      setSendingInviteId(null);
    }
  }

  

  // ---------- INVITES ----------
  useEffect(() => {
    const fetchInvites = async () => {
      try {
        const res = await api.get("/api/invite/all");
        setInvites(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchInvites();
  }, []);

  async function generateInvite() {
    const email = invEmail.trim();
    if (!email) {
      alert("Enter an email address.");
      return;
    }

    try {
      const res = await api.post("/api/invite/create", { email, role: invRole });
      const invite = res.data.invite;

      setInvites((prev) => [invite, ...prev]);
      setInviteResult(res.data.inviteLink);
      setInvEmail("");
      logActivity("Invite generated", email);

      if (emailOnCreate && invite?.token) {
        try {
          await api.post("/api/invite-request/send", { email, token: invite.token });
          logActivity("Invite emailed", email);
        } catch (err) {
          console.error(err);
          alert("Invite created, but the email couldn't be sent. Use \"Email invite\" in the table to retry.");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Couldn't generate invite. Try again.");
    }
  }

  function copyInviteResult() {
    navigator.clipboard?.writeText(inviteResult);
  }

  function copyToken(token) {
    navigator.clipboard?.writeText(`${window.location.origin}/staffregister/${token}`);
  }

  async function revokeInvite(id) {
    try {
      await api.delete(`/api/invite/${id}`);
      setInvites((prev) => prev.filter((i) => i._id !== id));
    } catch (err) {
      console.error(err);
      alert("Couldn't revoke invite.");
    }
  }

  // ---------- ORDERS / BOOKINGS ----------
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get("/api/order");
        setOrders(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchOrders();
  }, []);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get("/api/booking");
        setBookings(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBookings();
  }, []);

  async function updateOrderStatus(id, status) {
    try {
      await api.put(`/api/order/${id}/status`, { status });
      setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, status } : o)));
      logActivity("Order status updated", `${id.slice(-6).toUpperCase()} → ${status}`);
    } catch (err) {
      console.error(err);
    }
  }

  async function updateBookingStatus(id, status) {
    try {
      await api.put(`/api/booking/${id}/status`, { status });
      setBookings((prev) => prev.map((b) => (b._id === id ? { ...b, status } : b)));
      logActivity("Booking status updated", `${id.slice(-6).toUpperCase()} → ${status}`);
    } catch (err) {
      console.error(err);
    }
  }

  // ---------- PROFILE NAVIGATION ----------
  function viewProfile(person, type) {
    if (type === "professionals") {
      navigate(`/staffprofile/${person._id}`);
    } else {
      navigate(`/userprofile/${person.username}`);
    }
  }

  // ---------- DERIVED: PAYMENTS ----------
  const derivedPayments = useMemo(() => {
    const fromOrders = orders.map((o) => ({
      ref: `ORD-${o._id.slice(-6).toUpperCase()}`,
      from: o.contact?.name || o.customerId?.username || "Unknown",
      forItem: `#${o._id.slice(-6).toUpperCase()}`,
      amount: o.total,
      status: o.status === "fulfilled" ? "paid" : o.status === "cancelled" ? "failed" : "pending",
      timestamp: o.createdAt,
    }));

    const fromBookings = bookings.map((b) => ({
      ref: `BKG-${b._id.slice(-6).toUpperCase()}`,
      from: b.contact?.name || b.customerId?.username || "Unknown",
      forItem: `#${b._id.slice(-6).toUpperCase()}`,
      amount: b.total,
      status:
        b.status === "confirmed" || b.status === "completed"
          ? "paid"
          : b.status === "cancelled"
          ? "failed"
          : "pending",
      timestamp: b.createdAt,
    }));

    return [...fromOrders, ...fromBookings].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  }, [orders, bookings]);

  const paymentStats = useMemo(() => {
    const total = derivedPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const pending = derivedPayments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const failed = derivedPayments.filter((p) => p.status === "failed").length;
    return { total, pending, failed };
  }, [derivedPayments]);

  // ---------- DERIVED: ACTIVITY FEED ----------
  const combinedActivity = useMemo(() => {
    const fromOrders = orders.map((o) => ({
      event: "Order placed",
      detail: `#${o._id.slice(-6).toUpperCase()} — ${naira(o.total)}`,
      timestamp: o.createdAt,
    }));

    const fromBookings = bookings.map((b) => ({
      event: "Booking requested",
      detail: `#${b._id.slice(-6).toUpperCase()} — ${b.contact?.name || "client"}`,
      timestamp: b.createdAt,
    }));

    const fromInvites = invites.map((i) => ({
      event: "Invite generated",
      detail: i.email,
      timestamp: i.createdAt,
    }));

    const historical = [...fromOrders, ...fromBookings, ...fromInvites].map((a) => ({
      ...a,
      when: timeAgo(a.timestamp),
    }));

    const live = liveActivity.map((a) => ({ ...a, when: timeAgo(a.timestamp) }));

    return [...live, ...historical]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
  }, [orders, bookings, invites, liveActivity]);

  // ---------- DERIVED: OVERVIEW STATS ----------
  const overviewStats = useMemo(() => {
    return [
      { lbl: "Revenue (30d)", val: naira(paymentStats.total), delta: `${naira(paymentStats.pending)} pending`, down: false },
      {
        lbl: "Product orders",
        val: orders.length,
        delta: orders.filter((o) => o.status === "pending").length + " pending",
        down: true,
      },
      {
        lbl: "Bookings",
        val: bookings.length,
        delta: bookings.filter((b) => b.status === "confirmed").length + " confirmed",
        down: false,
      },
      { lbl: "Professionals", val: people.professionals.length, delta: "", down: false },
      { lbl: "Users", val: people.users.length, delta: "", down: false },
    ];
  }, [paymentStats, orders, bookings, people]);

  useEffect(() => {
    const fetchHomepageServices = async () => {
      try {
        const res = await api.get("/api/homepage-services");
        setHomepageServices(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchHomepageServices();
  }, []);

  return (
    <div className="dispatch-admin">
      {/* Mobile hamburger trigger — hidden above 900px via CSS */}
      <button
        className="mobileMenuBtn"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        ☰
      </button>

      {sidebarOpen && (
        <div className="sidebarOverlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <div className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <div className="brand">
          <Link to="/">
            <div className="name">
              <img src="/assets/GhostLogo.png" alt="" />
            </div>
          </Link>
          <div>
            <div className="sub">admin console</div>
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Overview</div>
          <div className={`nav-item ${view === "overview" ? "active" : ""}`} onClick={() => goToView("overview")}>
            <span className="ic">◆</span> Overview
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Content</div>
          <div className={`nav-item ${view === "services" ? "active" : ""}`} onClick={() => goToView("services")}>
            <span className="ic">⌂</span> Homepage services <span className="count">{homepageServices.length}</span>
          </div>
          <div className={`nav-item ${view === "products" ? "active" : ""}`} onClick={() => goToView("products")}>
            <span className="ic">▣</span> Store products <span className="count">{products.length}</span>
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Commerce</div>
          <div className={`nav-item ${view === "orders" ? "active" : ""}`} onClick={() => goToView("orders")}>
            <span className="ic">↓</span> Product orders{" "}
            <span className="count">{orders.filter((o) => o.status === "pending").length}</span>
          </div>
          <div className={`nav-item ${view === "bookings" ? "active" : ""}`} onClick={() => goToView("bookings")}>
            <span className="ic">▤</span> Bookings{" "}
            <span className="count">{bookings.filter((b) => b.status === "pending").length}</span>
          </div>
          <div className={`nav-item ${view === "payments" ? "active" : ""}`} onClick={() => goToView("payments")}>
            <span className="ic">$</span> Payments
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-label">People</div>
          <div className={`nav-item ${view === "people" ? "active" : ""}`} onClick={() => goToView("people")}>
            <span className="ic">◎</span> Professionals &amp; users
          </div>
          <div className={`nav-item ${view === "invites" ? "active" : ""}`} onClick={() => goToView("invites")}>
            <span className="ic">✉</span> Invites{" "}
            <span className="count">{invites.filter((i) => i.status === "active").length}</span>
          </div>
        </div>

        <div className="sidebar-foot">
          Signed in as <strong style={{ color: "#c9cfd8" }}>coiffer@gmail.com</strong>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <div>
            <div className="view-title">{viewTitle}</div>
            <div className="view-sub">{viewSub}</div>
          </div>
          <div className="topbar-right">
            <div className="search">
              <span>⌕</span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search records…"
              />
            </div>
            <div className="admin-chip">
              <Avatar src={staff?.profilePicture} fallbackText={staff?.username?.[0]?.toUpperCase() || "A"} />
            </div>
          </div>
        </div>

        <div className="content">
          {/* OVERVIEW */}
          {view === "overview" && (
            <div className="view active">
              <div className="stat-row">
                {overviewStats.map((s, i) => (
                  <div className="stat-card" key={i}>
                    <div className="lbl">{s.lbl}</div>
                    <div className="val">{s.val}</div>
                    {s.delta && <div className={`delta ${s.down ? "down" : ""}`}>{s.delta}</div>}
                  </div>
                ))}
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Recent activity</h3>
                    <div className="desc">Latest changes across the console</div>
                  </div>
                </div>
                <div className="panel-body flush">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Detail</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinedActivity.length === 0 ? (
                        <tr>
                          <td colSpan={3}>
                            <EmptyState title="No activity yet" sub="" />
                          </td>
                        </tr>
                      ) : (
                        combinedActivity.map((a, i) => (
                          <tr key={i}>
                            <td data-label="Event">
                              <strong>{a.event}</strong>
                            </td>
                            <td data-label="Detail" className="mono">{a.detail}</td>
                            <td data-label="When" style={{ color: "var(--text-dim)" }}>{a.when}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SERVICES */}
          {view === "services" && (
            <div className="view active">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Add a service to the homepage</h3>
                    <div className="desc">dispatch-adminears immediately in the homepage services section</div>
                  </div>
                </div>

                <div className="panel-body">
                  <div className="field">
                    <label>Service name</label>
                    <input value={hsName} onChange={(e) => setHsName(e.target.value)} placeholder="e.g. Fade" />
                  </div>
                  <div className="field">
                    <label>Short description</label>
                    <input
                      value={hsDesc}
                      onChange={(e) => setHsDesc(e.target.value)}
                      placeholder="One line shown under the title on the homepage"
                    />
                  </div>
                  <div className="field">
                    <label>Photo</label>
                    <input type="file" accept="image/*" onChange={handleHomepageServiceImgUpload} />
                    {hsImgUploading && <span className="desc">Uploading…</span>}
                    {hsImg && (
                      <img
                        src={hsImg}
                        alt=""
                        style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, marginTop: 8 }}
                      />
                    )}
                  </div>
                  <button className="btn btn-primary" onClick={addHomepageService} disabled={hsImgUploading}>
                    + Add service
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Live on homepage</h3>
                    <div className="desc">
                      {homepageServices.length} service{homepageServices.length === 1 ? "" : "s"} currently visible to
                      visitors
                    </div>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="card-grid">
                    {filteredHomepageServices.length === 0 ? (
                      <EmptyState title="No services yet" sub="Add one above to get it live on the homepage." />
                    ) : (
                      filteredHomepageServices.map((s) => (
                        <div className="item-card" key={s._id}>
                          <div className="item-thumb">
                            {s.img ? (
                              <img src={s.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              "⌂"
                            )}
                          </div>
                          <div className="item-body">
                            <div className="item-title">{s.name}</div>
                            <div className="item-desc">{s.desc || "No description"}</div>
                            <div className="item-actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => editHomepageService(s._id)}>
                                Edit
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteHomepageService(s._id)}>
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRODUCTS */}
          {view === "products" && (
            <div className="view active">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>{editingId ? "Edit Product" : "Add Product"}</h3>
                    <div className="desc">Manage products that dispatch-adminear in the GhostCut store.</div>
                  </div>
                </div>

                               <div className="panel-body">
                  <div className="form-row">
                    <div className="field">
                      <label>Product Name</label>
                      <input value={prdName} onChange={(e) => setPrdName(e.target.value)} placeholder="Hair Wax" />
                    </div>

                    <div className="field">
                      <label>Price (₦)</label>
                      <input
                        type="number"
                        value={prdPrice}
                        onChange={(e) => setPrdPrice(e.target.value)}
                        placeholder="5000"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="field">
                      <label>Category</label>
                      <input
                        value={prdCategory}
                        onChange={(e) => setPrdCategory(e.target.value)}
                        placeholder="e.g. Hair Cream"
                      />
                    </div>

                    <div className="field">
                      <label>Discount price (₦, optional)</label>
                      <input
                        type="number"
                        value={prdDiscountPrice}
                        onChange={(e) => setPrdDiscountPrice(e.target.value)}
                        placeholder="Leave blank for no discount"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Description</label>
                    <textarea
                      rows={4}
                      value={prdDescription}
                      onChange={(e) => setPrdDescription(e.target.value)}
                      placeholder="Brief description of the product..."
                    />
                  </div>

                  <div className="field">
                    <label>Product Image</label>
                    <input type="file" accept="image/*" onChange={handleProductImageUpload} />
                    {prdImgUploading && <span className="desc">Uploading image...</span>}
                    {prdImage && (
                      <img
                        src={prdImage}
                        alt="preview"
                        style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, marginTop: 10 }}
                      />
                    )}
                  </div>

                  <div className="field">
                    <label>Availability</label>
                    <select value={prdAvailable} onChange={(e) => setPrdAvailable(e.target.value === "true")}>
                      <option value="true">Available</option>
                      <option value="false">Out of Stock</option>
                    </select>
                  </div>

                  <button className="btn btn-primary" onClick={handleSubmit} disabled={prdImgUploading}>
                    {editingId ? "Update Product" : "+ Add Product"}
                  </button>

                  {editingId && (
                    <button className="btn btn-ghost" onClick={resetForm}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Products In Store</h3>
                    <div className="desc">
                      {products.length} product
                      {products.length !== 1 && "s"}
                    </div>
                  </div>
                </div>

                <div className="panel-body">
                  <div className="card-grid">
                    {filteredProducts.length === 0 ? (
                      <EmptyState title="No products yet" sub="Add your first product above." />
                    ) : (
                      filteredProducts.map((p) => (
                        <div className="item-card" key={p._id}>
                          <div className="item-thumb">
                            {p.image ? (
                              <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              "🛍️"
                            )}
                          </div>

                          <div className="item-body">
                            <div className="item-title">{p.name}</div>
                            {p.category && <div className="item-category">{p.category}</div>}
                            <div className="item-desc">{p.description}</div>
                            <div className="item-price">
                              {p.discountPrice ? (
                                <>
                                  <span className="item-price-original">{naira(p.price)}</span>{" "}
                                  <span className="item-price-discount">{naira(p.discountPrice)}</span>
                                </>
                              ) : (
                                naira(p.price)
                              )}
                            </div>

                            <span className={`pill ${p.available ? "live" : "revoked"}`}>
                              {p.available ? "Available" : "Out of Stock"}
                            </span>

                            <div className="item-actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>
                                Edit
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p._id)}>
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INVITES */}
          {view === "invites" && (
            <div className="view active">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Invite a professional or staff member</h3>
                    <div className="desc">Generates a one-time registration link</div>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="form-row">
                    <div className="field">
                      <label>Email address</label>
                      <input
                        type="email"
                        value={invEmail}
                        onChange={(e) => setInvEmail(e.target.value)}
                        placeholder="name@email.com"
                      />
                    </div>
                    <div className="field">
                      <label>Role</label>
                      <select value={invRole} onChange={(e) => setInvRole(e.target.value)}>
                        {homepageServices.length === 0 ? (
                          <option value="">Add a homepage service first</option>
                        ) : (
                          homepageServices.map((s) => (
                            <option key={s._id} value={s.name}>{s.name}</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={emailOnCreate}
                        onChange={(e) => setEmailOnCreate(e.target.checked)}
                      />
                      Email this invite to the applicant
                    </label>
                  <button className="btn btn-primary" onClick={generateInvite}>
                    + Generate invite
                  </button>
                  {inviteResult && (
                    <div className="invite-link-box">
                      <input readOnly value={inviteResult} />
                      <button className="btn btn-ghost btn-sm" onClick={copyInviteResult}>
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Active invites</h3>
                    <div className="desc">
                      {filteredInvites.length} invite{filteredInvites.length === 1 ? "" : "s"} total
                    </div>
                  </div>
                </div>
                <div className="panel-body flush">
                  <table>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Token</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvites.length === 0 ? (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState title="No invites yet" sub="Generate one above." />
                          </td>
                        </tr>
                      ) : (
                        filteredInvites.map((i) => {
                          const status = i.used ? "used" : new Date(i.expiresAt) < new Date() ? "expired" : "active";

                          return (
                            <tr key={i._id}>
                              <td data-label="Email">{i.email}</td>
                              <td data-label="Role">{i.role}</td>
                              <td data-label="Status">
                                <Pill status={status} />
                              </td>
                              <td data-label="Token" className="id">{i.token?.slice(0, 8)}…</td>
                              <td data-label="" style={{ textAlign: "right" }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => copyToken(i.token)}>
                                  Copy link
                                </button>{" "}
                                {status === "active" && (
                                  <>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => sendInviteEmail(i)}
                                      disabled={sendingInviteId === i._id}
                                    >
                                      {sendingInviteId === i._id ? "Sending..." : "Email invite"}
                                    </button>{" "}
                                    <button className="btn btn-danger btn-sm" onClick={() => revokeInvite(i._id)}>
                                      Revoke
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PEOPLE */}
          {view === "people" && (
            <div className="view active">
              <div className="tabs">
                <div
                  className={`tab ${peopleTab === "professionals" ? "active" : ""}`}
                  onClick={() => setPeopleTab("professionals")}
                >
                  Professionals
                </div>
                <div className={`tab ${peopleTab === "users" ? "active" : ""}`} onClick={() => setPeopleTab("users")}>
                  Users
                </div>
              </div>
              <div className="panel">
                <div className="panel-body flush">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        {peopleTab === "professionals" ? (
                          <>
                            <th>Role</th>
                            <th>Experience</th>
                            <th>Rating</th>
                          </>
                        ) : (
                          <>
                            <th>Groomers</th>
                            <th>Appointments</th>
                          </>
                        )}
                        <th>Joined</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPeopleList.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <EmptyState title="Nobody here yet" sub="" />
                          </td>
                        </tr>
                      ) : (
                        filteredPeopleList.map((p) => (
                          <tr key={p._id}>
                            <td data-label="Name">
                              <div className="who">
                                <Avatar
                                  src={p.profilePicture}
                                  fallbackText={
                                    peopleTab === "professionals"
                                      ? `${p.firstName?.[0] || "?"}${p.lastName?.[0] || ""}`
                                      : `${p.username?.[0] || "?"}`.toUpperCase()
                                  }
                                />
                                {peopleTab === "professionals"
                                  ? p.displayName || `${p.firstName} ${p.lastName}`
                                  : (p.firstName || p.lastName ? `${p.firstName} ${p.lastName}`.trim() : p.username)}
                              </div>
                            </td>
                            <td data-label="Contact" style={{ color: "var(--text-dim)" }}>
                              {p.email}
                              {p.phone ? " · " + p.phone : ""}
                            </td>

                            {peopleTab === "professionals" ? (
                              <>

                                <td data-label="Role">
                                  {p.isAdmin ? "Admin" : Array.isArray(p.roles) ? p.roles.join(", ") : p.role || "—"}
                                </td>
                                
                                <td data-label="Experience" className="mono">{p.experience != null ? `${p.experience} yrs` : "—"}</td>
                                <td data-label="Rating" className="mono">{p.rating ? p.rating.toFixed(1) : "—"}</td>
                              </>
                            ) : (
                              <>
                                <td data-label="Groomers" className="mono">{p.Groomers?.length ?? 0}</td>
                                <td data-label="Appointments" className="mono">{p.cuts?.length ?? 0}</td>
                              </>
                            )}

                            <td data-label="Joined" className="mono">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</td>
                            <td data-label="Status">
                              <span className={`pill ${p.isAdmin ? "revoked" : "live"}`}>
                                {p.isAdmin ? "admin" : "active"}
                              </span>
                            </td>
                            <td data-label="" style={{ textAlign: "right" }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => viewProfile(p, peopleTab)}>
                                View profile
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ORDERS */}
          {view === "orders" && (
            <div className="view active">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Product orders</h3>
                    <div className="desc">Orders placed from the store</div>
                  </div>
                </div>

                <div className="panel-body flush">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Item</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Delivery</th>
                        <th></th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <EmptyState title="No orders yet" sub="" />
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((o) => {
                          const isOpen = expandedOrderId === o._id;

                          const addressText = [
                            o.address?.description,
                            o.address?.city,
                            o.address?.state,
                          ]
                            .filter(Boolean)
                            .join(", ");

                          const currentDeliveryIndex = DELIVERY_STEPS.indexOf(
                            o.deliveryStatus || "processing"
                          );

                          const safeDeliveryIndex =
                            currentDeliveryIndex >= 0
                              ? currentDeliveryIndex
                              : 0;

                          return (
                            <React.Fragment key={o._id}>
                              {/* ORDER ROW */}
                              <tr
                                onClick={() =>
                                  setExpandedOrderId(isOpen ? null : o._id)
                                }
                                style={{ cursor: "pointer" }}
                              >
                                <td
                                  data-label="Order"
                                  className="id"
                                >
                                  {o._id.slice(-6).toUpperCase()}
                                </td>

                                <td data-label="Customer">
                                  {o.contact?.name ||
                                    o.customerId?.username ||
                                    "Unknown"}
                                </td>

                                <td data-label="Item">
                                  {o.items
                                    ?.map((i) => i.name)
                                    .join(", ")}
                                </td>

                                <td
                                  data-label="Total"
                                  className="mono"
                                >
                                  {naira(o.total)}
                                </td>

                                {/* ORDER STATUS */}
                                <td data-label="Status">
                                  <Pill status={o.status} />
                                </td>

                                {/* DELIVERY STATUS */}
                                <td
                                  data-label="Delivery"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <select
                                    className="select-sm"
                                    data-delivery={o.deliveryStatus || "processing"}
                                    value={o.deliveryStatus || "processing"}
                                    onChange={(e) => updateDeliveryStatus(o._id, e.target.value)}
                                  >
                                    {DELIVERY_STEPS.map(
                                      (status, index) => (
                                        <option
                                          key={status}
                                          value={status}
                                          disabled={
                                            index <
                                            safeDeliveryIndex
                                          }
                                        >
                                          {status ===
                                          "out_for_delivery"
                                            ? "Out for delivery"
                                            : status
                                                .charAt(0)
                                                .toUpperCase() +
                                              status.slice(1)}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </td>

                                {/* ORDER STATUS SELECT */}
                                <td
                                  data-label=""
                                  style={{
                                    textAlign: "right",
                                  }}
                                  onClick={(e) =>
                                    e.stopPropagation()
                                  }
                                >
                                 <select
                                    className="select-sm"
                                    data-order-status={o.status}
                                    value={o.status}
                                    onChange={(e) => updateOrderStatus(o._id, e.target.value)}
                                  >
                                    <option value="pending">
                                      pending
                                    </option>

                                    <option value="fulfilled">
                                      fulfilled
                                    </option>

                                    <option value="cancelled">
                                      cancelled
                                    </option>
                                  </select>
                                </td>
                              </tr>

                              {/* EXPANDED ORDER DETAILS */}
                              {isOpen && (
                                <tr>
                                  <td colSpan={7}>
                                    <div className="detail-panel">
                                      <div>
                                        <strong>Contact:</strong>{" "}
                                        {o.contact?.name} ·{" "}
                                        {o.contact?.phone} ·{" "}
                                        {o.contact?.email}
                                      </div>

                                      {addressText && (
                                        <div>
                                          <strong>
                                            Delivery address:
                                          </strong>{" "}
                                          {addressText}
                                        </div>
                                      )}

                                      <div>
                                        <strong>
                                          Payment method:
                                        </strong>{" "}
                                        {o.paymentMethod}
                                      </div>

                                      <div>
                                        <strong>
                                          Delivery status:
                                        </strong>{" "}
                                        {o.deliveryStatus ===
                                        "out_for_delivery"
                                          ? "Out for delivery"
                                          : o.deliveryStatus ||
                                            "Processing"}
                                      </div>

                                      {o.estimatedDeliveryStart &&
                                        o.estimatedDeliveryEnd && (
                                          <div>
                                            <strong>
                                              Estimated delivery:
                                            </strong>{" "}
                                            {new Date(
                                              o.estimatedDeliveryStart
                                            ).toLocaleDateString(
                                              "en-US",
                                              {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                              }
                                            )}{" "}
                                            –{" "}
                                            {new Date(
                                              o.estimatedDeliveryEnd
                                            ).toLocaleDateString(
                                              "en-US",
                                              {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                              }
                                            )}
                                          </div>
                                        )}

                                      <div>
                                        <strong>Items:</strong>{" "}
                                        {o.items
                                          ?.map(
                                            (i) =>
                                              `${i.name} ×${
                                                i.quantity || 1
                                              } (${naira(
                                                i.price
                                              )})`
                                          )
                                          .join(", ")}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BOOKINGS */}
          {view === "bookings" && (
            <div className="view active">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Service bookings</h3>
                    <div className="desc">Requests for professionals' services</div>
                  </div>
                </div>
                <div className="panel-body flush">
                  <table>
                    <thead>
                      <tr>
                        <th>Booking</th>
                        <th>Client</th>
                        <th>Professional</th>
                        <th>Service</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <EmptyState title="No bookings yet" sub="" />
                          </td>
                        </tr>
                      ) : (
                        filteredBookings.map((b) => {
                          const isOpen = expandedBookingId === b._id;
                          const addressText = [b.address?.description, b.address?.city, b.address?.state]
                            .filter(Boolean)
                            .join(", ");

                          return (
                            <React.Fragment key={b._id}>
                              <tr
                                onClick={() => setExpandedBookingId(isOpen ? null : b._id)}
                                style={{ cursor: "pointer" }}
                              >
                                <td data-label="Booking" className="id">{b._id.slice(-6).toUpperCase()}</td>
                                <td data-label="Client">{b.contact?.name || b.customerId?.username}</td>
                                <td data-label="Professional">{b.staffId?.username || "—"}</td>
                                <td data-label="Service">{b.services?.map((s) => s.name).join(", ")}</td>
                                <td data-label="Date" className="mono">{new Date(b.appointmentDate).toLocaleDateString()}</td>
                                <td data-label="Status">
                                  <Pill status={b.status} />
                                </td>
                                <td data-label="" style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                                  <select
                                    className="select-sm"
                                    value={b.status}
                                    onChange={(e) => updateBookingStatus(b._id, e.target.value)}
                                  >
                                    <option value="pending">pending</option>
                                    <option value="confirmed">confirmed</option>
                                    <option value="completed">completed</option>
                                    <option value="cancelled">cancelled</option>
                                  </select>
                                </td>
                              </tr>
                              {isOpen && (
                                <tr>
                                  <td colSpan={7}>
                                    <div className="detail-panel">
                                      <div>
                                        <strong>Contact:</strong> {b.contact?.name} · {b.contact?.phone} ·{" "}
                                        {b.contact?.email}
                                      </div>
                                      <div>
                                        <strong>Professional:</strong> {b.staffId?.username}
                                      </div>
                                      <div>
                                        <strong>Time:</strong> {b.appointmentTime}
                                      </div>
                                      {addressText && (
                                        <div>
                                          <strong>Address:</strong> {addressText}
                                        </div>
                                      )}
                                      <div>
                                        <strong>Payment method:</strong> {b.paymentMethod}
                                      </div>
                                      <div>
                                        <strong>Services:</strong>{" "}
                                        {b.services?.map((s) => `${s.name} ×${s.quantity || 1} (${naira(s.price)})`).join(", ")}
                                      </div>
                                      <div>
                                        <strong>Total:</strong> {naira(b.total)}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENTS */}
          {view === "payments" && (
            <div className="view active">
              <div className="stat-row stat-row-3">
                <div className="stat-card">
                  <div className="lbl">Total received</div>
                  <div className="val">{naira(paymentStats.total)}</div>
                </div>
                <div className="stat-card">
                  <div className="lbl">Pending</div>
                  <div className="val">{naira(paymentStats.pending)}</div>
                </div>
                <div className="stat-card">
                  <div className="lbl">Failed transactions</div>
                  <div className="val">{paymentStats.failed}</div>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Transactions</h3>
                    <div className="desc">Derived from orders and bookings — no separate payment ledger yet</div>
                  </div>
                </div>
                <div className="panel-body flush">
                  <table>
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>From</th>
                        <th>For</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {derivedPayments.length === 0 ? (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState title="No transactions yet" sub="" />
                          </td>
                        </tr>
                      ) : (
                        derivedPayments.map((p) => (
                          <tr key={p.ref}>
                            <td data-label="Reference" className="id">{p.ref}</td>
                            <td data-label="From">{p.from}</td>
                            <td data-label="For" className="mono">{p.forItem}</td>
                            <td data-label="Amount" className="mono">{naira(p.amount)}</td>
                            <td data-label="Status">
                              <Pill status={p.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}