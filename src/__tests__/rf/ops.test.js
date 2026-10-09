import { describe, expect, it } from "vitest";
import fixture from "../../../e2e/fixtures/checkout-flow.json";
import { fromG6 } from "../../rf/convert";
import { applyActions, copyItems, dropTargets, groupItems, pasteItems, removeItems, setParents, ungroupItem } from "../../rf/ops";

const ids = (items) => items.map((item) => item.id);
const counter = () => {
    let n = 0;
    return () => `new${(n += 1)}`;
};

describe("copy and paste", () => {
    it("should copy the edges between copied screens and paste them reconnected to the copies (#70)", () => {
        const clip = copyItems(fixture, ["signin01", "product1"]);
        expect(ids(clip.nodes)).toEqual(["signin01", "product1"]);
        expect(ids(clip.edges)).toEqual(["edge0001"]); // not edge0002, which leaves the copy

        const { data, ids: pasted } = pasteItems(fixture, clip, { newId: counter() });

        expect(pasted).toEqual(["new1", "new2"]);
        expect(data.nodes.slice(-2)).toMatchObject([
            { id: "new1", label: "Sign in", x: 170, y: 180 },
            { id: "new2", label: "Products", x: 420, y: 180 },
        ]);
        expect(data.edges.at(-1)).toMatchObject({ id: "new3", source: "new1", target: "new2", label: "Log in", sourceAnchor: 1, targetAnchor: 3 });
        expect(data.edges).toHaveLength(fixture.edges.length + 1);
    });

    it("should copy a group with its contents, and drop the parent of items copied without their group", () => {
        const clip = copyItems(fixture, ["group001"]);
        expect(ids(clip.groups)).toEqual(["group001"]);
        expect(ids(clip.nodes)).toEqual(["cart0001", "checkout"]);
        expect(ids(clip.edges)).toEqual(["edge0003"]);

        const { data } = pasteItems(fixture, clip, { newId: counter() });
        expect(data.groups.at(-1)).toMatchObject({ id: "new3", label: "Payment", x: 371.5, y: 384.5 });
        expect(data.nodes.slice(-2).map((n) => n.parent)).toEqual(["new3", "new3"]);

        expect(copyItems(fixture, ["cart0001"]).nodes[0].parent).toBeUndefined();
    });
});

describe("grouping", () => {
    it("should remove a group with its contents and every edge left without an end", () => {
        const data = removeItems(fixture, ["group001"]);
        expect(ids(data.nodes)).toEqual(["signin01", "product1", "complete"]);
        expect(ids(data.edges)).toEqual(["edge0001"]);
        expect(data.groups).toEqual([]);
    });

    it("should group items and ungroup them again", () => {
        const grouped = groupItems(fixture, ["signin01", "product1"], { id: "g2", label: "Browse" });
        expect(grouped.groups.at(-1)).toEqual({ id: "g2", label: "Browse" });
        expect(grouped.nodes.filter((n) => n.parent === "g2").map((n) => n.id)).toEqual(["signin01", "product1"]);

        const ungrouped = ungroupItem(grouped, "g2");
        expect(ungrouped).toEqual({ ...fixture, nodes: fixture.nodes });
    });

    it("should set and clear parents", () => {
        const data = setParents(fixture, { complete: "group001", cart0001: undefined });
        expect(data.nodes.find((n) => n.id === "complete").parent).toBe("group001");
        expect("parent" in data.nodes.find((n) => n.id === "cart0001")).toBe(false);
    });
});

describe("dropTargets", () => {
    const moved = (nodes, id, dx, dy) => nodes.map((n) => (n.id === id ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n));

    it("should add a screen dropped inside a group's frame to that group (#81)", () => {
        const { nodes } = fromG6(fixture);
        // "Order complete" (center 880, 420) dropped at (600, 420), inside the Payment frame.
        expect(dropTargets(moved(nodes, "complete", -280, 0), ["complete"])).toEqual({ complete: "group001" });
    });

    it("should take a screen out of its group when dropped outside the frame, and keep it when moved inside", () => {
        const { nodes } = fromG6(fixture);
        expect(dropTargets(moved(nodes, "cart0001", 0, -250), ["cart0001"])).toEqual({ cart0001: undefined });
        expect(dropTargets(moved(nodes, "cart0001", 20, 10), ["cart0001"])).toEqual({});
        // Moving the group moves its children; they stay in it.
        expect(dropTargets(moved(nodes, "group001", 300, 300), ["group001", "cart0001"])).toEqual({});
    });
});

describe("applyActions (port of #105's apply step)", () => {
    it("should apply a whole AI batch to the saved diagram", () => {
        const actions = [
            { kind: "add", type: "node", model: { id: "login", type: "node", shape: "node-image-header", size: [96, 88], img: "x.svg", label: "Log in", x: 150, y: 600 } },
            { kind: "add", type: "edge", model: { id: "c1", source: "login", target: "signin01", sourceAnchor: 0, targetAnchor: 2, shape: "flow-polyline-round", color: "#a4b2c0", style: { lineWidth: 2 } } },
            { kind: "update", id: "edge0003", model: { label: "Next", color: "#000000" } },
            { kind: "group", id: "auth", label: "Auth", members: ["login", "signin01"] },
            { kind: "remove", id: "complete" },
            { kind: "ungroup", id: "group001" },
        ];

        const data = applyActions(fixture, actions);

        expect(ids(data.nodes)).toEqual(["signin01", "product1", "cart0001", "checkout", "login"]);
        expect(data.nodes.filter((n) => n.parent === "auth").map((n) => n.id)).toEqual(["signin01", "login"]);
        expect(data.nodes.some((n) => n.parent === "group001")).toBe(false);
        expect(ids(data.edges)).toEqual(["edge0001", "edge0002", "edge0003", "c1"]);
        expect(data.edges.find((e) => e.id === "edge0003")).toMatchObject({ label: "Next", color: "#000000", shape: "flow-polyline" });
        expect(data.groups).toEqual([{ id: "auth", label: "Auth" }]);
        expect(applyActions(fixture, [{ kind: "clear" }])).toEqual({ nodes: [], edges: [], groups: [] });
        expect(() => applyActions(fixture, [{ kind: "explode" }])).toThrow('Unknown action "explode"');
    });
});
