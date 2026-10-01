import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { StaffAuthContext } from "../context/StaffAuthContext";

export default function RequireAuth({ children }) {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);
  const location = useLocation();

  if (!user && !staff) {
    // Send guests to login, remembering where they were headed so we can
    // bounce them back after they sign in (LoginReg can read this from
    // location.state.from if you want that behavior).
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}