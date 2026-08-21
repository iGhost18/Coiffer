import { useCart } from "../../components/context/CartContext";
import { TbCurrencyNaira } from "react-icons/tb";
import { useNavigate } from 'react-router-dom';
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import './cart.css';

export default function Cart({showBackButton = true,}) {
  const { cartItems, removeFromCart, updateQuantity, total } = useCart();
  const navigate = useNavigate();

  return (
    <div className="CartWrapper">
      <div className="Cart">
        <div className="CartHeader">
          <div className="btnAndText">
            { showBackButton && (
              <button
                className="cartBackbtn"
                onClick={() =>
                  navigate(-1)
                }
              >
                <ChevronLeftIcon />
              </button>
            )}
            <span>Your Booking & Order</span>

          </div>
        </div>

        <div className="CartBody">
          {cartItems.length === 0 ? (
            <p>No services selected</p>
          ) : (
            cartItems.map(item => (
              <div className="CartItem" key={`${item.itemId}-${item.itemType}`}>
                <img src={item.img || "/assets/person/noAvatar.png"} alt={item.name} />
                <div className="ItemCon">
                  <h4>{item.name}</h4>
                   <p><TbCurrencyNaira />{(item.price * item.quantity).toLocaleString()}</p>
                </div>
                <div className="Controls">
                  <button
                      onClick={() =>
                        updateQuantity(
                          item.itemId,
                          item.itemType,
                          -1
                        )
                      }
                    >
                      -
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      onClick={() =>
                        updateQuantity(
                          item.itemId,
                          item.itemType,
                          1
                        )
                      }
                    >
                      +
                    </button>

                    <button
                      className="Remove"
                      onClick={() =>
                        removeFromCart(
                          item.itemId,
                          item.itemType
                        )
                      }
                    >
                      ✕
                    </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="CartFooter">
          <h3>Total: <TbCurrencyNaira className="PriceIcons" />{total.toLocaleString()}</h3>
          <button className="Checkout" onClick={() => navigate("/checkout")}>Proceed to Checkout</button>
        </div>
      </div>
    </div>
  );
}
