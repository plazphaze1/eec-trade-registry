import { z } from "zod";

export function readRequestId(formData: FormData): string | null {
  const parsed = z.guid().safeParse(formData.get("request_id"));
  return parsed.success ? parsed.data : null;
}
