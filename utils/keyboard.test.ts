import {
  focusNode,
  gridIntent,
  hasCommandModifier,
  isActivationKey,
  isControlTarget,
  isEditableTarget,
  keyFromEvent,
  nextGridIndex,
  pageIntent,
} from "./keyboard";

describe("gridIntent", () => {
  it("maps arrows and vim keys to directions", () => {
    expect(gridIntent("ArrowLeft")).toBe("left");
    expect(gridIntent("ArrowRight")).toBe("right");
    expect(gridIntent("ArrowUp")).toBe("up");
    expect(gridIntent("ArrowDown")).toBe("down");
    expect(gridIntent("h")).toBe("left");
    expect(gridIntent("l")).toBe("right");
    expect(gridIntent("k")).toBe("up");
    expect(gridIntent("j")).toBe("down");
  });

  it("maps Home and End to the ends", () => {
    expect(gridIntent("Home")).toBe("first");
    expect(gridIntent("End")).toBe("last");
  });

  it("ignores everything else", () => {
    expect(gridIntent("Enter")).toBeNull();
    expect(gridIntent("Tab")).toBeNull();
    expect(gridIntent("x")).toBeNull();
  });
});

describe("nextGridIndex", () => {
  const columns = 3;
  const count = 7;

  it("moves one tile left and right, clamped to the list", () => {
    expect(nextGridIndex(3, "ArrowRight", columns, count)).toBe(4);
    expect(nextGridIndex(3, "ArrowLeft", columns, count)).toBe(2);
    expect(nextGridIndex(0, "ArrowLeft", columns, count)).toBe(0);
    expect(nextGridIndex(6, "ArrowRight", columns, count)).toBe(6);
  });

  it("moves a whole row up and down, clamped to the list", () => {
    expect(nextGridIndex(4, "ArrowUp", columns, count)).toBe(1);
    expect(nextGridIndex(4, "ArrowDown", columns, count)).toBe(6);
    expect(nextGridIndex(1, "ArrowUp", columns, count)).toBe(0);
    expect(nextGridIndex(6, "ArrowDown", columns, count)).toBe(6);
  });

  it("jumps to the first and last tile", () => {
    expect(nextGridIndex(4, "Home", columns, count)).toBe(0);
    expect(nextGridIndex(4, "End", columns, count)).toBe(6);
  });

  it("treats an unselected list (-1) as the first tile", () => {
    expect(nextGridIndex(-1, "ArrowRight", columns, count)).toBe(1);
    expect(nextGridIndex(-1, "ArrowDown", columns, count)).toBe(3);
  });

  it("returns null for non-grid keys and empty lists", () => {
    expect(nextGridIndex(0, "Enter", columns, count)).toBeNull();
    expect(nextGridIndex(0, "ArrowRight", columns, 0)).toBeNull();
  });

  it("survives a zero column count", () => {
    expect(nextGridIndex(2, "ArrowDown", 0, count)).toBe(3);
  });
});

describe("pageIntent", () => {
  it("turns forward on the usual keys", () => {
    for (const key of ["ArrowRight", "ArrowDown", "PageDown", "j", "l", " "]) {
      expect(pageIntent(key)).toBe("next");
    }
  });

  it("turns back on the usual keys", () => {
    for (const key of ["ArrowLeft", "ArrowUp", "PageUp", "k", "h"]) {
      expect(pageIntent(key)).toBe("prev");
    }
  });

  it("turns back on Shift+Space", () => {
    expect(pageIntent(" ", true)).toBe("prev");
  });

  it("jumps to the ends with Home and End", () => {
    expect(pageIntent("Home")).toBe("first");
    expect(pageIntent("End")).toBe("last");
  });

  it("ignores other keys", () => {
    expect(pageIntent("Enter")).toBeNull();
    expect(pageIntent("Tab")).toBeNull();
  });
});

describe("isActivationKey", () => {
  it("accepts Enter and Space", () => {
    expect(isActivationKey("Enter")).toBe(true);
    expect(isActivationKey(" ")).toBe(true);
    expect(isActivationKey("Spacebar")).toBe(true);
    expect(isActivationKey("ArrowRight")).toBe(false);
  });
});

describe("keyFromEvent", () => {
  it("reads a DOM event", () => {
    expect(keyFromEvent({ key: "ArrowRight" })).toBe("ArrowRight");
  });

  it("reads a React Native onKeyDown event", () => {
    expect(keyFromEvent({ nativeEvent: { key: "Enter" } })).toBe("Enter");
  });

  it("returns an empty string for junk", () => {
    expect(keyFromEvent(null)).toBe("");
    expect(keyFromEvent({})).toBe("");
    expect(keyFromEvent("ArrowRight")).toBe("");
  });
});

describe("isEditableTarget", () => {
  it("detects text fields", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "textarea" })).toBe(true);
    expect(isEditableTarget({ tagName: "SELECT" })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(
      true,
    );
    expect(
      isEditableTarget({
        tagName: "DIV",
        getAttribute: (name: string) => (name === "role" ? "textbox" : null),
      }),
    ).toBe(true);
  });

  it("leaves buttons and plain elements alone", () => {
    expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isEditableTarget({ tagName: "DIV" })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("isControlTarget", () => {
  it("detects things that already react to Enter and Space", () => {
    expect(isControlTarget({ tagName: "BUTTON" })).toBe(true);
    expect(isControlTarget({ tagName: "A" })).toBe(true);
    expect(
      isControlTarget({
        tagName: "DIV",
        getAttribute: (name: string) => (name === "role" ? "button" : null),
      }),
    ).toBe(true);
  });

  it("leaves the page area alone", () => {
    expect(isControlTarget({ tagName: "DIV" })).toBe(false);
    expect(isControlTarget(null)).toBe(false);
  });
});

describe("hasCommandModifier", () => {
  it("ignores browser and OS shortcuts", () => {
    expect(hasCommandModifier({ metaKey: true })).toBe(true);
    expect(hasCommandModifier({ ctrlKey: true })).toBe(true);
    expect(hasCommandModifier({ altKey: true })).toBe(true);
    expect(hasCommandModifier({})).toBe(false);
    expect(hasCommandModifier(null)).toBe(false);
  });
});

describe("focusNode", () => {
  it("calls focus when the node supports it", () => {
    const focus = jest.fn();
    expect(focusNode({ focus })).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("reports false when it cannot focus", () => {
    expect(focusNode(null)).toBe(false);
    expect(focusNode({})).toBe(false);
  });
});
