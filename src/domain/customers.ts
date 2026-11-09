/** Digits only, ignoring a leading US country code, so "(555) 123-4567" and "+1 555 123 4567" compare equal. */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

const MIN_PHONE_DIGITS = 7;

/** A saved customer with the same phone number is a returning customer; no number on file means a new one. */
export function findCustomerByPhone<T extends { phone: string }>(customers: T[], phone: string): T | undefined {
  const target = normalizePhone(phone);
  if (target.length < MIN_PHONE_DIGITS) return undefined;
  return customers.find((customer) => normalizePhone(customer.phone) === target);
}
