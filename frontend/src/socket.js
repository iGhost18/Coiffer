import { io } from "socket.io-client";

export const getAuthToken = () => {   // add "export" here
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const staff = JSON.parse(localStorage.getItem("staff") || "null");
    return user?.accessToken || staff?.accessToken || null;
  } catch {
    return null;
  }
};

const socket = io(process.env.REACT_APP_API_URL || window.location.origin, {
  transports: ["websocket"],
  autoConnect: false,
  auth: { token: getAuthToken() },
});

export const reconnectSocket = () => {
  socket.auth = { token: getAuthToken() };
  if (!socket.connected) socket.connect();
};

export default socket;