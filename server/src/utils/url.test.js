const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateUrl,
  generateShortCode,
  isValidShortCode,
  SHORT_CODE_ALPHABET,
} = require("./url");

describe("validateUrl", () => {
  it("accepts a valid https URL and normalizes it", () => {
    const result = validateUrl("https://example.com/path?q=1");
    assert.equal(result.ok, true);
    assert.equal(result.url, "https://example.com/path?q=1");
  });

  it("accepts http URLs", () => {
    const result = validateUrl("http://localhost:3000/page");
    assert.equal(result.ok, true);
    assert.match(result.url, /^http:\/\/localhost:3000\/page\/?$/);
  });

  it("rejects empty or non-string input", () => {
    assert.equal(validateUrl("").ok, false);
    assert.equal(validateUrl("   ").ok, false);
    assert.equal(validateUrl(null).ok, false);
    assert.equal(validateUrl(123).ok, false);
  });

  it("rejects invalid URL strings", () => {
    const result = validateUrl("not-a-url");
    assert.equal(result.ok, false);
    assert.match(result.error, /Invalid URL/i);
  });

  it("rejects non-http(s) protocols", () => {
    const result = validateUrl("ftp://files.example.com/a");
    assert.equal(result.ok, false);
    assert.match(result.error, /http or https/i);
  });
});

describe("generateShortCode", () => {
  it("returns a string of the requested length", () => {
    const code = generateShortCode(7);
    assert.equal(typeof code, "string");
    assert.equal(code.length, 7);
  });

  it("only uses alphabet characters", () => {
    const code = generateShortCode(20);
    for (const ch of code) {
      assert.ok(SHORT_CODE_ALPHABET.includes(ch));
    }
  });

  it("throws on invalid length", () => {
    assert.throws(() => generateShortCode(2), /length must be/);
    assert.throws(() => generateShortCode(100), /length must be/);
  });

  it("produces different codes across calls (high probability)", () => {
    const a = generateShortCode(10);
    const b = generateShortCode(10);
    // Extremely unlikely to collide for length 10
    assert.notEqual(a, b);
  });
});

describe("isValidShortCode", () => {
  it("accepts alphanumeric codes of valid length", () => {
    assert.equal(isValidShortCode("abc123"), true);
    assert.equal(isValidShortCode("AbCdEfG"), true);
  });

  it("rejects invalid codes", () => {
    assert.equal(isValidShortCode("ab"), false);
    assert.equal(isValidShortCode("abc-def"), false);
    assert.equal(isValidShortCode(""), false);
    assert.equal(isValidShortCode(null), false);
  });
});
