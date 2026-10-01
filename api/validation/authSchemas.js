const { phoneSchema } = require("./sharedSchemas");

const { z } = require("zod");

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must contain at least 2 characters.")
  .max(60, "Name is too long.")
  .regex(
    /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/,
    "Name contains invalid characters."
  );

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must contain at least 3 characters.")
  .max(30, "Username is too long.")
  .regex(
    /^[A-Za-z0-9_.-]+$/,
    "Username may only contain letters, numbers, underscores, dots and hyphens."
  );

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254, "Email address is too long.");



const passwordSchema = z
  .string()
  .min(12, "Password must contain at least 12 characters.")
  .max(128, "Password is too long.")
  .refine(
    (password) => /[A-Z]/.test(password),
    "Password must contain an uppercase letter."
  )
  .refine(
    (password) => /[a-z]/.test(password),
    "Password must contain a lowercase letter."
  )
  .refine(
    (password) => /\d/.test(password),
    "Password must contain a number."
  );

const registerSchema = z.object({
  body: z
    .object({
      username: usernameSchema,

      email: emailSchema,

      password: passwordSchema,

      firstName: nameSchema.optional().or(z.literal("")),

      lastName: nameSchema.optional().or(z.literal("")),

      phone: phoneSchema.optional().or(z.literal("")),

      city: z
        .string()
        .trim()
        .max(100)
        .optional()
        .or(z.literal("")),

      state: z
        .string()
        .trim()
        .max(100)
        .optional()
        .or(z.literal("")),

      country: z
        .string()
        .trim()
        .max(100)
        .optional()
        .or(z.literal("")),
    })
    .strict(),

  params: z.object({}),

  query: z.object({}),
});

const loginSchema = z.object({
  body: z
    .object({
      identifier: z
        .string()
        .trim()
        .min(1)
        .max(254),

      password: z
        .string()
        .min(1)
        .max(128),
    })
    .strict(),

  params: z.object({}),

  query: z.object({}),
});

const forgotPasswordSchema = z.object({
  body: z
    .object({
      email: emailSchema,
    })
    .strict(),

  params: z.object({}),

  query: z.object({}),
});

const resetPasswordSchema = z.object({
  body: z
    .object({
      password: passwordSchema,
    })
    .strict(),

  params: z.object({
    token: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "Invalid reset token."),
  }),

  query: z.object({}),
});

const staffRegisterSchema = z.object({
  body: z.object({
    token: z
      .string()
      .trim()
      .min(1, "Invite token is required.")
      .max(200, "Invalid invite token."),

    username: usernameSchema,

    email: emailSchema,

    password: passwordSchema,

    firstName: nameSchema,

    lastName: nameSchema,

    phone: phoneSchema,

    bio: z
      .string()
      .trim()
      .max(1000, "Bio is too long.")
      .optional()
      .or(z.literal("")),

    roles: z
      .array(
        z.string()
          .trim()
          .min(1)
          .max(50)
      )
      .max(10, "Too many roles.")
      .optional()
      .default([]),

    experience: z
      .union([
        z.string().trim().max(100),
        z.number().int().min(0).max(80),
      ])
      .optional(),

    workType: z
      .enum(["mobile", "stationed"])
      .default("stationed"),

    location: z.object({
      address: z
        .string()
        .trim()
        .max(200)
        .optional()
        .or(z.literal("")),

      city: z
        .string()
        .trim()
        .max(100)
        .optional()
        .or(z.literal("")),

      state: z
        .string()
        .trim()
        .max(100)
        .optional()
        .or(z.literal("")),

      country: z
        .string()
        .trim()
        .max(100)
        .optional()
        .or(z.literal("")),
    }).strict(),

    specialties: z
      .array(
        z.string()
          .trim()
          .min(1)
          .max(50)
      )
      .max(20, "Too many specialties.")
      .optional()
      .default([]),

    workDays: z
      .array(
        z.enum([
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ])
      )
      .max(7)
      .optional()
      .default([]),

    profilePicture: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal("")),

    startTime: z
      .string()
      .regex(
        /^([01]\d|2[0-3]):[0-5]\d$/,
        "Invalid start time."
      )
      .optional()
      .or(z.literal("")),

    endTime: z
      .string()
      .regex(
        /^([01]\d|2[0-3]):[0-5]\d$/,
        "Invalid end time."
      )
      .optional()
      .or(z.literal("")),

    slotDuration: z
      .number()
      .int()
      .min(5)
      .max(480)
      .optional(),

    maxBookings: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional(),
  }).strict(),

  params: z.object({}),

  query: z.object({}),
});

module.exports = {
  registerSchema,
  staffRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};

