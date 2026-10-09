import { describe, expect, it } from "vitest";
import { canRedo, canUndo, createHistory, record, redo, undo } from "../../rf/history";

describe("history", () => {
    it("should undo and redo recorded states in order", () => {
        let h = createHistory("a");
        h = record(h, "b");
        h = record(h, "c");
        expect(canUndo(h)).toBe(true);
        expect(canRedo(h)).toBe(false);

        h = undo(h);
        expect(h.present).toBe("b");
        h = undo(h);
        expect(h.present).toBe("a");
        expect(canUndo(h)).toBe(false);
        expect(undo(h)).toBe(h);

        h = redo(h);
        expect(h.present).toBe("b");
        expect(canRedo(h)).toBe(true);
    });

    it("should ignore a state equal to the present one and drop the redo stack on a new state", () => {
        let h = record(createHistory("a"), "b");
        expect(record(h, "b")).toBe(h);

        h = record(undo(h), "c");
        expect(h).toEqual({ past: ["a"], present: "c", future: [] });
        expect(redo(h)).toBe(h);
    });

    it("should keep at most `limit` undo steps", () => {
        let h = createHistory(0);
        for (let i = 1; i <= 5; i += 1) h = record(h, i, 3);
        expect(h.past).toEqual([2, 3, 4]);
    });
});
