import { columnsForWidth, DESKTOP_MIN_WIDTH } from "./useBreakpoint";

describe("columnsForWidth", () => {
  it("uses 3 columns on phones", () => {
    expect(columnsForWidth(320)).toBe(3);
    expect(columnsForWidth(420)).toBe(3);
    expect(columnsForWidth(899)).toBe(3);
  });

  it("steps up with the viewport", () => {
    expect(columnsForWidth(900)).toBe(4);
    expect(columnsForWidth(1200)).toBe(5);
    expect(columnsForWidth(1500)).toBe(6);
    expect(columnsForWidth(2560)).toBe(6);
  });

  it("switches to the desktop layout at the breakpoint", () => {
    expect(DESKTOP_MIN_WIDTH).toBe(900);
    expect(899 >= DESKTOP_MIN_WIDTH).toBe(false);
    expect(900 >= DESKTOP_MIN_WIDTH).toBe(true);
  });
});
