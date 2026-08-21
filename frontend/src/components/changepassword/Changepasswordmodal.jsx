import { useState } from "react";
import api from "../../api";
import "./changepasswordmodal.css";

export default function ChangePasswordModal({ userId, onCancel, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);

    try {
      await api.put(`/api/user/${userId}/password`, {
        userId,
        currentPassword,
        newPassword,
      });

      onSuccess();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        (typeof err.response?.data === "string" ? err.response.data : "Couldn't update your password.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ChangePwOverlay" onClick={onCancel}>
      <div className="ChangePwModal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ChangePwTitle">Change password</h3>

        <form onSubmit={handleSubmit}>
          <div className="ChangePwField">
            <label>Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoFocus
            />
          </div>

          <div className="ChangePwField">
            <label>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="ChangePwField">
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <p className="ChangePwError">{error}</p>}

          <div className="ChangePwActions">
            <button type="button" className="ChangePwCancelBtn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="ChangePwConfirmBtn" disabled={submitting}>
              {submitting ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}