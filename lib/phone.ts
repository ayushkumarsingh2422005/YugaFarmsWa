import { env } from "@/lib/env";

/** E.164 digits only, e.g. 919671012177 */
export function normalizePhone(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) {
    digits = env.whatsapp.defaultCountryCode + digits;
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}
