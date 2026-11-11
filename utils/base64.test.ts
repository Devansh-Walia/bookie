import { base64ToBytes, stripDataUrlPrefix } from "./base64";

/** Encodes bytes the way `canvas.toDataURL` would, for round-trip tests. */
function bytesToBase64(bytes: Uint8Array): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += alphabet[a >> 2];
    out += alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : alphabet[c & 63];
  }
  return out;
}

describe("base64ToBytes", () => {
  it("decodes a known string", () => {
    // "hello" -> aGVsbG8=
    expect(Array.from(base64ToBytes("aGVsbG8="))).toEqual([
      104, 101, 108, 108, 111,
    ]);
  });

  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 254, 255, 42]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(
      Array.from(bytes),
    );
  });

  it("round-trips every length modulo 3", () => {
    for (let length = 0; length < 12; length++) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) bytes[i] = (i * 37 + 11) & 0xff;
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(
        Array.from(bytes),
      );
    }
  });

  it("ignores whitespace and line breaks", () => {
    expect(Array.from(base64ToBytes("aGVs\nbG8=\n"))).toEqual([
      104, 101, 108, 108, 111,
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(base64ToBytes("").length).toBe(0);
  });
});

describe("stripDataUrlPrefix", () => {
  it("drops the data URL header", () => {
    expect(stripDataUrlPrefix("data:image/jpeg;base64,AAAA")).toBe("AAAA");
  });

  it("leaves bare base64 alone", () => {
    expect(stripDataUrlPrefix("AAAA")).toBe("AAAA");
  });
});
