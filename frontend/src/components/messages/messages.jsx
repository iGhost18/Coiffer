import "./messages.css";
import { format } from "timeago.js";
import api from "../../api";
import { useEffect, useState } from "react";

// Combines the booking's date + time string ("08:00 AM") into a real
// Date object so we can compare it against the current time. Mirrors
// applyTimeString on the backend so both sides parse it the same way.
function getAppointmentDateTime(booking) {
  if (!booking?.appointmentDate) return null;

  const date = new Date(booking.appointmentDate);
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(
    (booking.appointmentTime || "").trim()
  );

  if (!match) return date;

  let [, hours, minutes, meridiem] = match;
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);

  if (/pm/i.test(meridiem) && hours !== 12) hours += 12;
  if (/am/i.test(meridiem) && hours === 12) hours = 0;

  date.setHours(hours, minutes, 0, 0);
  return date;
}

export default function Messages({ messages, own, isStaff, onBookingUpdate, senderPicture }) {
  const [updating, setUpdating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;

  // Ticks every minute so "Mark Complete" pops up on its own once the
  // appointment time passes, without needing a page refresh
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getImage = (img) => {
    if (!img) return PF + "person/noAvatar.png";
    if (img.startsWith("http")) return img;
    return PF + img;
  };

  if (messages.type === "booking") {
    const status = messages.status || "pending";
    const booking = messages.bookingId;

    const respond = async (newStatus) => {
      if (updating || !booking?._id) return;
      setUpdating(true);
      try {
        await api.put(`/api/booking/${booking._id}/status`, { status: newStatus });
        onBookingUpdate?.(messages._id, newStatus);
      } catch (err) {
        console.error(err);
        alert("Couldn't update that booking. Try again.");
      } finally {
        setUpdating(false);
      }
    };

    const appointmentDateTime = getAppointmentDateTime(booking);
    const appointmentHasPassed = appointmentDateTime ? now >= appointmentDateTime.getTime() : false;

    const counterparty = isStaff ? booking?.customerId : booking?.staffId;
    const hasCustomerAddress =
      booking?.address &&
      (booking.address.description || booking.address.city || booking.address.state);

    const locationText = hasCustomerAddress
      ? [booking.address.description, booking.address.city, booking.address.state]
          .filter(Boolean)
          .join(", ")
      : booking?.staffId?.workType === "stationed" && booking?.staffId?.location
      ? [
          booking.staffId.location.address,
          booking.staffId.location.city,
          booking.staffId.location.state,
          booking.staffId.location.country,
        ]
          .filter(Boolean)
          .join(", ")
      : null;


    return (
      <div className={own ? "message own" : "message"}>
        <div className="bookingCard">
          <div className="bookingCardHeader">
            <div className="bookingCardWho">
              <img
                src={getImage(counterparty?.profilePicture)}
                alt=""
                className="bookingCardAvatar"
              />
              <div>
                <p className="bookingCardUsername">{counterparty?.username || "Unknown user"}</p>
                <p className="bookingCardLabel">Booking request</p>
              </div>
            </div>
            <span className={`bookingStatusPill bookingStatusPill--${status}`}>
              {status}
            </span>
          </div>

          {booking ? (
            <>
              <p className="bookingCardDate">
                📅 {new Date(booking.appointmentDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {booking.appointmentTime}
              </p>

              {booking.services?.length > 0 && (
                <ul className="bookingCardServices">
                  {booking.services.map((s) => (
                    <li key={s.serviceDetailId || s.name}>
                      <span>{s.name} × {s.quantity || 1}</span>
                      <span>₦{s.price}</span>
                    </li>
                  ))}
                </ul>
              )}

              {locationText && (
                <p className="bookingCardAddress">📍 {locationText}</p>
              )}

              {booking.contact && (
                <div className="bookingCardContact">
                  <span className="bookingCardContactName">{booking.contact.name}</span>
                  <span className="bookingCardContactPhone">{booking.contact.phone}</span>
                </div>
              )}

              <div className="bookingCardFooter">
                <span className="bookingCardPayment">{booking.paymentMethod}</span>
                <strong className="bookingCardTotal">₦{booking.total}</strong>
              </div>
            </>
          ) : (
            <p className="bookingCardText">{messages.text}</p>
          )}

          {isStaff && status === "pending" && (
            <div className="bookingCardActions">
              <button
                className="bookingCardBtn bookingCardBtn--decline"
                disabled={updating}
                onClick={() => respond("cancelled")}
              >
                Decline
              </button>
              <button
                className="bookingCardBtn bookingCardBtn--accept"
                disabled={updating}
                onClick={() => respond("confirmed")}
              >
                Accept
              </button>
            </div>
          )}

          {isStaff && status === "confirmed" && appointmentHasPassed && (
            <div className="bookingCardActions">
              <button
                className="bookingCardBtn bookingCardBtn--accept"
                disabled={updating}
                onClick={() => respond("completed")}
              >
                Mark Complete
              </button>
            </div>
          )}
        </div>
        <div className="messageBottom">{format(messages.createdAt)}</div>
      </div>
    );
  }

  return (
    <div className={own ? "message own" : "message"}>
      <div className="messageTop">
        <img src={getImage(senderPicture)} alt="" className="messageImg" />
        <p className="messageText">{messages.text}</p>
      </div>
      <div className="messageBottom">{format(messages.createdAt)}</div>
    </div>
  );
}