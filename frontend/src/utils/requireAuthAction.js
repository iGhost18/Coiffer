// Wraps an action handler so guests get redirected to /login instead of
// the action silently doing nothing. Pass the currentUser (or null) and
// the navigate function from useNavigate().
export function requireAuthAction(currentUser, navigate, action) {
  if (!currentUser) {
    navigate("/login", { state: { from: window.location.pathname } });
    return;
  }
  action();
}