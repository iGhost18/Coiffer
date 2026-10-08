import api from "./api";

// Turns whatever the server (or network) gave us into one readable line
export const getLoginErrorMessage = (err) => {
    // No response at all: server down, CORS failure, or no internet
    if (!err.response) {
        return "Can't reach the server. Check your connection and try again.";
    }

    const { status, data } = err.response;

    if (status === 401) {
        return "Invalid credentials. Check your details and try again.";
    }

    // Zod validation errors: { message, errors: [{ field, message }] }
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
        return data.errors.map((e) => e.message).join(" ");
    }

    // Rate limiter and other errors may send a plain string or { message }
    if (typeof data === "string" && data.trim()) return data;
    if (data?.message) return data.message;

    return "Login failed. Please try again.";
};

export const loginCall = async (userCredential, dispatch) => {
    dispatch({ type: "LOGIN_START" });
    try {
        const res = await api.post("/api/auth/login", userCredential);
        dispatch({
            type: "LOGIN_SUCCESS",
            payload: { ...res.data.user, accessToken: res.data.accessToken },
        });
    } catch (err) {
        dispatch({ type: "LOGIN_FAILURE", payload: getLoginErrorMessage(err) });
    }
};