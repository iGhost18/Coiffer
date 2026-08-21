// auth-token.js
export function getAuthToken() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const staff = JSON.parse(localStorage.getItem("staff") || "null");
    return user?.accessToken || staff?.accessToken || null;
  } catch {
    return null;
  }
}