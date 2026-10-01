import "./checkout.css";
import Topbar from "../../components/topbar/Topbar";
import Footer from "../../components/footer/Footer";
import { useState, useContext } from "react";
import {
  DatePicker,
  TimeSlots,
} from "../../components/dateTime/DateAndTime";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../components/context/CartContext";
import { TbCurrencyNaira } from "react-icons/tb";
import { AuthContext } from "../../components/context/AuthContext";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { formatTo12Hour } from "../../utils/time";
import Receipt from "../../components/receipt/Receipt";
import api from "../../api";

export default function Checkout() {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    state: "",
    city: "",
    description: "",
  });

  const [paymentMethod, setPaymentMethod] =
    useState("Flutterwave");

  const [isCheckingOut, setIsCheckingOut] =
    useState(false);

  const [receiptData, setReceiptData] =
    useState(null);

  const { user } = useContext(AuthContext);

  const navigate = useNavigate();

  const {
    cartItems,
    total,
  } = useCart();

  const grandTotal = total;

  const deliveryWindow =
    getDeliveryWindow(formData.state);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  function toLocalDateString(date) {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(date) {
    const days = [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ];

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    return `${days[date.getDay()]}, ${date.getDate()} ${
      months[date.getMonth()]
    } ${date.getFullYear()}`;
  }

  function getDeliveryWindow(state) {
    const normalizedState = String(
      state || ""
    )
      .trim()
      .toLowerCase();

    if (!normalizedState) {
      return null;
    }

    const isLagos =
      normalizedState === "lagos";

    const start = new Date();

    start.setHours(0, 0, 0, 0);

    // Lagos: tomorrow
    // Other states: 3 days from today
    start.setDate(
      start.getDate() +
        (isLagos ? 1 : 3)
    );

    const end = new Date(start);

    // 3-day delivery interval
    end.setDate(
      end.getDate() + 3
    );

    return {
      start,
      end,
    };
  }

  function formatDeliveryDate(date) {
    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
      }
    );
  }

  const handleCheckout = async () => {
    if (isCheckingOut) return;

    setIsCheckingOut(true);

    try {
      if (!user) {
        alert("Please login first.");
        return;
      }

      if (cartItems.length === 0) {
        alert("Your cart is empty.");
        return;
      }

      if (
        !formData.name ||
        !formData.email ||
        !formData.phone
      ) {
        alert(
          "Please fill in your contact details."
        );
        return;
      }

      const serviceItems =
        cartItems.filter(
          (item) =>
            item.itemType === "service"
        );

      if (
        serviceItems.length > 0 &&
        (!selectedDate || !selectedTime)
      ) {
        alert(
          "Please select a date and time for your appointment."
        );
        return;
      }

      if (
        paymentMethod !== "Flutterwave"
      ) {
        alert(
          "Please select Flutterwave."
        );
        return;
      }

      const contact = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
      };

      const address = {
        state: formData.state,
        city: formData.city,
        description:
          formData.description,
      };

      const appointmentDate =
        selectedDate
          ? toLocalDateString(
              selectedDate
            )
          : null;

      const appointmentTime =
        selectedTime || null;

      const response =
        await api.post(
          "/api/payment/create",
          {
            contact,
            address,
            cartItems,
            appointmentDate,
            appointmentTime,
          }
        );

      if (
        !response.data?.checkoutUrl
      ) {
        throw new Error(
          "Flutterwave checkout URL was not returned."
        );
      }

      /*
       * Do NOT clear the cart here.
       * The customer has not paid yet.
       */

      window.location.href = response.data.checkoutUrl;
    } catch (err) {
      console.error(
        "Payment initiation failed:",
        err.response?.status,
        JSON.stringify(err.response?.data || err.message)
      );

      if (err.response?.status === 409) {
        alert(
          "Sorry, that time slot was just booked by someone else. Please pick another time."
        );
        setSelectedTime(null);
        setRefreshKey((k) => k + 1);
      } else {
        alert(
          err.response?.data?.errors
            ?.map((item) => `${item.field}: ${item.message}`)
            .join("\n") ||
            err.response?.data?.message ||
            err.message ||
            "Payment initiation failed."
        );
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  const hasServiceItems =
    cartItems.some(
      (item) =>
        item.itemType === "service"
    );

  return (
    <>
      <Topbar />

      <button
        className="checkOutbtn"
        onClick={() => navigate(-1)}
      >
        <ChevronLeftIcon />
      </button>

      <div className="CheckoutWrapper">

        {/* ==================================================
            LEFT SIDE
        ================================================== */}

        <div className="CheckoutLeft">
          <form>

            {/* CONTACT DETAILS */}
            <div className="FormSection">
              <h3 className="FormSectionTitle">
                Contact details
              </h3>

              <p className="FormSectionHint">
                We'll send your confirmation here.
              </p>

              <div className="InputWrapper">
                <label>Name</label>

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              <div className="InputWrapper">
                <label>Email</label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div className="InputWrapper">
                <label>Phone</label>

                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>


            {/* APPOINTMENT */}
            {hasServiceItems && (
              <div className="FormSection">
                <h3 className="FormSectionTitle">
                  Appointment
                </h3>

                <p className="FormSectionHint">
                  Choose a date and time slot.
                </p>

                <div className="FormGrid2">

                  <div className="InputWrapper">
                    <label>Date</label>

                    <DatePicker
                      selectedDate={
                        selectedDate
                      }
                      setSelectedDate={
                        setSelectedDate
                      }
                    />
                  </div>

                  <div className="InputWrapper">
                    <label>Time</label>

                    <TimeSlots
                      selectedDate={
                        selectedDate
                      }
                      selectedTime={
                        selectedTime
                      }
                      setSelectedTime={
                        setSelectedTime
                      }
                      refreshKey={
                        refreshKey
                      }
                      staffId={
                        cartItems.find(
                          (i) =>
                            i.itemType ===
                            "service"
                        )?.staffId
                      }
                      serviceId={
                        cartItems.find(
                          (i) =>
                            i.itemType ===
                            "service"
                        )?.itemId
                      }
                      duration={
                        cartItems.find(
                          (i) =>
                            i.itemType ===
                            "service"
                        )?.duration
                      }
                    />
                  </div>

                </div>
              </div>
            )}


            {/* LOCATION */}
            <div className="FormSection">
              <h3 className="FormSectionTitle">
                Location
              </h3>

              <p className="FormSectionHint">
                Where should the Expert meet you.
              </p>

              <div className="FormGrid2">

                <div className="InputWrapper">
                  <label>State</label>

                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                  />
                </div>

                <div className="InputWrapper">
                  <label>Town / City</label>

                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>

              </div>

              <div className="InputWrapper">
                <label>
                  Description
                </label>

                <textarea
                  name="description"
                  value={
                    formData.description
                  }
                  onChange={handleChange}
                />
              </div>
            </div>

          </form>
        </div>


        {/* ==================================================
            RIGHT SIDE
        ================================================== */}

        <div className="CheckoutRight">

          {/* ==================================================
              ORDER SUMMARY
          ================================================== */}

          <div className="SummaryCard">

            <h3 className="SummarySectionTitle">
              Order summary
            </h3>

            {cartItems.length === 0 ? (
              <p className="SummaryEmpty">
                Your cart is empty.
              </p>
            ) : (
              cartItems.map((item) => (
                <div
                  className="SummaryLineItem"
                  key={item.itemId}
                >

                  <div>
                    <p className="SummaryLineName">
                      {item.name}
                    </p>

                    <p className="SummaryLineMeta">
                      {item.itemType ===
                      "service"
                        ? item.duration
                        : "Product"}

                      {item.quantity > 1 &&
                        ` • Qty: ${item.quantity}`}
                    </p>
                  </div>

                  <span className="SummaryLinePrice">
                    <TbCurrencyNaira />

                    {(
                      item.price *
                      item.quantity
                    ).toLocaleString()}
                  </span>

                </div>
              ))
            )}

            <div className="SummaryDivider" />

            <div className="SummarySubRow">
              <span>Name</span>
              <span>
                {formData.name || "-"}
              </span>
            </div>

            <div className="SummarySubRow">
              <span>Phone</span>
              <span>
                {formData.phone || "-"}
              </span>
            </div>

            <div className="SummarySubRow">
              <span>Email</span>
              <span>
                {formData.email || "-"}
              </span>
            </div>

            {hasServiceItems && (
              <>
                <div className="SummarySubRow">
                  <span>Date</span>

                  <span>
                    {selectedDate
                      ? formatDisplayDate(
                          selectedDate
                        )
                      : "Select date"}
                  </span>
                </div>

                <div className="SummarySubRow">
                  <span>Time</span>

                  <span>
                    {selectedTime
                      ? formatTo12Hour(
                          selectedTime
                        )
                      : "Select time"}
                  </span>
                </div>
              </>
            )}

            <div className="SummaryDivider" />

            <div className="SummarySubRow">
              <span>State</span>

              <span>
                {formData.state || "-"}
              </span>
            </div>

            <div className="SummarySubRow">
              <span>City</span>

              <span>
                {formData.city || "-"}
              </span>
            </div>

            <div className="SummarySubRow">
              <span>Description</span>

              <span>
                {formData.description ||
                  "-"}
              </span>
            </div>

            <div className="SummaryDivider" />

            <div className="SummarySubRow">
              <span>
                Estimated delivery
              </span>

              <span>
                {deliveryWindow
                  ? `${formatDeliveryDate(
                      deliveryWindow.start
                    )} – ${formatDeliveryDate(
                      deliveryWindow.end
                    )}`
                  : "Enter your state"}
              </span>
            </div>

            <div className="SummarySubRow">
              <span>Subtotal</span>

              <span>
                <TbCurrencyNaira />

                {total.toLocaleString()}
              </span>
            </div>

            <div className="SummarySubRow">
              <span>Transport</span>

              <span>
                Negotiate with Expert
              </span>
            </div>

            <div className="SummaryTotalRow">
              <span>Total</span>

              <span className="SummaryTotalValue">
                <TbCurrencyNaira />

                {grandTotal.toLocaleString()}
              </span>
            </div>

          </div>


          {/* ==================================================
              PAYMENT METHOD — UNDER ORDER SUMMARY
          ================================================== */}

          <div className="PaymentMethod">

            <h3 className="FormSectionTitle">
              Payment method
            </h3>

            <div
              className={`PaymentCard ${
                paymentMethod ===
                "Flutterwave"
                  ? "PaymentCard--selected"
                  : ""
              }`}
              onClick={() =>
                setPaymentMethod(
                  "Flutterwave"
                )
              }
              role="radio"
              aria-checked={
                paymentMethod ===
                "Flutterwave"
              }
              tabIndex={0}
            >

              <div className="PaymentCardInfo">
                <p className="PaymentCardName">
                  Flutterwave
                </p>

                <p className="PaymentCardDesc">
                  Cards, bank transfer, USSD
                </p>
              </div>

              <span
                className={`PaymentCardCheck ${
                  paymentMethod ===
                  "Flutterwave"
                    ? "PaymentCardCheck--on"
                    : ""
                }`}
              />

            </div>


            {/* PROCEED TO PAYMENT */}
            <button
              type="button"
              className="CheckoutBtn"
              onClick={handleCheckout}
              disabled={isCheckingOut}
            >
              {isCheckingOut
                ? "Processing..."
                : "Proceed to Payment"}
            </button>

          </div>

        </div>
      </div>

      <Footer />

      {receiptData && (
        <Receipt
          {...receiptData}
          onClose={() =>
            setReceiptData(null)
          }
          onViewSchedule={() =>
            navigate("/schedule", {
              replace: true,
            })
          }
        />
      )}
    </>
  );
}
