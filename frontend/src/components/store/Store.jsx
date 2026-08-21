import "./store.css";
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useCart } from "../context/CartContext";
import { useProducts } from "../context/ProductsContext";

const formatPrice = (amount) => `₦${Number(amount || 0).toLocaleString()}`;

export default function Store() {
  const { cartItems, addToCart } = useCart();
  const { products } = useProducts();
  const [justAddedId, setJustAddedId] = useState(null);
  const cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const navigate = useNavigate();
  const addedTimeoutRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(addedTimeoutRef.current);
  }, []);

  return (
    <div className="store">
      <div className="StoreHeader">
        <div className="storeHeaderLeft">
          <button
            className="storeBackbtn"
            onClick={() =>
              navigate(-1)
            }
          >
            <ChevronLeftIcon />
          </button>

        </div>
        <h1 className="Header">Hair Products & Tools</h1>

        <Link to="/cart" className="CartLink">
          {cartCount > 0 && (
            <span className="CartPill">
              🛒 {cartCount} item{cartCount !== 1 ? "s" : ""}
            </span>
          )}
        </Link>
      </div>

      <div className="StoreGrid">
        {products.length === 0 ? (
          <p className="EmptyStoreMsg">
            No products available yet — check back soon.
          </p>
        ) : (
          products.map((product) => (
            <div
              key={product._id}
              className={`StoreCard ${
                !product.available ? "outOfStock" : ""
              }`}
            >
              <div className="StoreImage">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                  />
                ) : (
                  <span className="StoreImagePlaceholder">
                    🛍️
                  </span>
                )}
              </div>

              <h3 className="ProductName">
                {product.name}
              </h3>

              <p className="ProductDesc">
                {product.description}
              </p>

              <div className="StoreCardFooter">
                <div className="PriceSection">
                  <span className="PriceTag">
                    {formatPrice(product.price)}
                  </span>

                  <span
                    className={`Availability ${
                      product.available
                        ? "available"
                        : "unavailable"
                    }`}
                  >
                    {product.available
                      ? "Available"
                      : "Out of Stock"}
                  </span>
                </div>

                <button
                  className={`BuyBtn ${
                    justAddedId === product._id
                      ? "added"
                      : ""
                  }`}
                  disabled={!product.available}
                  onClick={() => {
                    addToCart({ ...product, itemType: "product" });
                    setJustAddedId(product._id);
                    clearTimeout(addedTimeoutRef.current);
                    addedTimeoutRef.current = setTimeout(() => setJustAddedId(null), 1200);
                  }}
                >
                  {!product.available
                    ? "Out of Stock"
                    : justAddedId === product._id
                    ? "Added ✓"
                    : "Add to Cart"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}