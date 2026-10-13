import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // required so the httpOnly refresh cookie is sent/received
});

// ---------- small helpers ----------

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

const getStoredToken = () => {
  const user = readJson("user");
  const staff = readJson("staff");
  return user?.accessToken || staff?.accessToken || null;
};

// Reads the account type ("User" or "Staff") out of the token itself.
const tokenType = (token) => {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).type || null;
  } catch {
    return null;
  }
};

// Saves a renewed token under the account it really belongs to.
// (If an old "user" login is still in storage next to a "staff" login,
// the old code could save a staff token under the wrong key.)
const storeNewToken = (newToken) => {
  const user = readJson("user");
  const staff = readJson("staff");
  const type = tokenType(newToken);

  let kind;
  if (type === "Staff" && staff) kind = "staff";
  else if (type === "User" && user) kind = "user";
  else kind = user ? "user" : "staff";

  const current = kind === "user" ? user : staff;
  if (current) {
    localStorage.setItem(kind, JSON.stringify({ ...current, accessToken: newToken }));
  }
  return kind;
};

// ---------- attach the token to every request ----------

api.interceptors.request.use(
  (config) => {
    try {
      const token = getStoredToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (err) {
      console.error("AUTH INTERCEPTOR ERROR:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- renew the token when it expires ----------

let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  pendingQueue = [];
};

const AUTH_ROUTES = ["/auth/login", "/auth/staff/login", "/auth/refresh"];

const getSentToken = (config) => {
  const header =
    config.headers?.Authorization ||
    (typeof config.headers?.get === "function" ? config.headers.get("Authorization") : "") ||
    "";
  return String(header).replace("Bearer ", "");
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) return Promise.reject(error);

    const isAuthRoute = AUTH_ROUTES.some((path) => originalRequest.url?.includes(path));

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      // Another tab (or another request) may already have renewed the token.
      // If so, just retry with the newer one instead of renewing again.
      const currentToken = getStoredToken();
      if (currentToken && currentToken !== getSentToken(originalRequest)) {
        originalRequest._retry = true;
        originalRequest.headers.Authorization = `Bearer ${currentToken}`;
        return api(originalRequest);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest._retry = true;
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = data.accessToken;
        const kind = storeNewToken(newToken);

        window.dispatchEvent(
          new CustomEvent("token-refreshed", { detail: { token: newToken, kind } })
        );

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        const status = refreshError.response?.status;

        // Only sign the person out when the server clearly says the session
        // is over. A dropped connection or a server hiccup must NOT log
        // anyone out. They stay signed in and can simply try again.
        if (status === 401 || status === 403) {
          const wasStaff = Boolean(readJson("staff")) && !readJson("user");
          localStorage.removeItem("user");
          localStorage.removeItem("staff");

          const loginPath = wasStaff ? "/staffLogin" : "/login";
          if (!window.location.pathname.toLowerCase().startsWith(loginPath.toLowerCase())) {
            window.location.href = loginPath;
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;