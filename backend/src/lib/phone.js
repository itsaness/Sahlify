/**
 * Normalizes an Algerian mobile number to local 10-digit format (05/06/07xxxxxxxx)
 * or returns null if invalid.
 */
export function normalizeDzPhone(raw) {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[\s\-().+]/g, "");
  let local = digits;
  if (digits.startsWith("00213")) {
    local = "0" + digits.slice(5);
  } else if (digits.startsWith("213")) {
    local = "0" + digits.slice(3);
  }
  if (!/^0[567]\d{8}$/.test(local)) {
    return null;
  }
  return local;
}

/**
 * Converts a normalized 05/06/07xxxxxxxx number to E.164 without '+' (2135xxxxxxxx) for Meta CAPI.
 */
export function toMetaPhone(localPhone) {
  if (!localPhone || !localPhone.startsWith("0")) return "";
  return `213${localPhone.slice(1)}`;
}
