const webpush = require("web-push");
const PushSubscription = require("../models/pushSubscription");

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendPushToOwner(ownerId, ownerModel, payload) {
  const subscriptions = await PushSubscription.find({ ownerId, ownerModel });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        // 410/404 = subscription is dead (user revoked/uninstalled) — clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.findByIdAndDelete(sub._id);
        } else {
          console.error("Push send failed:", err.statusCode, err.body);
        }
      }
    })
  );
}

module.exports = sendPushToOwner;