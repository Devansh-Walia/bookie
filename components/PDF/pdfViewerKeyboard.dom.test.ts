/**
 * @jest-environment jsdom
 *
 * Behavioural tests for the keyboard reader: the viewer script is mounted in a
 * real DOM with a stubbed PDF.js, then driven with key events.
 */
import { buildPdfViewerHtml } from "./pdfViewerHtml";

function fakeDoc(numPages: number) {
  return {
    numPages,
    getPage: async () => ({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
      }),
      render: () => ({ promise: Promise.resolve() }),
      getTextContent: async () => ({ items: [] }),
    }),
  };
}

function mount(initialPage: number, numPages = 5) {
  const posted: any[] = [];
  (window as any).ReactNativeWebView = {
    postMessage: (data: string) => posted.push(JSON.parse(data)),
  };
  (window as any).URL.createObjectURL = () => "blob:worker";
  // jsdom has no canvas backend; the stubbed page.render ignores the context.
  (HTMLCanvasElement.prototype as any).getContext = () => null;

  const html = buildPdfViewerHtml({
    pdfLibSource: `window.pdfjsLib = {
      GlobalWorkerOptions: {},
      getDocument: function () {
        return { promise: Promise.resolve(window.__fakeDoc) };
      }
    };`,
    pdfWorkerSource: "self.onmessage = function () {};",
    pdfUrl: "file:///books/example.pdf",
    initialPage,
  });

  (window as any).__fakeDoc = fakeDoc(numPages);

  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (m) => m[1],
  );
  document.body.innerHTML = html.replace(/<script>[\s\S]*?<\/script>/g, "");
  for (const source of scripts) {
    // eslint-disable-next-line no-eval
    (0, eval)(source);
  }
  return posted;
}

/** Lets the viewer's promise chains settle, then runs any pending timers. */
async function settle(ms = 0) {
  for (let i = 0; i < 25; i++) await Promise.resolve();
  if (ms > 0) jest.advanceTimersByTime(ms);
  for (let i = 0; i < 25; i++) await Promise.resolve();
}

function press(key: string, init: KeyboardEventInit = {}) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
}

const pages = (posted: any[]) =>
  posted.filter((m) => m.type === "pageChange").map((m) => m.page);

describe("viewer keyboard", () => {
  // The viewer script registers document listeners; track them so each mount
  // starts from a clean document instead of stacking handlers.
  const listeners: Array<[string, EventListener]> = [];
  const originalAdd = document.addEventListener.bind(document);

  beforeEach(() => {
    jest.useFakeTimers();
    (document as any).addEventListener = (
      type: string,
      listener: EventListener,
      options?: unknown,
    ) => {
      listeners.push([type, listener]);
      originalAdd(type, listener, options as never);
    };
  });

  afterEach(() => {
    for (const [type, listener] of listeners.splice(0)) {
      document.removeEventListener(type, listener);
    }
    (document as any).addEventListener = originalAdd;
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  it("turns pages with the arrow keys", async () => {
    const posted = mount(1);
    await settle();
    expect(posted.some((m) => m.type === "ready")).toBe(true);
    expect(pages(posted)).toEqual([1]);

    press("ArrowRight");
    await settle(600);
    expect(pages(posted)).toEqual([1, 2]);

    press("ArrowLeft");
    await settle(600);
    expect(pages(posted)).toEqual([1, 2, 1]);
  });

  it("turns pages with Space and Shift+Space", async () => {
    const posted = mount(2);
    await settle();

    press(" ");
    await settle(600);
    expect(pages(posted)).toEqual([2, 3]);

    press(" ", { shiftKey: true });
    await settle(600);
    expect(pages(posted)).toEqual([2, 3, 2]);
  });

  it("jumps to the ends with Home and End", async () => {
    const posted = mount(2, 5);
    await settle();

    press("End");
    await settle();
    expect(pages(posted).pop()).toBe(5);

    press("Home");
    await settle();
    expect(pages(posted).pop()).toBe(1);
  });

  it("forwards reader shortcuts to the host", async () => {
    const posted = mount(1);
    await settle();

    press("Escape");
    press("b");
    press("t");
    press("a");

    expect(posted.filter((m) => m.type === "shortcut")).toEqual([
      { type: "shortcut", action: "close" },
      { type: "shortcut", action: "bookmark" },
      { type: "shortcut", action: "theme" },
      { type: "shortcut", action: "annotations" },
    ]);
  });

  it("ignores keys typed into a text field", async () => {
    const posted = mount(1);
    await settle();
    const before = pages(posted).length;

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle(600);

    expect(pages(posted)).toHaveLength(before);
  });

  it("leaves Space alone when a control has focus", async () => {
    const posted = mount(1);
    await settle();
    const before = pages(posted).length;

    const button = document.getElementById("next") as HTMLButtonElement;
    button.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle(600);

    expect(pages(posted)).toHaveLength(before);
  });
});
