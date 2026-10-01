const { z } = require("zod");

const priceField = z
  .coerce.number({ invalid_type_error: "Price must be a number." })
  .finite("Price must be a finite number.")
  .min(0, "Price cannot be negative.");

const stockField = z
  .coerce.number({ invalid_type_error: "Stock must be a number." })
  .int("Stock must be a whole number.")
  .min(0, "Stock cannot be negative.");

// Accepts a number, null (explicitly clearing the discount), or the empty
// string the frontend sends when the field is blank — coerced to null.
const discountPriceField = z
  .union([
    z.coerce.number({ invalid_type_error: "Discount price must be a number." }).finite().min(0),
    z.null(),
    z.literal("").transform(() => null),
  ]);

const createProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Product name is required.").max(200),
    price: priceField,
    discountPrice: discountPriceField.optional(),
    stock: stockField.default(0),
    category: z.string().trim().max(100).optional(),
    image: z.string().trim().url("Image must be a valid URL.").optional(),
    description: z.string().trim().max(2000).optional(),
    available: z.boolean().optional(),
  }),
});

const updateProductSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      price: priceField.optional(),
      discountPrice: discountPriceField.optional(),
      stock: stockField.optional(),
      category: z.string().trim().max(100).optional(),
      image: z.string().trim().url("Image must be a valid URL.").optional(),
      description: z.string().trim().max(2000).optional(),
      available: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required to update.",
    }),
});

module.exports = { createProductSchema, updateProductSchema };