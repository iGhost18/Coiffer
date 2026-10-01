import api from "./api"; 

export const loginCall = async (userCredential, dispatch) => {
    dispatch({ type: "LOGIN_START" });
    try {
        const res = await api.post("/api/auth/login", userCredential);
        dispatch({
            type: "LOGIN_SUCCESS",
            payload: { ...res.data.user, accessToken: res.data.accessToken },
        });
    } catch (err) {
        dispatch({ type: "LOGIN_FAILURE", payload: err });
    }
};