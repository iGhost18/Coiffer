import "./receipt.css";
import { TbCurrencyNaira } from "react-icons/tb";
import { IoCheckmarkCircle } from "react-icons/io5";
import { formatTo12Hour } from "../../utils/time";

export default function Receipt({
  bookings = [],
  orders = [],
  contact,
  address,
  paymentMethod,
  total,
  onClose,
  onViewSchedule,
}) {
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const refFor = (id) => `#${String(id).slice(-6).toUpperCase()}`;

  return (
    <div className="ReceiptOverlay" onClick={onClose}>
      <div className="ReceiptCard" onClick={(e) => e.stopPropagation()}>
        <div className="ReceiptHeader">
          <IoCheckmarkCircle className="ReceiptCheck" />
          <h2>Booking Confirmed</h2>
          <p className="ReceiptSub">We've sent the details to {contact?.email || "your email"}</p>
        </div>

        <div className="ReceiptBody">
          {bookings.map((b) => (
            <div className="ReceiptSection" key={b._id}>
              <div className="ReceiptSectionHead">
                <span className="ReceiptRef">{refFor(b._id)}</span>
                <span className="ReceiptPill">{b.status || "pending"}</span>
              </div>

              <div className="ReceiptRow">
                <span>Date</span>
                <span>{formatDisplayDate(b.appointmentDate?.slice?.(0, 10)) || formatDisplayDate(b.appointmentDate)}</span>
              </div>
              <div className="ReceiptRow">
                <span>Time</span>
                <span>{formatTo12Hour(b.appointmentTime)}</span>
              </div>

              <div className="ReceiptItems">
                {b.services?.map((s, i) => (
                  <div className="ReceiptItem" key={i}>
                    <span>{s.name} × {s.quantity || 1}</span>
                    <span className="ReceiptItemPrice">
                      <TbCurrencyNaira />
                      {(s.price * (s.quantity || 1)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {orders.map((o) => (
            <div className="ReceiptSection" key={o._id}>
              <div className="ReceiptSectionHead">
                <span className="ReceiptRef">{refFor(o._id)}</span>
                <span className="ReceiptPill">{o.status || "pending"}</span>
              </div>

              {o.estimatedDeliveryStart && o.estimatedDeliveryEnd && (
                <div className="ReceiptRow">
                  <span>Estimated delivery</span>
                  <span>
                    {formatDisplayDate(o.estimatedDeliveryStart?.slice?.(0, 10)) || formatDisplayDate(o.estimatedDeliveryStart)}
                    {" – "}
                    {formatDisplayDate(o.estimatedDeliveryEnd?.slice?.(0, 10)) || formatDisplayDate(o.estimatedDeliveryEnd)}
                  </span>
                </div>
              )}

              {o.deliveryStatus && (
                <div className="ReceiptRow">
                  <span>Delivery status</span>
                  <span className="ReceiptPill">{o.deliveryStatus.replace(/_/g, " ")}</span>
                </div>
              )}

              <div className="ReceiptItems">
                {o.items?.map((it, i) => (
                  <div className="ReceiptItem" key={i}>
                    <span>{it.name} × {it.quantity || 1}</span>
                    <span className="ReceiptItemPrice">
                      <TbCurrencyNaira />
                      {(it.price * (it.quantity || 1)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="ReceiptSection">
            <div className="ReceiptRow">
              <span>Name</span>
              <span>{contact?.name}</span>
            </div>
            <div className="ReceiptRow">
              <span>Phone</span>
              <span>{contact?.phone}</span>
            </div>
            {address?.city && (
              <div className="ReceiptRow">
                <span>Location</span>
                <span>{[address.description, address.city, address.state].filter(Boolean).join(", ")}</span>
              </div>
            )}
            <div className="ReceiptRow">
              <span>Payment method</span>
              <span>{paymentMethod}</span>
            </div>
          </div>

          <div className="ReceiptTotalRow">
            <span>Total Paid</span>
            <span className="ReceiptTotal">
              <TbCurrencyNaira />
              {total.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="ReceiptActions">
          <button className="ReceiptBtnGhost" onClick={onClose}>
            Close
          </button>
          <button className="ReceiptBtnPrimary" onClick={onViewSchedule}>
            View My Schedule
          </button>
        </div>
      </div>
    </div>
  );
}