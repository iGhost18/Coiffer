import "./messages.css";
import { format } from "timeago.js";
import api from "../../api";
import { useEffect, useState } from "react";
import { formatTo12Hour } from "../../utils/time";
import { getAppointmentEndDateTime } from "../../utils/bookingtime";
import PayoutActions from "../payout/PayoutActions";

export default function Messages({ messages, own, isStaff, onBookingUpdate, senderPicture }) {
  const [updating, setUpdating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const PF = process.env.REACT_APP_PUBLIC_FOLDER;

  // Ticks every minute so time-dependent buttons appear on their own once
  // the appointment has finished, without needing a page refresh.
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
        alert(err.response?.data?.message || "Couldn't update that booking. Try again.");
      } finally {
        setUpdating(false);
      }
    };

    const appointmentEndDateTime = getAppointmentEndDateTime(booking);
    const appointmentHasPassed = appointmentEndDateTime ? now >= appointmentEndDateTime.getTime() : false;

    // Bookings paid through Flutterwave use the escrow confirm/dispute flow.
    // Only unpaid (direct) bookings keep the old "Mark Complete" button.
    const hasEscrow = booking?.payoutStatus && booking.payoutStatus !== "none";

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
                · {formatTo12Hour(booking.appointmentTime)}
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

          {/* Unpaid/direct bookings only */}
          {isStaff && !hasEscrow && status === "confirmed" && appointmentHasPassed && (
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

          {/* Paid bookings: confirm job done / report a problem */}
          {booking && status !== "cancelled" && (
            <PayoutActions
              booking={booking}
              role={isStaff ? "staff" : "customer"}
              bookingStatus={status}
            />
          )}
        </div>
        <div className="messageBottom">{format(messages.createdAt)}</div>
      </div>
    );
  }

  return (
    <div className={own ? "message own" : "message"}>
      <div className="messageTop">
        <div className="messageBubble">
          {messages.media?.url && (
            <div
              className="messageMediaWrapper"
              onClick={() => messages.media.type === "image" && setLightboxOpen(true)}
            >
              {messages.media.type === "video" ? (
                <video
                  src={messages.media.url}
                  className="messageMedia"
                  controls
                  playsInline
                />
              ) : (
                <img
                  src={messages.media.url}
                  alt=""
                  className="messageMedia messageMedia--clickable"
                />
              )}
            </div>
          )}
          {messages.text && <p className="messageText">{messages.text}</p>}
        </div>
        <img src={getImage(senderPicture)} alt="" className="messageImg" />
      </div>
      <div className="messageBottom">{format(messages.createdAt)}</div>

      {lightboxOpen && messages.media?.type === "image" && (
        <div className="mediaLightboxOverlay" onClick={() => setLightboxOpen(false)}>
          <button
            className="mediaLightboxClose"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>
          <img
            src={messages.media.url}
            alt=""
            className="mediaLightboxImg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}