import Home from "./pages/home/Home";
import { CartProvider } from "./components/context/CartContext";
import Checkout from "./pages/checkoutPage/Checkout";
import Feed from "./components/feed/Feed";
import Userprofile from "./pages/profile/Userprofile"
import Staffprofile from "./pages/profile/Staffprofile";
import Messenger from "./pages/messenger/Messenger";
import LoginReg from "./pages/login/Login";
import StaffReg from "./pages/staffRegister/StaffRegister";
import StaffLogin from "./pages/stafflogin/StaffLogin";
import { useContext } from "react";
import { AuthContext } from "./components/context/AuthContext";
import { StaffAuthContext } from "./components/context/StaffAuthContext";
import { Routes, Route, Navigate } from "react-router-dom";
import FriendList from "./components/friends/Friend";
import Schedule from "./components/schedule/Schedule";
import Cart from "./components/cart/Cart";
import CollectionsPage from "./components/collectionpage/Collectionpage";
import Store from "./components/store/Store"
import ServiceDetail from "./pages/servicedetail/Servicedetail";
import Notification from "./pages/notification/Notification";
import Dashboard from "./pages/dashboard/Dashboard";
import Saves from "./components/saves/Saves";
import StaffSettings from "./pages/staffSettings/StaffSettings";
import ForgotPassword from "./pages/login/Forgetpassword";
import ResetPassword from "./pages/login/Resetpassword";
import { ProductsProvider } from "./components/context/ProductsContext";
import Invite from "./pages/invite/Invite";
import StaffMap from "./components/map/Staffsnapmap";
import { useEffect } from "react"; // add useEffect to your existing React import
import socket from "./socket"; // adjust path to match where your socket.js actually lives
import { getAuthToken } from "./socket";








function App() {
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);
  const currentId = user?._id || staff?._id;

  useEffect(() => {
      if (!currentId) {
        if (socket.connected) socket.disconnect(); // logged out — drop the connection
        return;
      }

      if (!socket.connected) {
        socket.auth = { token: getAuthToken() }; // re-sync token in case it changed
        socket.connect();
      }

      const handleConnect = () => {
        socket.emit("addUser", currentId);
      };
      socket.on("connect", handleConnect);
      if (socket.connected) handleConnect();

      return () => {
        socket.off("connect", handleConnect);
      };
    }, [currentId]);

  return (
    
    <ProductsProvider>
      <CartProvider>
        <Routes>
          <Route exact path="/" element={user || staff ? <Home/> : <LoginReg />} />
          <Route exact path="/messenger" element={user || staff ?  <Messenger /> : <Navigate to="/login"/>} />
          <Route path="/login" element={user || staff ? <Navigate to="/" /> : <LoginReg />} />
          <Route path="/notification" element={<Notification/>} />
          <Route path="/stafflogin" element={<StaffLogin/>} />
          <Route path="/staffregister/:token" element={<StaffReg />} />
          <Route path="/userprofile/:username" element={<Userprofile />} />
          <Route path="/staffprofile/:id" element={<Staffprofile />} />
          <Route path="/servicedetail/:serviceId" element={<ServiceDetail />} />
          <Route path="/friends" element={<FriendList />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/store" element={<Store />} />
          <Route path="/feed" element={<Feed/>} />
          <Route path="/checkout" element={<Checkout/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route path="/saves" element={<Saves />} />
          <Route path="/staffsettings/:id" element={<StaffSettings />} />
          <Route path="/invite" element={<Invite/>} />
          <Route path="/forgot-password" element={<ForgotPassword role="user" />} />
          <Route path="/staff/forgot-password" element={<ForgotPassword role="staff" />} />
          <Route path="/reset-password/:token" element={<ResetPassword role="user" />} />
          <Route path="/staff/reset-password/:token" element={<ResetPassword role="staff" />} />
          <Route path="/map" element={<StaffMap />} />
        </Routes>
      </CartProvider>
    </ProductsProvider>

  );
}

export default App;