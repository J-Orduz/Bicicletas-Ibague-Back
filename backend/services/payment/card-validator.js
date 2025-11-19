// Utility: Luhn + basic card detail checks
export function luhnCheck(number) {
  if (!number) return false;
  const cleaned = String(number).replace(/\s+/g, "");
  if (!/^\d+$/.test(cleaned)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function basicCardChecks({ number, exp_month, exp_year, cvc }) {
  const errors = [];
  if (!number)
    errors.push({ code: "MISSING_NUMBER", message: "Missing card number" });
  else if (!luhnCheck(number))
    errors.push({
      code: "INVALID_NUMBER",
      message: "Invalid card number (Luhn failed)",
    });

  const now = new Date();
  const year = Number(exp_year);
  const month = Number(exp_month);
  if (!exp_month || !exp_year) {
    errors.push({
      code: "MISSING_EXPIRY",
      message: "Missing expiry month/year",
    });
  } else if (isNaN(month) || month < 1 || month > 12 || isNaN(year)) {
    errors.push({
      code: "INVALID_EXPIRY",
      message: "Invalid expiry month or year",
    });
  } else {
    // treat two-digit years as 20xx if reasonable
    const fullYear = year < 100 ? 2000 + year : year;
    const expDate = new Date(fullYear, month - 1 + 1, 1); // first day of next month
    if (expDate <= now)
      errors.push({ code: "EXPIRED_CARD", message: "Card is expired" });
  }

  if (!cvc) errors.push({ code: "MISSING_CVC", message: "Missing CVC" });
  else if (!/^\d{3,4}$/.test(String(cvc)))
    errors.push({ code: "INVALID_CVC", message: "Invalid CVC format" });

  return { valid: errors.length === 0, errors };
}

export function maskNumber(number) {
  if (!number) return "";
  const s = String(number).replace(/\s+/g, "");
  if (s.length <= 4) return s;
  return s.slice(0, 6) + s.slice(6, -4).replace(/./g, "*") + s.slice(-4);
}
