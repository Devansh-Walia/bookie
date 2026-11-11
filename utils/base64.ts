/** Pure base64 helpers (no `atob`/`btoa`, so they work on every platform). */

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) table[ALPHABET.charCodeAt(i)] = i;
  return table;
})();

/** Decodes standard base64 (padding and line breaks tolerated). */
export function base64ToBytes(base64: string): Uint8Array {
  const out = new Uint8Array(Math.floor((base64.length * 3) / 4));
  let byte = 0;
  let bits = 0;
  let index = 0;

  for (let i = 0; i < base64.length; i++) {
    const code = base64.charCodeAt(i);
    // Skip padding, whitespace and anything else outside the alphabet.
    const value = code < 128 ? LOOKUP[code] : -1;
    if (value < 0) continue;

    byte = (byte << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (byte >> bits) & 0xff;
    }
  }

  return out.subarray(0, index);
}

/** Strips a `data:image/jpeg;base64,` prefix, if present. */
export function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}
