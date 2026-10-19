import { cleanMetadataTitle, prettifyFileTitle } from "./titles";
import { baseName, safeFileName } from "./paths";
import { createSessionTracker, IDLE_CAP_MS } from "./sessionTracker";
import { migrateBook } from "../store/migrations";

describe("prettifyFileTitle", () => {
  it.each([
    ["my_great-book.pdf", "My great book"],
    ["1703123456789-atomic_habits.PDF", "Atomic habits"],
    ["clean.code.v2.pdf", "Clean code v2"],
    ["Deep Work - Cal Newport.pdf", "Deep Work - Cal Newport"],
    [".pdf", "Untitled"],
  ])("%s -> %s", (input, expected) => {
    expect(prettifyFileTitle(input)).toBe(expected);
  });
});

describe("cleanMetadataTitle", () => {
  it("accepts real titles and strips office prefixes/extensions", () => {
    expect(cleanMetadataTitle("  The Pragmatic Programmer ")).toBe(
      "The Pragmatic Programmer",
    );
    expect(cleanMetadataTitle("Microsoft Word - Thesis Final.docx")).toBe(
      "Thesis Final",
    );
  });

  it.each([null, 42, "", "Untitled", "Document1", "report.pdf", "1234", "ab"])(
    "rejects junk title %p",
    (input) => {
      expect(cleanMetadataTitle(input)).toBeNull();
    },
  );
});

describe("paths", () => {
  it("extracts and decodes the last path segment", () => {
    expect(
      baseName("file:///var/mobile/Containers/Data/books/170-My%20Book.pdf"),
    ).toBe("170-My Book.pdf");
    expect(baseName("/abs/path/file.pdf")).toBe("file.pdf");
  });

  it("makes file names safe", () => {
    expect(safeFileName("a/b:c?.pdf")).toBe("a_b_c_.pdf");
    expect(safeFileName("")).toBe("book.pdf");
  });
});

describe("migrateBook", () => {
  it("upgrades a v1 book with absolute paths and a raw file-name title", () => {
    const migrated = migrateBook({
      id: "x",
      title: "my_book.pdf",
      filePath: "file:///old/container/Documents/books/123-my_book.pdf",
      fileUri: "file:///old/container/Documents/books/123-my_book.pdf",
      currentPage: 4,
      totalPages: 0,
      lastReadAt: "2025-01-01T00:00:00.000Z",
    });
    expect(migrated).toMatchObject({
      id: "x",
      title: "My book",
      fileName: "123-my_book.pdf",
      currentPage: 4,
      addedAt: "2025-01-01T00:00:00.000Z",
      coverStatus: "pending",
      bookmarks: [],
      highlights: [],
    });
    expect(migrated).not.toHaveProperty("filePath");
    expect(migrated).not.toHaveProperty("fileUri");
  });

  it("keeps custom titles and existing covers", () => {
    const migrated = migrateBook({
      id: "y",
      title: "My Custom Name",
      titleCustomized: true,
      fileName: "a.pdf",
      coverFileName: "y.jpg",
      bookmarks: [],
      highlights: [],
    });
    expect(migrated.title).toBe("My Custom Name");
    expect(migrated.coverStatus).toBe("done");
  });
});

describe("createSessionTracker", () => {
  it("counts distinct pages after the first and active time", () => {
    const t = createSessionTracker(0);
    t.page(5, 0); // opening page doesn't count
    t.page(6, 30_000);
    t.page(7, 60_000);
    t.page(6, 90_000); // revisit doesn't count again
    expect(t.drain(120_000)).toEqual({ pages: 2, seconds: 120 });
    expect(t.drain(130_000)).toEqual({ pages: 0, seconds: 10 });
    expect(t.total()).toEqual({ pages: 2, seconds: 130 });
  });

  it("stops counting time after the idle cap", () => {
    const t = createSessionTracker(0);
    t.page(1, 0);
    expect(t.drain(IDLE_CAP_MS + 60 * 60 * 1000).seconds).toBe(
      IDLE_CAP_MS / 1000,
    );
  });

  it("does not count time while paused (app in background)", () => {
    const t = createSessionTracker(0);
    t.page(1, 0);
    t.pause(10_000);
    t.resume(500_000);
    t.page(2, 510_000);
    expect(t.drain(510_000)).toEqual({ pages: 1, seconds: 20 });
  });
});
