import { formatBytes, isSafeName, parseManifest } from "./backupFormat";

describe("isSafeName", () => {
  it("accepts plain file names", () => {
    expect(isSafeName("book.pdf")).toBe(true);
    expect(isSafeName("my book (1).pdf")).toBe(true);
    expect(isSafeName("cover-abc.png")).toBe(true);
  });

  it("rejects traversal and separators", () => {
    expect(isSafeName("")).toBe(false);
    expect(isSafeName(".")).toBe(false);
    expect(isSafeName("..")).toBe(false);
    expect(isSafeName("../escape.pdf")).toBe(false);
    expect(isSafeName("a/b.pdf")).toBe(false);
    expect(isSafeName("a\\b.pdf")).toBe(false);
    expect(isSafeName("nul\0.pdf")).toBe(false);
  });
});

describe("parseManifest", () => {
  const valid = {
    format: "bookie-backup",
    version: 1,
    exportedAt: "2026-01-02T03:04:05.000Z",
    appVersion: "1.2.0",
    stores: { books: { books: [] } },
    files: { books: ["a.pdf"], covers: ["a.png"] },
  };

  it("round-trips a valid manifest", () => {
    const m = parseManifest(JSON.stringify(valid));
    expect(m.format).toBe("bookie-backup");
    expect(m.version).toBe(1);
    expect(m.exportedAt).toBe(valid.exportedAt);
    expect(m.appVersion).toBe("1.2.0");
    expect(m.files).toEqual({ books: ["a.pdf"], covers: ["a.png"] });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseManifest("{not json")).toThrow(/not valid JSON/);
  });

  it("rejects a foreign archive", () => {
    expect(() => parseManifest(JSON.stringify({ ...valid, format: "other" }))).toThrow(
      /not a Bookie backup/,
    );
  });

  it("rejects a missing version", () => {
    const { version, ...rest } = valid;
    expect(() => parseManifest(JSON.stringify(rest))).toThrow(/format version/);
  });

  it("rejects a newer format", () => {
    expect(() => parseManifest(JSON.stringify({ ...valid, version: 99 }))).toThrow(
      /newer version of Bookie/,
    );
  });

  it("rejects a manifest without stores", () => {
    const { stores, ...rest } = valid;
    expect(() => parseManifest(JSON.stringify(rest))).toThrow(/no app data/);
  });

  it("drops unsafe and non-string file names", () => {
    const m = parseManifest(
      JSON.stringify({
        ...valid,
        files: { books: ["ok.pdf", "../evil.pdf", 42, null], covers: "nope" },
      }),
    );
    expect(m.files.books).toEqual(["ok.pdf"]);
    expect(m.files.covers).toEqual([]);
  });

  it("defaults missing metadata", () => {
    const m = parseManifest(
      JSON.stringify({ format: "bookie-backup", version: 1, stores: {} }),
    );
    expect(m.exportedAt).toBe("");
    expect(m.appVersion).toBe("unknown");
    expect(m.files).toEqual({ books: [], covers: [] });
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1.0 KB"],
    [1536, "1.5 KB"],
    [1024 * 1024, "1.0 MB"],
    [95_053_749, "91 MB"],
    [5 * 1024 ** 3, "5.0 GB"],
  ])("%i -> %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("handles nonsense input", () => {
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
  });
});
