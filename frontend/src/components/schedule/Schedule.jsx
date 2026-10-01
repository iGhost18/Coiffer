import "./schedule.css";
import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import api from "../../api";

import { AuthContext } from "../../components/context/AuthContext";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";

import DeliveryTracker from "../../components/deliverytracker/DeliveryTracker";
import PayoutActions from "../../components/payout/PayoutActions";
import PayoutSetup from "../../components/payout/Payoutsetup";

// ---- Helpers -----------------------------------------------------------

const dateKey = (iso) =>
  new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC", // the stored instant's UTC numbers ARE the intended wall-clock date
  });

const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC", // same reasoning — display the raw numbers, don't convert
  });

const statusLabel = {
  confirmed: "Confirmed",
  pending: "Pending",
  processing: "Processing",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

// A schedule item's own `address` (from Booking) only exists for mobile
// appointments where the customer specified a location. Stationed
// appointments happen at the staff's own place, so fall back to their
// profile location instead.
const getLocationText = (booking, staff) => {
  const addr = booking?.address;
  const hasCustomerAddress = addr?.description || addr?.city || addr?.state;

  if (hasCustomerAddress) {
    return [addr.description, addr.city, addr.state]
      .filter(Boolean)
      .join(", ");
  }

  if (staff?.workType === "stationed" && staff?.location) {
    return [staff.location.address, staff.location.city, staff.location.state, staff.location.country]
      .filter(Boolean)
      .join(", ");
  }

  return null;
};

// ---- Component -----------------------------------------------------------

export default function Schedule() {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);

  const currentUser = user || staff;
  const isStaff = !!staff;

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | appointment | order
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        let response;

        if (isStaff) {
          response = await api.get(`/api/schedule/staff/${staff._id}`);
        } else {
          response = await api.get(`/api/schedule/user/${user._id}`);
        }

        const schedules = Array.isArray(response.data)
          ? [...response.data].sort((a, b) => new Date(a.date) - new Date(b.date))
          : [];
        setItems(schedules);
      } catch (err) {
        console.log(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedule();
  }, [user, staff]);

  useEffect(() => {
    if (currentUser) {
      api.put(`/api/schedule/mark-viewed/${currentUser._id}`).catch(console.error);
    }
  }, [currentUser]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => item.type === filter);
  }, [items, filter]);

  const groupedByDay = useMemo(() => {
    const groupMap = new Map();

    filteredItems.forEach((item) => {
      const key = dateKey(item.date);
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key).push(item);
    });

    const groups = Array.from(groupMap.entries()).map(([key, dayItems]) => {
      const sortedItems = [...dayItems].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      const mostRecentCreatedAt = Math.max(
        ...dayItems.map((item) => new Date(item.createdAt).getTime())
      );

      return { key, items: sortedItems, mostRecentCreatedAt };
    });

    groups.sort((a, b) => b.mostRecentCreatedAt - a.mostRecentCreatedAt);

    return groups;
  }, [filteredItems]);

  if (!currentUser) {
    return (
      <div className="schedule-page">
        <div className="schedule-empty">
          <p>Log in to see your schedule.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <div>
          <div className="btnAndText">
            <button
              className="scheduleBackbtn"
              onClick={() => {
                if (location.state?.fromCheckout) {
                  navigate("/");
                } else {
                  navigate(-1);
                }
              }}
            >
              <ChevronLeftIcon />
            </button>

            <h2 className="schedule-title">
              {isStaff ? "Your Schedule" : "My Schedule"}
            </h2>
          </div>
          <p className="schedule-subtitle">
            {isStaff
              ? "Appointments and orders across all your clients"
              : "Your upcoming appointments and orders"}
          </p>
        </div>

        <div className="schedule-filters" role="tablist" aria-label="Filter schedule">
          {[
            { key: "all", label: "All" },
            { key: "appointment", label: "Appointments" },
            { key: "order", label: "Orders" },
          ].map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              className={`schedule-filter-btn ${filter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Staff: where payouts are sent */}
      {isStaff && <PayoutSetup />}

      {isLoading && (
        <div className="schedule-empty">
          <p>Loading your schedule…</p>
        </div>
      )}

      {!isLoading && filteredItems.length === 0 && (
        <div className="schedule-empty">
          <p>Nothing here yet.</p>
          <span>
            {filter === "order"
              ? "Orders you place will show up here."
              : filter === "appointment"
              ? "Appointments you book will show up here."
              : "Book an appointment or place an order to see it here."}
          </span>
        </div>
      )}

      {!isLoading &&
        groupedByDay.map((group) => (
          <div key={group.key} className="schedule-day-group">
            <div className="schedule-day-label">{group.key}</div>

            <div className="schedule-timeline">
              {group.items.map((item) => {
                const booking = item.bookingId; // populated Booking doc, only for appointments
                const counterparty = isStaff ? item.userId : item.staffId;
                const locationText = getLocationText(booking, item.staffId);

                return (
                  <div
                    key={item._id}
                    className={`schedule-card schedule-card--${item.type}`}
                  >
                    <div className="schedule-card-time">
                      {timeLabel(item.date)}
                    </div>

                    <div className="schedule-card-stripe" />

                    <div className="schedule-card-body">
                      <div className="schedule-card-top">
                        <span className={`schedule-type-badge schedule-type-badge--${item.type}`}>
                          {item.type === "appointment" ? "Haircut" : "Order"}
                        </span>
                        <span className={`schedule-status schedule-status--${item.status}`}>
                          {statusLabel[item.status] || item.status}
                        </span>
                      </div>

                      <p className="schedule-card-main-title">{item.title}</p>
                      <p className="schedule-card-subtitle">{item.subtitle}</p>

                      {item.type === "appointment" && booking && (
                        <>
                          {booking.services?.length > 0 && (
                            <ul className="schedule-card-services">
                              {booking.services.map((s, i) => (
                                <li key={s.serviceDetailId || `${s.name}-${i}`}>
                                  <span>{s.name} × {s.quantity || 1}</span>
                                  <span>₦{s.price}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {locationText && (
                            <p className="schedule-card-location">📍 {locationText}</p>
                          )}

                          {booking.contact && (
                            <div className="schedule-card-contact">
                              <span>{booking.contact.name}</span>
                              <span>{booking.contact.phone}</span>
                            </div>
                          )}

                          <div className="schedule-card-footer">
                            <span>{booking.paymentMethod}</span>
                            <strong>₦{booking.total}</strong>
                          </div>

                          {/* Paid bookings: confirm job done / report a problem */}
                          {item.status !== "cancelled" && (
                            <PayoutActions
                              booking={booking}
                              role={isStaff ? "staff" : "customer"}
                              bookingStatus={item.status}
                            />
                          )}
                        </>
                      )}

                      {item.type === "order" && item.orderId && (
                        <>
                          {item.orderId.items?.length > 0 && (
                            <ul className="schedule-card-services">
                              {item.orderId.items.map((i) => (
                                <li key={i.itemId}>
                                  <span>
                                    {i.name} × {i.quantity || 1}
                                  </span>

                                  <span>₦{i.price}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {item.orderId.address?.description && (
                            <p className="schedule-card-location">
                              📍{" "}
                              {[
                                item.orderId.address.description,
                                item.orderId.address.city,
                                item.orderId.address.state,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}

                          {item.orderId.contact && (
                            <div className="schedule-card-contact">
                              <span>{item.orderId.contact.name}</span>
                              <span>{item.orderId.contact.phone}</span>
                            </div>
                          )}

                          <div className="schedule-card-footer">
                            <span>{item.orderId.paymentMethod}</span>
                            <strong>₦{item.orderId.total}</strong>
                          </div>

                          {/* Delivery tracking */}
                          <DeliveryTracker order={item.orderId} />
                        </>
                      )}

                      {isStaff && counterparty && (
                        <p className="schedule-card-customer">
                          Client: {counterparty.name || counterparty.username}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}