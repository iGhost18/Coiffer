import axios from "axios";
import { reconnectSocket } from "../../socket";
import { createContext, useReducer, useEffect } from "react";

axios.defaults.baseURL = process.env.REACT_APP_API_URL || "";

const INITIAL_STATE = {
    staff: JSON.parse(localStorage.getItem("staff")) || null,
    isFetching: false,
    error: false,
};

export const StaffAuthContext = createContext(INITIAL_STATE);

const StaffReducer = (state, action) => {
    switch (action.type) {
        case "LOGIN_START":
            return {
                staff: null,
                isFetching: true,
                error: false,
            };

        case "LOGIN_SUCCESS":
            return {
                staff: action.payload,
                isFetching: false,
                error: false,
            };

        case "LOGIN_FAILURE":
            return {
                staff: null,
                isFetching: false,
                error: true,
            };

        case "LOGOUT":
            return {
                staff: null,
                isFetching: false,
                error: false,
            };

        case "UPDATE_STAFF":
            return {
                ...state,
                staff: { ...state.staff, ...action.payload },
            };

        default:
            return state;
    }
};

export const StaffAuthContextProvider = ({ children }) => {
    const [state, dispatch] = useReducer(StaffReducer, INITIAL_STATE);

    useEffect(() => {
        localStorage.setItem("staff", JSON.stringify(state.staff));
    }, [state.staff]);


    useEffect(() => {

        if (state.staff?.accessToken) {
            axios.defaults.headers.common.Authorization =
                `Bearer ${state.staff.accessToken}`;
            reconnectSocket();
        } else if (
            !JSON.parse(localStorage.getItem("user") || "null")?.accessToken
        ) {

            delete axios.defaults.headers.common.Authorization;
        }
    }, [state.staff]);

    return (
        <StaffAuthContext.Provider
            value={{
                staff: state.staff,
                isFetching: state.isFetching,
                error: state.error,
                dispatch,
            }}
        >
            {children}
        </StaffAuthContext.Provider>
    );
};