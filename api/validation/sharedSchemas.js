const { z } = require("zod");
const { parsePhoneNumberFromString } = require("libphonenumber-js");

// Accepts local Nigerian formats (08012345678) or already-international
// ones (+2348012345678) and normalizes everything to E.164 before it
// ever reaches the database. "NG" is the fallback only for numbers with
// no country code at all — an explicit "+..." prefix always wins.
const phoneSchema = z.string().trim().transform((value, ctx) => {
  const parsed = parsePhoneNumberFromString(value, { defaultCountry: "NG" });

  if (!parsed || !parsed.isValid()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid phone number.",
    });
    return z.NEVER;
  }

  return parsed.number; // E.164, e.g. +2348012345678
});

module.exports = { phoneSchema };