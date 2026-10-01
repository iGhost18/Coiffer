import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "",
  withCredentials: true, // required so the httpOnly refresh cookie is sent/received
});

api.interceptors.request.use(
  (config) => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const staff = JSON.parse(localStorage.getItem("staff") || "null");
      const token = user?.accessToken || staff?.accessToken || null;

      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (err) {
      console.error("AUTH INTERCEPTOR ERROR:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute = ["/auth/login", "/auth/staff/login", "/auth/refresh"].some(
      (path) => originalRequest.url?.includes(path)
    );

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${process.env.REACT_APP_API_URL || ""}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = data.accessToken;
        const user = JSON.parse(localStorage.getItem("user") || "null");
        const staff = JSON.parse(localStorage.getItem("staff") || "null");

        if (user) {
          localStorage.setItem("user", JSON.stringify({ ...user, accessToken: newToken }));
        } else if (staff) {
          localStorage.setItem("staff", JSON.stringify({ ...staff, accessToken: newToken }));
        }

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("user");
        localStorage.removeItem("staff");
        // send them back to login — adjust path if yours differs
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;