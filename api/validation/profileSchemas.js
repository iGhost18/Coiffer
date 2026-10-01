const { z } = require("zod");

const nameField = z.string().trim().max(50).optional();
const shortTextField = z.string().trim().max(100).optional();
const longTextField = z.string().trim().max(1000).optional();

// ─────────────────────────────────────────
// USER profile edit
// ─────────────────────────────────────────
const updateUserProfileSchema = z.object({
  body: z.object({
    username: z.string().trim().min(3).max(20).optional(),
    firstName: nameField,
    lastName: nameField,
    phone: z.string().trim().max(20).optional(),
    birthMonth: z.string().trim().max(20).optional(),
    birthDay: z.string().trim().max(10).optional(),
    state: shortTextField,
    city: shortTextField,
    country: shortTextField,
    gender: z.enum(["male", "female", "other"]).optional(),
    hairType: shortTextField,
    hairColor: shortTextField,
    hairStyle: shortTextField,
    profilePicture: z.string().trim().url().optional(),
    bio: longTextField,
    personalNote: z.string().trim().max(2000).optional(),
    email: z.string().trim().email().max(50).optional(),
    featured: z.array(z.string()).max(50).optional(),
    collection: z.array(z.string()).max(200).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update.",
  }),
});

// ─────────────────────────────────────────
// STAFF profile edit
// ─────────────────────────────────────────
const dayScheduleShape = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotDuration: z.coerce.number().int().min(5).max(240).optional(),
  maxBookings: z.coerce.number().int().min(0).max(200).optional(),
});

const staffServiceShape = z.object({
  name: z.string().trim().min(1).max(100),
  price: z.coerce.number().finite().min(0),
  img: z.string().trim().url().optional().or(z.literal("")),
});

const updateStaffProfileSchema = z.object({
  body: z.object({
    username: z.string().trim().min(3).max(20).optional(),
    displayName: nameField,
    firstName: nameField,
    lastName: nameField,
    phone: z.string().trim().max(20).optional(),
    desc: z.string().trim().max(1000).optional(),
    roles: z.array(z.string().trim().max(50)).max(20).optional(),
    experience: z.coerce.number().int().min(0).max(80).optional(),
    workType: z.enum(["mobile", "stationed"]).optional(),
    location: z.object({
      address: z.string().trim().max(200).optional(),
      city: shortTextField,
      state: shortTextField,
      country: shortTextField,
      coordinates: z.object({
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
      }).optional(),
    }).optional(),
    specialties: z.array(z.string().trim().max(50)).max(30).optional(),
    workDays: z.array(z.string().trim().max(20)).max(7).optional(),
    profilePicture: z.string().trim().url().optional(),
    coverPicture: z.array(z.string().trim()).max(3).optional(),
    services: z.array(staffServiceShape).max(50).optional(),
    schedule: z.object({
      Monday: dayScheduleShape.optional(),
      Tuesday: dayScheduleShape.optional(),
      Wednesday: dayScheduleShape.optional(),
      Thursday: dayScheduleShape.optional(),
      Friday: dayScheduleShape.optional(),
      Saturday: dayScheduleShape.optional(),
      Sunday: dayScheduleShape.optional(),
    }).optional(),
    collection: z.array(z.string()).max(200).optional(),
    featured: z.array(z.string()).max(50).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update.",
  }),
});

module.exports = { updateUserProfileSchema, updateStaffProfileSchema };