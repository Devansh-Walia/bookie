import { buildCoverHtml } from "./coverHtml";

describe("buildCoverHtml", () => {
  it("inlines pdf.js, escapes script terminators and targets the given width", () => {
    const html = buildCoverHtml({
      pdfLibSource: 'var pdfjsLib = {}; "</script>";',
      pdfWorkerSource: "self.x = '</script>';",
      pdfUrl: "file:///books/a.pdf",
      width: 300,
    });
    const closing = (html.match(/<\/script>/g) || []).length;
    const opening = (html.match(/<script[ >]/g) || []).length;
    expect(closing).toBe(opening);
    expect(html).toContain('"file:///books/a.pdf"');
    expect(html).toContain("var TARGET_WIDTH = 300;");
    expect(html).toContain('type: "cover"');
    expect(html).toContain('type: "coverError"');
  });
});
