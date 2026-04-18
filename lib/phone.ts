/**
 * Normalize and validate a Vietnamese mobile phone number.
 * Returns { valid: true, formatted: "0xxx xxx xxx" } or { valid: false, error: "..." }
 */
export function validatePhone(raw: string): { valid: true; formatted: string } | { valid: false; error: string } {
  // Strip whitespace, dashes, dots, parens
  let digits = raw.replace(/[\s\-.()+]/g, '')

  // Normalize +84 / 84 prefix → 0
  if (digits.startsWith('+84')) {
    digits = '0' + digits.slice(3)
  } else if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2)
  }

  if (digits.length !== 10) {
    return { valid: false, error: 'Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam 10 chữ số.' }
  }

  if (!digits.startsWith('0')) {
    return { valid: false, error: 'Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam 10 chữ số.' }
  }

  if (!/^[35789]/.test(digits[1])) {
    return { valid: false, error: 'Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam 10 chữ số.' }
  }

  if (!/^\d+$/.test(digits)) {
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
