const { phoneSchema } = require("./sharedSchemas");

const { z } = require("zod");

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must contain at least 2 characters.")
  .max(60, "Name is too long.")
  .regex(/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/, "Name contains invalid characters.");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254, "Email address is too long.");



const checkoutSchema = z.object({
  body: z.object({
    contact: z.object({
      name: nameSchema,
      email: emailSchema,
      phone: phoneSchema,
    }),
    address: z.object({
      state: z.string().trim().max(100).optional().or(z.literal("")),
      city: z.string().trim().max(100).optional().or(z.literal("")),
      description: z.string().trim().max(500).optional().or(z.literal("")),
    }),
    cartItems: z
      .array(
        z.object({
          itemType: z.enum(["service", "product"]),
          itemId: z.string().optional(),
          serviceId: z.string().optional(),
          _id: z.string().optional(),
          staffId: z.string().optional(),
          quantity: z.union([z.number(), z.string()]).optional(),
          // price/name/duration/img are intentionally NOT validated here —
          // they're ignored server-side and rebuilt from the database
          // regardless of what's submitted, so we don't even bother
          // shaping them.
        }).passthrough()
      )
      .min(1, "Your cart is empty."),
    appointmentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid appointment date.")
      .nullable()
      .optional(),
    appointmentTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid appointment time.")
      .nullable()
      .optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

module.exports = { checkoutSchema };