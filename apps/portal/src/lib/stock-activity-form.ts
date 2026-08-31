import { z } from "zod";

const activityDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const note = z.string().trim().max(500);

export function readAnonymousPurchaseForm(formData: FormData) {
  return z.object({
    itemId: z.guid(),
    note,
    occurredOn: activityDate,
    quantity: z.coerce.number().positive(),
  }).safeParse({
    itemId: formData.get("item_id"),
    note: formData.get("note") ?? "",
    occurredOn: formData.get("occurred_on"),
    quantity: formData.get("quantity"),
  });
}

export function readCountedTotalForm(formData: FormData) {
  return z.object({
    itemId: z.guid(),
    note,
    occurredOn: activityDate,
    targetQuantity: z.coerce.number().nonnegative(),
  }).safeParse({
    itemId: formData.get("item_id"),
    note: formData.get("note") ?? "",
    occurredOn: formData.get("occurred_on"),
    targetQuantity: formData.get("target_quantity"),
  });
}
