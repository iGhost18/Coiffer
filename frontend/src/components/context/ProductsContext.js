import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../../api"; // Adjust the import path as needed

const ProductsContext = createContext(null);

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/product");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addProduct = async (product) => {
    try {
      const res = await api.post("/api/product", product);
      setProducts((prev) => [res.data, ...prev]);
      return res.data;
    } catch (err) {
      console.error("Failed to add product:", err);
      throw err;
    }
  };

  const updateProduct = async (id, updates) => {
    try {
      const res = await api.put(`/api/product/${id}`, updates);
      setProducts((prev) => prev.map((p) => (p._id === id ? res.data : p)));
      return res.data;
    } catch (err) {
      console.error("Failed to update product:", err);
      throw err;
    }
  };

  const deleteProduct = async (id) => {
    try {
      await api.delete(`/api/product/${id}`);
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      console.error("Failed to delete product:", err);
      throw err;
    }
  };

  return (
    <ProductsContext.Provider
      value={{ products, loading, addProduct, updateProduct, deleteProduct, refetch: fetchProducts }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within ProductsProvider");
  return ctx;
}