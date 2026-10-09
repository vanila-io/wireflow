import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveData } from "../../utils/saveData";

const nodes = [
    { type: "node", id: "n1", x: 100, y: 120, label: "Cart" },
    { type: "node", id: "n2", x: 400, y: 120, label: "Checkout" },
];
const edge = { id: "e1", source: "n1", sourceAnchor: 1, target: "n2", targetAnchor: 3 };

describe("saveData", () => {
    const store = new Map();

    beforeEach(() => {
        store.clear();
        vi.stubGlobal("localStorage", { setItem: (key, value) => store.set(key, value) });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should store the diagram as JSON under `data`", () => {
        const data = { nodes, edges: [edge], groups: [] };

        saveData(data);

        expect(JSON.parse(store.get("data"))).toEqual(data);
    });

    it("should never store an edge that does not connect two items", () => {
        // e.g. an edge pasted after one of its nodes was deleted, or one ending on a canvas point
        const toDeleted = { id: "e2", source: "deleted", target: "n2" };
        const loose = { id: "e3", source: "n1", target: { x: 500, y: 520 } };

        saveData({ nodes, edges: [toDeleted, edge, loose], groups: [] });

        expect(JSON.parse(store.get("data"))).toEqual({ nodes, edges: [edge], groups: [] });
    });
});
