/** Unicode 17.0.0 Nd zero code points from UnicodeData.txt (decimal field 6).
 * Source SHA-256: 2e1efc1dcb59c575eedf5ccae60f95229f706ee6d031835247d843c11d96470c
 * Source/license: ../../../docs/UNICODE-DATA-LICENSE.txt. No runtime data fetch. */
const decimalZeros = Object.freeze([
  0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6,
  0xd66, 0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0,
  0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0,
  0xa9f0, 0xaa50, 0xabf0, 0xff10, 0x104a0, 0x10d30, 0x10d40, 0x11066, 0x110f0, 0x11136,
  0x111d0, 0x112f0, 0x11450, 0x114d0, 0x11650, 0x116c0, 0x116d0, 0x116da, 0x11730,
  0x118e0, 0x11950, 0x11bf0, 0x11c50, 0x11d50, 0x11da0, 0x11de0, 0x11f50, 0x16130,
  0x16a60, 0x16ac0, 0x16b50, 0x16d70, 0x1ccf0, 0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec,
  0x1d7f6, 0x1e140, 0x1e2f0, 0x1e4f0, 0x1e5f1, 0x1e950, 0x1fbf0,
]);
export const privacyPhonePolicy = 'steer-privacy-phone/unicode-17.0.0-v1' as const;
export const privacyPhoneTextLimit = 65536;
const phone = /(?<![\p{L}\p{N}])(?:(?:(?:\+|00)\d(?:[ .()\-]*\d){6,14})|(?:(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}))(?:\s*(?:x|ext\.?)[ ]*\d{1,6})?(?![\p{L}\p{N}])/u;

/** Inspection copy only. Never use this as replacement source/evidence bytes. */
export function normalizePrivacyPhoneText(input: string): string {
  if (typeof input !== 'string' || input.length > privacyPhoneTextLimit || /[\uD800-\uDFFF]/u.test(input))
    throw new Error('Uninspectable privacy text.');
  const compatible = input.normalize('NFKC');
  if (compatible.length > privacyPhoneTextLimit) throw new Error('Uninspectable privacy text.');
  let digits = '';
  for (const character of compatible) {
    const point = character.codePointAt(0)!;
    const zero = decimalZeros.find((start) => point >= start && point <= start + 9);
    if (zero !== undefined) digits += String(point - zero);
    else {
      // A newer runtime must not silently accept digits outside the pinned policy.
      if (/\p{Nd}/u.test(character)) throw new Error('Uninspectable privacy text.');
      digits += character;
    }
  }
  return digits.toLowerCase().replace(/\p{Cf}/gu, '').replace(/[‐‑‒–—]/gu, '-').replace(/\s+/gu, ' ').trim();
}

/** A narrow detector, not a sanitization or release decision. No source in output. */
export function inspectPrivacyPhoneText(input: unknown): 'clear' | 'phone' | 'uninspectable' {
  if (typeof input !== 'string') return 'uninspectable';
  try { return phone.test(normalizePrivacyPhoneText(input)) ? 'phone' : 'clear'; }
  catch { return 'uninspectable'; }
}
