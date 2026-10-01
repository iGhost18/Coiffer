import "./store.css";
import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useCart } from "../context/CartContext";
import { useProducts } from "../context/ProductsContext";

const formatPrice = (amount) => `₦${Number(amount || 0).toLocaleString()}`;

export default function Store() {
  const { cartItems, addToCart } = useCart();
  const { products } = useProducts();
  const [justAddedId, setJustAddedId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const navigate = useNavigate();
  const addedTimeoutRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(addedTimeoutRef.current);
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return products.filter((p) => {
      const matchesCategory =
        activeCategory === "All" || (p.category || "").trim() === activeCategory;

      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchQuery]);

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

      <div className="StoreSearchWrap">
        <input
          type="text"
          className="StoreSearchInput"
          placeholder="Search products…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {categories.length > 1 && (
        <div className="StoreCategoryTabs">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`StoreCategoryTab ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="StoreGrid">
        {products.length === 0 ? (
          <p className="EmptyStoreMsg">
            No products available yet — check back soon.
          </p>
        ) : filteredProducts.length === 0 ? (
          <p className="EmptyStoreMsg">
            No products match your search.
          </p>
        ) : (
          filteredProducts.map((product) => {
            const hasDiscount =
              product.discountPrice != null && product.discountPrice < product.price;

            return (
              <div
                key={product._id}
                className={`StoreCard ${
                  !product.available ? "outOfStock" : ""
                }`}
              >
                <div className="StoreImage">
                  {hasDiscount && <span className="DiscountBadge">Sale</span>}
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

                {product.category && (
                  <span className="ProductCategory">{product.category}</span>
                )}

                <h3 className="ProductName">
                  {product.name}
                </h3>

                <p className="ProductDesc">
                  {product.description}
                </p>

                <div className="StoreCardFooter">
                  <div className="PriceSection">
                    <div className="PriceRow">
                      {hasDiscount ? (
                        <>
                          <span className="PriceOriginal">{formatPrice(product.price)}</span>
                          <span className="PriceTag PriceTag--discount">
                            {formatPrice(product.discountPrice)}
                          </span>
                        </>
                      ) : (
                        <span className="PriceTag">
                          {formatPrice(product.price)}
                        </span>
                      )}
                    </div>

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
                      addToCart({
                        ...product,
                        price: hasDiscount ? product.discountPrice : product.price,
                        itemType: "product",
                      });
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
            );
          })
        )}
      </div>
    </div>
  );
}