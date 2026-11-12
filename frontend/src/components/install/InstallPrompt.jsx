import { useEffect, useState } from "react";
import "./installprompt.css";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const DISMISS_KEY = "coifferInstallDismissed";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const ios = isIos();

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch (_) {}

    // Already installed, or the visitor said no before.
    if (dismissed || isStandalone()) return;

    // iPhones can't be prompted from code, so we show instructions instead.
    if (ios) {
      setVisible(true);
      return;
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [ios]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch (_) {}
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="InstallBanner" role="dialog" aria-label="Install Coiffer">
      <div className="InstallText">
        <strong>Install Coiffer</strong>
        <span>
          {ios
            ? "Tap the Share button, then “Add to Home Screen”."
            : "Add it to your home screen for faster booking."}
        </span>
      </div>
      {!ios && (
        <button className="InstallBtn" onClick={install}>
          Install
        </button>
      )}
      <button className="InstallClose" onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}