const buckets = new Map();

const rateLimit = ({ windowMs = 60_000, max = 120, key = (req) => req.ip } = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = `${key(req)}:${req.path}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      bucket = { startedAt: now, count: 0 };
      buckets.set(bucketKey, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((windowMs - (now - bucket.startedAt)) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    next();
  };
};

setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [key, bucket] of buckets) {
    if (bucket.startedAt < cutoff) buckets.delete(key);
  }
}, 10 * 60_000).unref();

module.exports = rateLimit;
