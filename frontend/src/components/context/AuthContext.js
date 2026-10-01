import axios from "axios";
import { createContext, useReducer, useEffect } from "react";
import AuthReducer from "./AuthReducer";
import { reconnectSocket } from "../../socket";
import { subscribeToPush } from "../../push"; 

axios.defaults.baseURL = process.env.REACT_APP_API_URL || "";

const INITIAL_STATE = {
    user: JSON.parse(localStorage.getItem("user")) || null,
    isFetching: false,
    error: false,
};

export const AuthContext = createContext(INITIAL_STATE);

export const AuthContextProvider = ({ children }) => {
    const [state, dispatch] = useReducer(AuthReducer, INITIAL_STATE);

    useEffect(() => {
        if (state.user) {
            localStorage.setItem("user", JSON.stringify(state.user));
        } else {
            localStorage.removeItem("user");
        }
    }, [state.user]);

    useEffect(() => {


        if (state.user?.accessToken) {
            axios.defaults.headers.common.Authorization =
                `Bearer ${state.user.accessToken}`;

            reconnectSocket();
        } else if (
            !JSON.parse(localStorage.getItem("staff") || "null")?.accessToken
        ) {
            delete axios.defaults.headers.common.Authorization;
        }
    }, [state.user]);

    useEffect(() => {
        if (state.user?.accessToken) {
            axios.defaults.headers.common.Authorization =
                `Bearer ${state.user.accessToken}`;

            reconnectSocket();

            subscribeToPush().catch((err) =>
                console.error("Push subscription failed:", err)
            );

        } else if (
            !JSON.parse(localStorage.getItem("staff") || "null")?.accessToken
        ) {
            delete axios.defaults.headers.common.Authorization;
        }
    }, [state.user]);

    return (
        <AuthContext.Provider
            value={{
                user: state.user,
                isFetching: state.isFetching,
                error: state.error,
                dispatch,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};