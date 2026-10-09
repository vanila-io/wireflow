import { describe, expect, it } from "vitest";
import fixture from "../../../e2e/fixtures/checkout-flow.json";
import { GROUP_PADDING, absoluteBoxes, fitGroups, fromG6, toG6, toRfEdge } from "../../rf/convert";

const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));

describe("fromG6", () => {
    it("should turn G6 nodes (centers) into screen nodes (top-left) with their size, image and header", () => {
        const { nodes } = fromG6(fixture);
        const { signin01, cart0001 } = byId(nodes);

        expect(signin01).toMatchObject({
            type: "screen",
            position: { x: 150 - 48, y: 160 - 44 },
            width: 96,
            height: 88,
            data: { label: "Sign in", img: "/static/media/Sign in 1.a1b484ff.svg", header: true, shape: "node-image-header" },
        });
        expect(signin01.parentId).toBeUndefined();
        expect(cart0001).toMatchObject({ width: 96, height: 78, parentId: "group001", data: { header: false } });
    });

    it("should draw a group as a parent node framing its children, with child positions relative to it", () => {
        const { nodes } = fromG6(fixture);
        const { group001, cart0001, checkout } = byId(nodes);

        // Children: Cart 352..448 x 381..459, Checkout 592..688 x 376..464.
        const frame = { x: 352 - GROUP_PADDING.left, y: 376 - GROUP_PADDING.top };
        expect(group001).toMatchObject({
            type: "group",
            position: frame,
            width: 688 + GROUP_PADDING.right - frame.x,
            height: 464 + GROUP_PADDING.bottom - frame.y,
            data: { label: "Payment" },
        });
        expect(cart0001.position).toEqual({ x: 352 - frame.x, y: 381 - frame.y });
        expect(checkout.position).toEqual({ x: 592 - frame.x, y: 376 - frame.y });
        // React Flow needs parents before their children.
        expect(nodes.findIndex((n) => n.id === "group001")).toBeLessThan(nodes.findIndex((n) => n.id === "cart0001"));
    });

    it("should map anchors to handles and G6 edge shapes to React Flow edge types with color, width and label", () => {
        const { edges } = fromG6(fixture);
        const { edge0001, edge0002, edge0003 } = byId(edges);

        expect(edge0001).toMatchObject({
            sourceHandle: "right",
            targetHandle: "left",
            type: "smoothstep",
            label: "Log in",
            style: { stroke: "#a4b2c0", strokeWidth: 2 },
            markerEnd: { type: "arrowclosed", color: "#a4b2c0" },
        });
        expect(edge0002).toMatchObject({ sourceHandle: "bottom", targetHandle: "top", type: "default", style: { stroke: "#1890ff", strokeWidth: 4 } });
        expect(edge0003).toMatchObject({ type: "step", style: { stroke: "#f5222d", strokeWidth: 3 } });
        expect(edge0003.label).toBeUndefined();
    });

    it("should drop edges with a loose or unknown end and report them", () => {
        const loose = { id: "loose", source: "signin01", target: { x: 10, y: 10 } };
        const unknown = { id: "unknown", source: "gone", target: "signin01" };
        const { edges, dropped } = fromG6({ ...fixture, edges: [...fixture.edges, loose, unknown] });

        expect(edges.map((e) => e.id)).toEqual(["edge0001", "edge0002", "edge0003", "edge0004"]);
        expect(dropped).toEqual([loose, unknown]);
    });

    it("should nest groups, place empty groups at their saved x/y and ignore unknown parents", () => {
        const data = {
            nodes: [
                { type: "node", id: "a", x: 100, y: 100, size: [96, 88], shape: "node-image-header" },
                { type: "node", id: "b", x: 300, y: 100, size: [96, 88], shape: "node-image-header", parent: "missing" },
            ],
            edges: [],
            groups: [
                { id: "inner", label: "Inner", parent: "outer" },
                { id: "outer", label: "Outer" },
                { id: "empty", label: "Empty", x: 500, y: 600 },
            ],
        };
        data.nodes[0].parent = "inner";
        const { nodes } = fromG6(data);
        const { inner, outer, empty, a, b } = byId(nodes);

        expect(nodes.map((n) => n.id)).toEqual(["outer", "empty", "inner", "a", "b"]);
        expect(inner.parentId).toBe("outer");
        expect(inner.position).toEqual({ x: GROUP_PADDING.left, y: GROUP_PADDING.top });
        expect(a.position).toEqual({ x: GROUP_PADDING.left, y: GROUP_PADDING.top });
        expect(outer.width).toBe(96 + 2 * (GROUP_PADDING.left + GROUP_PADDING.right));
        expect(empty).toMatchObject({ position: { x: 500, y: 600 }, width: 184, height: 40 });
        expect(b.parentId).toBeUndefined();
    });

    it("should repair image URLs with the given mapper and accept an empty or missing diagram", () => {
        const { nodes } = fromG6(fixture, { img: (url) => url.replace("/static/media/", "/assets/") });
        expect(nodes.find((n) => n.id === "cart0001").data.img).toBe("/assets/Cart.2ae03932.svg");

        expect(fromG6(null)).toEqual({ nodes: [], edges: [], dropped: [] });
        expect(fromG6({ nodes: [] })).toEqual({ nodes: [], edges: [], dropped: [] });
    });
});

describe("toG6", () => {
    it("should round-trip the fixture to exactly the same diagram", () => {
        expect(toG6(fromG6(fixture))).toEqual(fixture);
    });

    it("should round-trip fractional positions, unknown fields, edges without anchors and empty labels", () => {
        const data = {
            nodes: [
                { type: "node", id: "a", x: 351.333333333, y: 99.1, size: [96, 78], shape: "node-image-without-header", img: "a.svg", label: "A", parent: "g", extra: { keep: true } },
                { type: "node", id: "b", x: 600.7, y: 120.25, size: [96, 88], shape: "node-image-header", img: "b.svg", parent: "g" },
            ],
            edges: [{ id: "e", source: "a", target: "b", shape: "flow-smooth", color: "#123456", style: { lineWidth: 1, lineDash: [4, 2] }, label: "", index: 3 }],
            groups: [{ id: "g", label: "G", x: 290.83, y: 41.5, collapsed: false }],
        };

        expect(toG6(fromG6(data))).toEqual(data);
    });

    it("should give the same JSON string when a saved diagram is loaded and saved again", () => {
        const once = JSON.stringify(toG6(fromG6(fixture)));
        expect(JSON.stringify(toG6(fromG6(JSON.parse(once))))).toBe(once);
    });

    it("should write moved nodes as centers in absolute coordinates", () => {
        const rf = fromG6(fixture);
        const cart = rf.nodes.find((n) => n.id === "cart0001");
        cart.position = { x: cart.position.x + 30, y: cart.position.y - 5 };
        const group = rf.nodes.find((n) => n.id === "group001");
        group.position = { x: group.position.x + 100, y: group.position.y };

        const saved = byId(toG6(rf).nodes);
        expect(saved.cart0001).toMatchObject({ x: 400 + 130, y: 420 - 5 });
        expect(saved.checkout).toMatchObject({ x: 640 + 100, y: 420 });
        // gg-editor saved the group at x/y 351.5/364.5; it moves with its frame.
        expect(byId(toG6(rf).groups).group001).toMatchObject({ x: 451.5, y: 364.5 });
    });

    it("should write new nodes, groups and connections in gg-editor's format", () => {
        const nodes = [
            { id: "g", type: "group", position: { x: 0, y: 0 }, width: 300, height: 200, data: { label: "New group" } },
            { id: "n", type: "screen", parentId: "g", position: { x: 10, y: 52 }, width: 96, height: 88, data: { img: "x.svg", label: "X", shape: "node-image-header" } },
            { id: "m", type: "screen", position: { x: 500, y: 0 }, width: 96, height: 88, data: { img: "y.svg", shape: "node-image-header" } },
        ];
        const edge = toRfEdge(
            { id: "e", source: "n", target: "m", shape: "flow-polyline-round", color: "#a4b2c0", style: { lineWidth: 2 } },
            { sourceHandle: "right", targetHandle: "left" },
        );

        expect(toG6({ nodes, edges: [edge] })).toEqual({
            nodes: [
                { type: "node", id: "n", parent: "g", x: 58, y: 96, size: [96, 88], shape: "node-image-header", img: "x.svg", label: "X" },
                { type: "node", id: "m", x: 548, y: 44, size: [96, 88], shape: "node-image-header", img: "y.svg" },
            ],
            edges: [{ id: "e", source: "n", sourceAnchor: 1, target: "m", targetAnchor: 3, shape: "flow-polyline-round", color: "#a4b2c0", style: { lineWidth: 2 } }],
            groups: [{ id: "g", label: "New group", x: 10, y: 40 }],
        });
    });
});

describe("fitGroups", () => {
    it("should re-fit a group around its children after one moves, keeping absolute positions and selection", () => {
        const rf = fromG6(fixture);
        const before = absoluteBoxes(rf.nodes);
        const nodes = rf.nodes.map((n) => (n.id === "checkout" ? { ...n, selected: true, position: { x: n.position.x + 200, y: n.position.y + 100 } } : n));

        const fitted = fitGroups(nodes);
        const after = absoluteBoxes(fitted);
        const group = fitted.find((n) => n.id === "group001");

        expect(after.get("checkout")).toMatchObject({ x: before.get("checkout").x + 200, y: before.get("checkout").y + 100 });
        expect(after.get("cart0001")).toEqual(before.get("cart0001"));
        expect(group.width).toBe(before.get("group001").width + 200);
        // Cart (top 381) is now the topmost child; Checkout's bottom moved from 464 to 564.
        expect(group.height).toBe(564 + GROUP_PADDING.bottom - (381 - GROUP_PADDING.top));
        expect(fitted.find((n) => n.id === "checkout").selected).toBe(true);
        // The saved diagram still matches what the user sees.
        expect(byId(toG6({ nodes: fitted }).nodes).checkout).toMatchObject({ x: 840, y: 520 });
    });
});
