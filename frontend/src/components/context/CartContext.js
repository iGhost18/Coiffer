import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import api from "../../api";  

import { AuthContext } from "./AuthContext";
import { StaffAuthContext } from "./StaffAuthContext";


const CartContext = createContext();

export function CartProvider({ children }) {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);

  const owner = user || staff;

  const ownerId = owner?._id;
  const ownerType = user ? "user" : staff ? "staff" : null;

  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);

  /*
  =========================
  LOAD CART
  =========================
  */
  useEffect(() => {
    if (!ownerId || !ownerType) {
      setCartItems([]);
      return;
    }

    const loadCart = async () => {
      try {
        setLoading(true);

        const res = await api.get(
          `/api/cart/${ownerType}/${ownerId}`
        );

        setCartItems(Array.isArray(res.data.items) ? res.data.items : []);
      } catch (err) {
        console.error(
          "CART LOAD ERROR:",
          err.response?.data || err.message
        );
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, [ownerId, ownerType]);

  /*
  =========================
  ADD ITEM
  =========================
  */
  const addToCart = async (item) => {
    if (!ownerId) return;

    try {
      const payload = {
        itemId: item._id,
        itemType: item.itemType,
        name: item.name,
        img: item.img || item.image || "",
        price: item.price,
        duration: item.duration,
        staffId: item.staffId,
        serviceId: item.serviceId,
      };

      const res = await api.post("/api/cart/add", {
        ownerId,
        ownerType,
        item: payload,
      });



      setCartItems(Array.isArray(res.data.items) ? res.data.items : []);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  /*
  =========================
  UPDATE QUANTITY
  =========================
  */
  const updateQuantity = async (itemId, itemType, delta) => {
    try {
      const res = await api.put("/api/cart/quantity", {
        ownerId,
        ownerType,
        itemId,
        itemType,
        delta,
      });

      setCartItems(Array.isArray(res.data.items) ? res.data.items : []);
    } catch (err) {
      console.error(err);
    }
  };

  /*
  =========================
  REMOVE ITEM
  =========================
  */
  const removeFromCart = async (itemId, itemType) => {
    try {
      const res = await api.delete("/api/cart/remove", {
        data: {
          ownerId,
          ownerType,
          itemId,
          itemType,
        },
      });

      setCartItems(Array.isArray(res.data.items) ? res.data.items : []);
    } catch (err) {
      console.error(err);
    }
  };

  /*
  =========================
  CLEAR CART
  =========================
  */
  const clearCart = async () => {
    try {
      const res = await api.delete(
        `/api/cart/clear/${ownerType}/${ownerId}`
      );

      setCartItems(Array.isArray(res.data.items) ? res.data.items : []);
    } catch (err) {
      console.error(err);
    }
  };

  const total = cartItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
    0
  );
  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        total,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}