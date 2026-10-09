import { describe, expect, it } from "vitest";
import { removeDanglingEdges } from "../../utils/removeDanglingEdges";

const nodes = [
    { type: "node", id: "n1", x: 100, y: 120, label: "Cart", parent: "g1" },
    { type: "node", id: "n2", x: 400, y: 120, label: "Checkout" },
];
const groups = [{ id: "g1", x: 80, y: 100, label: "Shop" }];
const edge = { id: "e1", source: "n1", sourceAnchor: 1, target: "n2", targetAnchor: 3, shape: "flow-polyline-round" };

describe("removeDanglingEdges", () => {
    it("should return what it is given when there is no diagram or no edge list", () => {
        expect(removeDanglingEdges(null)).toBeNull();
        expect(removeDanglingEdges(undefined)).toBeUndefined();
        const noEdges = { nodes, groups };
        expect(removeDanglingEdges(noEdges)).toBe(noEdges);
    });

    it("should return the same object when every edge connects two items", () => {
        const toGroup = { id: "e2", source: "n2", target: "g1" };
        const data = { nodes, edges: [edge, toGroup], groups };

        expect(removeDanglingEdges(data)).toBe(data);
    });

    it("should drop edges with a canvas point or an unknown id as an end and keep the rest", () => {
        const data = {
            nodes,
            edges: [
                { id: "e2", source: "n1", target: { x: 500, y: 520 } },
                edge,
                { id: "e3", source: { x: 10, y: 20 }, target: "n2" },
                { id: "e4", source: "n2", target: "deleted" },
                { id: "e5", source: "n2" },
            ],
            groups,
        };

        const result = removeDanglingEdges(data);

        expect(result).toEqual({ nodes, edges: [edge], groups });
        expect(result.nodes).toBe(nodes);
        expect(data.edges).toHaveLength(5); // the input is not mutated
    });

    it("should drop every edge when the diagram has no nodes", () => {
        expect(removeDanglingEdges({ edges: [edge] })).toEqual({ edges: [] });
    });
});
