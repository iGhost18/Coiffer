import "./checkout.css";
import Topbar from "../../components/topbar/Topbar";
import Footer from "../../components/footer/Footer";
import { useState, useContext } from "react";
import { DatePicker, TimeSlots } from "../../components/dateTime/DateAndTime";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../components/context/CartContext";
import { TbCurrencyNaira } from "react-icons/tb";
import { AuthContext } from "../../components/context/AuthContext";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import api from "../../api"; // Import the api instance

export default function Checkout() {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    state: "",
    city: "",
    description: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("Paystack");

  const { user } = useContext(AuthContext);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const navigate = useNavigate();

  const { cartItems, total, clearCart } = useCart();

  const grandTotal = total;

  const handleCheckout = async () => {
    if (!user) {
      alert("Please login first.");
      return;
    }

    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    if (!formData.name || !formData.email || !formData.phone) {
      alert("Please fill in your contact details.");
      return;
    }

    // Split the cart: services need a staff member + appointment slot,
    // products don't. Each type becomes its own record on the backend.
    const serviceItems = cartItems.filter((item) => item.itemType === "service");
    const productItems = cartItems.filter((item) => item.itemType === "product");

    if (serviceItems.length > 0 && (!selectedDate || !selectedTime)) {
      alert("Please select a date and time for your appointment.");
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
      description: formData.description,
    };

  try {
    const requests = [];

      if (serviceItems.length > 0) {
        // Group services by staffId so each staff member gets their own
        // booking — instead of dumping every service under the first item's staff
        const servicesByStaff = serviceItems.reduce((acc, item) => {
          const key = item.staffId;
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {});

        Object.entries(servicesByStaff).forEach(([staffId, items]) => {
          const serviceTotal = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );

          const booking = {
            customerId: user._id,
            staffId,
            contact,
            services: items,
            appointmentDate: selectedDate,
            appointmentTime: selectedTime,
            address,
            paymentMethod,
            total: serviceTotal,
          };

          requests.push(api.post("/api/booking", booking));
        });
      }

      if (productItems.length > 0) {
        const productTotal = productItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        const order = {
          customerId: user._id,
          contact,
          items: productItems,
          address,
          paymentMethod,
          total: productTotal,
        };

        requests.push(api.post("/api/order", order));
      }

      await Promise.all(requests);
      await clearCart();

      setFormData({
        name: "",
        email: "",
        phone: "",
        state: "",
        city: "",
        description: "",
      });
      setSelectedDate(null);
      setSelectedTime(null);
      setPaymentMethod("Paystack");

      alert("Checkout complete!");
      navigate("/schedule");
    } catch (err) {
      console.error(err);
      alert("Checkout failed.");
    }
  };

  return (
    <>
      <Topbar />

        <button
          className="checkOutbtn"
          onClick={() =>
            navigate(-1)
          }
        >
          <ChevronLeftIcon />
        </button>

      <div className="CheckoutWrapper">
        {/* LEFT SIDE */}
        <div className="CheckoutLeft">
          <form>
            <h3 className="DetailsHeader">Contact Details</h3>

            <div className="InputWrapper">
              <label>Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} />
            </div>

            <div className="InputWrapper">
              <label>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} />
            </div>

            <div className="InputWrapper">
              <label>Phone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} />
            </div>

            {cartItems.some((item) => item.itemType === "service") && (
              <div className="InputWrapper">
                <div className="Date">
                  <label>Date</label>
                  <DatePicker selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
                </div>

                <div className="Time">
                  <label>Time</label>
                  <TimeSlots
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    setSelectedTime={setSelectedTime}
                    staffId={cartItems.find(i => i.itemType === "service")?.staffId}
                    serviceId={cartItems.find(i => i.itemType === "service")?.itemId}
                  />
                </div>
              </div>
            )}

            <div className="Location">
              <h3 className="LocationHeader">Location</h3>

              <div className="InputWrapper">
                <label>State</label>
                <input type="text" name="state" value={formData.state} onChange={handleChange} />
              </div>

              <div className="InputWrapper">
                <label>Town / City</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange} />
              </div>

              <div className="InputWrapper">
                <label>Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} />
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT SIDE */}
        <div className="CheckoutRight">
          <div className="SummaryCard">
            <h2 className="SummaryHeader">Order Summary</h2>

            <div className="SummarySection">
              <h4>Selected Items</h4>

              {cartItems.length === 0 ? (
                <p>Your cart is empty.</p>
              ) : (
                cartItems.map((item) => (
                  <div className="SummaryItem" key={item.itemId}>
                    <div>
                      <p className="ServiceName">{item.name}</p>

                      <small>
                        {item.itemType === "service" ? item.duration : "Product"}
                        {item.quantity > 1 && ` • Qty: ${item.quantity}`}
                      </small>
                    </div>

                    <div className="ItemPrice">
                      <TbCurrencyNaira />
                      {(item.price * item.quantity).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="SummarySection">
              <h4>Contact</h4>

              <div className="SummaryRow">
                <span>Name</span>
                <span>{formData.name || "-"}</span>
              </div>
              <div className="SummaryRow">
                <span>Phone</span>
                <span>{formData.phone || "-"}</span>
              </div>
              <div className="SummaryRow">
                <span>Email</span>
                <span>{formData.email || "-"}</span>
              </div>

              {cartItems.some((item) => item.itemType === "service") && (
                <>
                  <div className="SummaryRow">
                    <span>Date</span>
                    <span>{selectedDate ? selectedDate.toLocaleString() : "Select Date"}</span>
                  </div>

                  <div className="SummaryRow">
                    <span>Time</span>
                    <span>{selectedTime || "Select Time"}</span>
                  </div>
                </>
              )}
            </div>

            <div className="SummarySection">
              <h4>Address</h4>

              <div className="SummaryRow">
                <span>State</span>
                <span>{formData.state || "-"}</span>
              </div>
              <div className="SummaryRow">
                <span>City</span>
                <span>{formData.city || "-"}</span>
              </div>

              <div className="SummaryRow">
                <span>Description</span>
                <span>{formData.description || "-"}</span>
              </div>
            </div>

            <div className="SummarySection">
              <div className="SummaryRow">
                <span>Subtotal</span>
                <span>
                  <TbCurrencyNaira />
                  {total.toLocaleString()}
                </span>
              </div>

              <div className="SummaryRow">
                <span>Transport</span>
                <span>negotiate with barber</span>
              </div>

              <div className="TotalCost">
                <h3>Total</h3>
                <h2>
                  <TbCurrencyNaira />
                  {grandTotal.toLocaleString()}
                </h2>
              </div>
            </div>
          </div>

          <div className="PaymentMethod">
            <h3>Select Payment Method</h3>

            <label className="PaymentOption">
              <input
                type="radio"
                name="payment"
                value="Paystack"
                checked={paymentMethod === "Paystack"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              Paystack
            </label>

            <label className="PaymentOption">
              <input
                type="radio"
                name="payment"
                value="Flutterwave"
                checked={paymentMethod === "Flutterwave"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              Flutterwave
            </label>

            <button className="CheckoutBtn" onClick={handleCheckout}>
              Proceed to Payment
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}