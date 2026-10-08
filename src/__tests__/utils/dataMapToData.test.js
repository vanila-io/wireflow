import { describe, expect, it } from "vitest";
import { dataMapToData } from "../../utils/dataMapToData";

describe("dataMapToData", () => {
    it("should return empty node, edge and group lists when there is no data map", () => {
        expect(dataMapToData(undefined)).toEqual({ nodes: [], edges: [], groups: [] });
        expect(dataMapToData(null)).toEqual({ nodes: [], edges: [], groups: [] });
    });

    it("should sort the items of a data map into nodes, edges and groups", () => {
        const cart = { type: "node", id: "n1", x: 100, y: 120, shape: "node-image-header", label: "Cart" };
        const checkout = { type: "node", id: "n2", x: 400, y: 120, shape: "node-image-without-header", label: "Checkout", parent: "g1" };
        const edge = { id: "e1", source: "n1", target: "n2", shape: "flow-polyline-round", style: { lineWidth: 2 } };
        const group = { id: "g1", x: 380, y: 100, label: "Payment" };

        const result = dataMapToData({ n1: cart, e1: edge, g1: group, n2: checkout });

        expect(result).toEqual({ nodes: [cart, checkout], edges: [edge], groups: [group] });
    });

    it("should drop items that are not a node, a connected edge or a positioned group", () => {
        const result = dataMapToData({
            dangling: { id: "dangling", source: "n1" },
            unknown: { id: "unknown", label: "?" },
        });

        expect(result).toEqual({ nodes: [], edges: [], groups: [] });
    });
});
