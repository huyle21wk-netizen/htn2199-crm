/**
 * Normalize and validate a Vietnamese mobile phone number.
 * Handles common dirty inputs from Excel/CSV import:
 *   - Leading 0 dropped by Excel (912345678 → 0912345678)
 *   - Country code prefix: +84 or 84
 *   - Formatting chars: spaces, dashes, dots, parens
 * Returns { valid: true, formatted: "0xxx xxx xxx" } or { valid: false, error }
 */
export function validatePhone(raw: string): { valid: true; formatted: string } | { valid: false; error: string } {
  if (!raw || !raw.trim()) {
    return { valid: false, error: 'Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam 10 chữ số.' }
  }

  // Strip all non-digit chars (spaces, dashes, dots, parens, +)
  let digits = raw.replace(/\D/g, '')

  // Normalize 84xxxxxxxxx (country code without +) → 0xxxxxxxxx
  // Must be 11 digits: 84 + 9 digits
  if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2)
  }

  // Auto-fix: Excel drops the leading 0 from mobile numbers
  // 9-digit string starting with a valid VN mobile prefix → prepend 0
  if (digits.length === 9 && /^[35789]/.test(digits[0])) {
    digits = '0' + digits
  }

  // Must be exactly 10 digits at this point
  if (digits.length !== 10) {
    return { valid: false, error: 'Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam 10 chữ số.' }
  }

  // Must start with 0
  if (digits[0] !== '0') {
    return { valid: false, error: 'Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam 10 chữ số.' }
  }

  // Second digit must be a valid VN mobile prefix: 3, 5, 7, 8, 9
  if (!/^[35789]$/.test(digits[1])) {
    return { valid: false, error: 'Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam 10 chữ số.' }
  }

  // Format: 0xxx xxx xxx
  const formatted = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  return { valid: true, formatted }
}

/** Strip spaces from stored phone for use in Zalo URL */
export function phoneForUrl(phone: string): string {
  return phone.replace(/\s/g, '')
}
