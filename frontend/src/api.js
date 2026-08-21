import axios from "axios";

const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || "",
});

api.interceptors.request.use(
    (config) => {
        try {
            const user = JSON.parse(
                localStorage.getItem("user") || "null"
            );

            const staff = JSON.parse(
                localStorage.getItem("staff") || "null"
            );

            const token =
                user?.accessToken ||
                staff?.accessToken ||
                null;

            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (err) {
            console.error("AUTH INTERCEPTOR ERROR:", err);
        }

        return config;
    },
    (error) => Promise.reject(error)
);

export default api;