const AuthReducer = (state, action) => {
    switch (action.type) {
        case "LOGIN_START":
            return {
                user: null,
                isFetching: true,
                error: false,
            };

        case "LOGIN_SUCCESS":
            return {
                user: action.payload,
                isFetching: false,
                error: false,
            };

        case "LOGIN_FAILURE":
            // payload is a readable message string (see getLoginErrorMessage)
            return {
                user: null,
                isFetching: false,
                error: action.payload || "Login failed. Please try again.",
            };

        case "LOGOUT":
            return {
                user: null,
                isFetching: false,
                error: false,
            };

        case "UPDATE_USER":
            return {
                ...state,
                user: { ...state.user, ...action.payload },
            };

        default:
            return state;
    }
};

export default AuthReducer;