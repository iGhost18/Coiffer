const escapeRegex = (v) => String(v ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "0813 385 5524", "2348133855524", "+234 813 385 5524" -> "+2348133855524"
function normalizePhone(raw) {
  let p = String(raw).trim().replace(/[\s\-().]/g, "");
  if (/^0\d{10}$/.test(p)) p = "+234" + p.slice(1);
  else if (/^234\d{10}$/.test(p)) p = "+" + p;
  return p;
}

// Every format an existing record might plausibly be stored in
function phoneVariants(raw) {
  const id = String(raw).trim();
  const phone = normalizePhone(id);
  const set = new Set([phone, id]);
  if (phone.startsWith("+234")) set.add("0" + phone.slice(4));
  return [...set];
}

function buildIdentifierQuery(identifier) {
  const id = String(identifier).trim();

  if (id.includes("@")) return { email: id.toLowerCase() };

  if (/^\+?[\d\s\-().]{7,}$/.test(id)) {
    return { phone: { $in: phoneVariants(id) } };
  }

  return { username: new RegExp(`^${escapeRegex(id)}$`, "i") };
}

module.exports = { normalizePhone, phoneVariants, buildIdentifierQuery };