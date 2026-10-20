const API = "https://coiffer-production.up.railway.app";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = async (req, res) => {
  const id = String(req.query.id || "");
  const origin = `https://${req.headers.host}`;
  const pageUrl = `${origin}/staffprofile/${encodeURIComponent(id)}`;

  let title = "Coiffer – Book trusted barbers near you";
  let description = "Find and book barbers and stylists near you on Coiffer.";
  let image = `${origin}/assets/og-default.png`;

  if (/^[a-f0-9]{24}$/i.test(id)) {
    try {
      const r = await fetch(`${API}/api/staff/${id}`);
      if (r.ok) {
        const s = await r.json();
        const name = s.displayName || s.username || "Expert";
        const role = Array.isArray(s.roles) ? s.roles.join(", ") : s.role || "";
        title = `${name}${role ? " – " + role : ""} on Coiffer`;
        description = `Book ${name} on Coiffer.`;
        if (s.profilePicture) {
          image = s.profilePicture.startsWith("http")
            ? s.profilePicture.replace("/upload/", "/upload/c_fill,w_1200,h_630,g_auto/")
            : origin + s.profilePicture;
        }
      }
    } catch (_) {}
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
  res.status(200).send(`<!doctype html><html><head>
<meta charset="utf-8"><title>${esc(title)}</title>
<meta property="og:site_name" content="Coiffer">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
</head><body><a href="${esc(pageUrl)}">${esc(title)}</a></body></html>`);
};