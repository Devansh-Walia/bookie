import { buildPdfViewerHtml } from "./pdfViewerHtml";

describe("buildPdfViewerHtml", () => {
  it("embeds the pdf url, initial page, and inlines the lib/worker sources", () => {
    const html = buildPdfViewerHtml({
      pdfLibSource: "var pdfjsLib = {};",
      pdfWorkerSource: "self.onmessage = function () {};",
      pdfUrl: "file:///books/example.pdf",
      initialPage: 3,
    });

    expect(html).toContain("var pdfjsLib = {};");
    expect(html).toContain("file:///books/example.pdf");
    expect(html).toContain("Page: 3");
  });

  it("never leaves an unescaped </script> sequence from inlined sources (would truncate the HTML)", () => {
    const html = buildPdfViewerHtml({
      pdfLibSource: 'console.log("</script> injected from lib");',
      pdfWorkerSource: 'self.onmessage = function () { return "</script>"; };',
      pdfUrl: "file:///books/example.pdf",
      initialPage: 1,
    });

    // Every "</script" in the document must be one of our own authored
    // closing tags, i.e. immediately followed by ">" and only appearing the
    // expected number of times (one per <script> we open) - not from
    // attacker/library-controlled content breaking out early.
    const closingTagCount = (html.match(/<\/script>/g) || []).length;
    const openingTagCount = (html.match(/<script[ >]/g) || []).length;
    expect(closingTagCount).toBe(openingTagCount);

    // The literal payloads must have been neutralized (escaped) rather than
    // appearing verbatim as raw "</script>" text.
    expect(html).not.toContain('"</script> injected from lib"');
    expect(html).not.toContain('"</script>"; };');
  });

  it("safely JSON-encodes worker source containing quotes, backslashes, and newlines", () => {
    const trickyWorkerSource =
      "self.onmessage = function (e) {\n  var s = \"quote'\\\\backslash\";\n};";

    const html = buildPdfViewerHtml({
      pdfLibSource: "var pdfjsLib = {};",
      pdfWorkerSource: trickyWorkerSource,
      pdfUrl: "file:///books/example.pdf",
      initialPage: 1,
    });

    // Extract the JSON string literal assigned to `workerSource` and make
    // sure it round-trips back to the exact original source.
    const match = html.match(/var workerSource = (".*?");\n\s*var workerBlob/s);
    expect(match).not.toBeNull();
    const decoded = JSON.parse((match as RegExpMatchArray)[1]);
    expect(decoded).toBe(trickyWorkerSource);
  });

  it("falls back to page 1 for invalid initial page numbers", () => {
    const html = buildPdfViewerHtml({
      pdfLibSource: "",
      pdfWorkerSource: "",
      pdfUrl: "file:///books/example.pdf",
      initialPage: -5,
    });

    expect(html).toContain("Page: 1");
    expect(html).toContain("var currentPage = 1;");
  });

  it("wraps computeRenderScale as a name-independent expression so minified builds still resolve the call sites", () => {
    const html = buildPdfViewerHtml({
      pdfLibSource: "",
      pdfWorkerSource: "",
      pdfUrl: "file:///books/example.pdf",
      initialPage: 1,
    });

    expect(html).toContain("var computeRenderScale = (function");
    expect(html).toContain("computeRenderScale({");
  });
});
