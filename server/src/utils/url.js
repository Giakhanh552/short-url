/**
 * Validate and normalize a long URL for shortening.
 * @param {unknown} input
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
function validateUrl(input) {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "URL is required" };
  }

  const trimmed = input.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Invalid URL format" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "URL must use http or https" };
  }

  if (!parsed.hostname || parsed.hostname.length < 1) {
    return { ok: false, error: "URL must have a hostname" };
  }

  return { ok: true, url: parsed.toString() };
}

const SHORT_CODE_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generate a random short code of given length.
 * @param {number} [length=7]
 * @returns {string}
 */
function generateShortCode(length = 7) {
  if (!Number.isInteger(length) || length < 4 || length > 32) {
    throw new Error("length must be an integer between 4 and 32");
  }

  let code = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * SHORT_CODE_ALPHABET.length);
    code += SHORT_CODE_ALPHABET[idx];
  }
  return code;
}

/**
 * Check if a short code looks valid (alphanumeric, length 4–32).
 * @param {unknown} code
 * @returns {boolean}
 */
function isValidShortCode(code) {
  return typeof code === "string" && /^[a-zA-Z0-9]{4,32}$/.test(code);
}

module.exports = {
  validateUrl,
  generateShortCode,
  isValidShortCode,
  SHORT_CODE_ALPHABET,
};
