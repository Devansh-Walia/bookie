/**
 * @jest-environment jsdom
 *
 * Behavioural tests for the page-curl gestures: the viewer script is mounted
 * in a real DOM with a stubbed PDF.js and driven with pointer/wheel events.
 * jsdom has no layout, so the page sits at (0, 0) with its CSS size
 * and client coordinates are page coordinates. The 600 x 800pt page is
 * fitted inside the reader's margins, so it measures 510 x 680 here.
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

async function settle(ms = 0) {
  for (let i = 0; i < 25; i++) await Promise.resolve();
  if (ms > 0) jest.advanceTimersByTime(ms);
  for (let i = 0; i < 25; i++) await Promise.resolve();
}

const viewer = () => document.getElementById("viewer") as HTMLElement;
const stage = () => document.getElementById("stage") as HTMLElement;
const pages = (posted: any[]) =>
  posted.filter((m) => m.type === "pageChange").map((m) => m.page);

function pointer(
  type: string,
  x: number,
  y: number,
  { id = 1, kind = "touch", buttons = 1 } = {},
) {
  const Ctor: typeof MouseEvent = (window as any).PointerEvent || MouseEvent;
  const event = new Ctor(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === "pointerup" ? 0 : buttons,
  });
  Object.defineProperty(event, "pointerId", { value: id });
  Object.defineProperty(event, "pointerType", { value: kind });
  viewer().dispatchEvent(event);
}

/** Drags from one point to another in `steps` moves, 16ms apart. */
async function drag(
  from: [number, number],
  to: [number, number],
  { steps = 8, kind = "touch", release = true } = {},
) {
  pointer("pointerdown", from[0], from[1], { kind });
  for (let i = 1; i <= steps; i++) {
    jest.advanceTimersByTime(16);
    const x = from[0] + ((to[0] - from[0]) * i) / steps;
    const y = from[1] + ((to[1] - from[1]) * i) / steps;
    pointer("pointermove", x, y, { kind });
    await settle();
  }
  if (release) pointer("pointerup", to[0], to[1], { kind });
  await settle(700);
}

async function tap(x: number, y: number, kind = "touch") {
  pointer("pointerdown", x, y, { kind });
  jest.advanceTimersByTime(40);
  pointer("pointerup", x, y, { kind });
  await settle();
}

describe("page curl gestures", () => {
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

  it("turns forward when the page is dragged to the left", async () => {
    const posted = mount(1);
    await settle();

    await drag([560, 600], [120, 620]);

    expect(pages(posted)).toEqual([1, 2]);
    // The curl is cleaned up: one page lies flat, nothing underneath.
    expect(document.getElementById("pageBack")!.children).toHaveLength(0);
    expect(document.getElementById("flapClip")!.style.display).toBe("none");
  });

  it("curls the page under the finger while dragging", async () => {
    mount(1);
    await settle();

    await drag([560, 600], [300, 600], { release: false });

    const front = document.getElementById("pageFront")!;
    expect(front.style.clipPath).toMatch(/^polygon\(/);
    expect(document.getElementById("flap")!.style.transform).toMatch(/^matrix\(/);
    expect(document.getElementById("pageBack")!.children).toHaveLength(1);
    pointer("pointerup", 300, 600);
    await settle(700);
  });

  it("springs back when the drag is pulled back before letting go", async () => {
    const posted = mount(2);
    await settle();

    pointer("pointerdown", 560, 400);
    for (const x of [520, 470, 420, 400, 430, 480, 540]) {
      jest.advanceTimersByTime(16);
      pointer("pointermove", x, 400);
      await settle();
    }
    pointer("pointerup", 540, 400);
    await settle(1500);

    expect(pages(posted)).toEqual([2]);
    expect(document.getElementById("flapClip")!.style.display).toBe("none");
  });

  it("turns back when the page is dragged to the right", async () => {
    const posted = mount(3);
    await settle();

    await drag([60, 400], [420, 400]);

    expect(pages(posted)).toEqual([3, 2]);
  });

  it("turns pages by tapping the outer edges", async () => {
    const posted = mount(2);
    await settle();

    await tap(495, 340);
    await settle(700);
    expect(pages(posted)).toEqual([2, 3]);

    await tap(15, 340);
    await settle(700);
    expect(pages(posted)).toEqual([2, 3, 2]);
  });

  it("zooms on double tap, pans instead of turning while zoomed", async () => {
    const posted = mount(1);
    await settle();

    await tap(300, 400);
    jest.advanceTimersByTime(100);
    await tap(300, 400);
    expect(stage().style.transform).toContain("scale(2)");
    expect(viewer().classList.contains("zoomed")).toBe(true);

    await drag([560, 400], [100, 400]);
    expect(pages(posted)).toEqual([1]);

    jest.advanceTimersByTime(400);
    await tap(300, 400);
    jest.advanceTimersByTime(100);
    await tap(300, 400);
    expect(stage().style.transform).toBe("");
  });

  it("turns one page per mouse-wheel gesture", async () => {
    const posted = mount(1);
    await settle();

    const wheel = (deltaY: number) =>
      viewer().dispatchEvent(
        new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }),
      );

    wheel(120);
    jest.advanceTimersByTime(20);
    wheel(120);
    await settle(700);
    expect(pages(posted)).toEqual([1, 2]);

    wheel(-120);
    await settle(700);
    expect(pages(posted)).toEqual([1, 2, 1]);
  });

  it("leaves mouse drags over the text alone so they can select it", async () => {
    const posted = mount(1);
    await settle();

    await drag([400, 400], [150, 400], { kind: "mouse" });

    expect(pages(posted)).toEqual([1]);
  });

  it("peels a corner under the mouse and turns when it is clicked", async () => {
    const posted = mount(1);
    await settle();

    // Hover the bottom-right corner: the page peels but does not turn.
    pointer("pointermove", 500, 670, { kind: "mouse", buttons: 0 });
    await settle(200);
    expect(document.getElementById("flapClip")!.style.display).toBe("block");
    expect(pages(posted)).toEqual([1]);

    await tap(500, 670, "mouse");
    await settle(700);
    expect(pages(posted)).toEqual([1, 2]);
  });
});
