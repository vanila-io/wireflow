import { describe, expect, it } from "vitest";
import { DiagramFileError, parseDiagramFile, serializeDiagram } from "../../utils/diagramFile";
import { templateUrl } from "../../utils/templates";

const cart = { type: "node", id: "n1", x: 100, y: 120, size: [96, 88], shape: "node-image-header", label: "Cart", img: templateUrl("E-Commerce/Cart") };
const error = { type: "node", id: "n2", x: 400, y: 120, size: [96, 78], shape: "node-image-without-header", label: "Oops", img: templateUrl("Misc/Error"), parent: "g1" };
const edge = { id: "e1", source: "n1", sourceAnchor: 1, target: "n2", targetAnchor: 3, shape: "flow-polyline-round", color: "#a4b2c0", style: { lineWidth: 2 }, label: "Pay" };
const group = { id: "g1", x: 380, y: 100, label: "Payment" };
const diagram = { nodes: [cart, error], edges: [edge], groups: [group] };

const file = (contents) => JSON.stringify({ format: "wireflow", version: 1, ...contents });
const problem = (text) => {
    try {
        parseDiagramFile(text);
    } catch (e) {
        expect(e).toBeInstanceOf(DiagramFileError);
        return e.message;
    }
    throw new Error("expected the file to be rejected");
};

describe("serializeDiagram", () => {
    it("should write a versioned file that names templates instead of image URLs", () => {
        const json = JSON.parse(serializeDiagram(diagram));

        expect(json).toEqual({
            format: "wireflow",
            version: 1,
            diagram: {
                nodes: [
                    { type: "node", id: "n1", x: 100, y: 120, size: [96, 88], shape: "node-image-header", label: "Cart", template: "E-Commerce/Cart" },
                    { type: "node", id: "n2", x: 400, y: 120, size: [96, 78], shape: "node-image-without-header", label: "Oops", template: "Misc/Error", parent: "g1" },
                ],
                edges: [edge],
                groups: [group],
            },
        });
        expect(JSON.stringify(json)).not.toContain("/assets/");
    });

    it("should keep images that aren't templates and fill in missing lists", () => {
        const photo = { ...cart, img: "https://example.com/photo.png" };
        expect(JSON.parse(serializeDiagram({ nodes: [photo] })).diagram).toEqual({ nodes: [photo], edges: [], groups: [] });
        expect(JSON.parse(serializeDiagram({})).diagram).toEqual({ nodes: [], edges: [], groups: [] });
    });

    it("should not change the diagram it is given", () => {
        const before = structuredClone(diagram);
        serializeDiagram(diagram);
        expect(diagram).toEqual(before);
    });
});

describe("parseDiagramFile", () => {
    it("should read back a saved file with this build's image URLs", () => {
        expect(parseDiagramFile(serializeDiagram(diagram))).toEqual(diagram);
    });

    it("should accept a plain diagram as kept in localStorage, repairing old template URLs", () => {
        const plain = { nodes: [{ ...cart, img: "/static/media/Cart.2ae03932.svg" }], edges: [], groups: [] };
        expect(parseDiagramFile(JSON.stringify(plain))).toEqual({ nodes: [cart], edges: [], groups: [] });
        expect(parseDiagramFile(JSON.stringify({ nodes: [] }))).toEqual({ nodes: [], edges: [], groups: [] });
    });

    it("should open everything the editor can save", () => {
        const all = {
            nodes: [
                { ...cart, parent: "inner" },
                { type: "node", id: "7", x: -40.5, y: 0, shape: "node-image-without-header", img: templateUrl("Misc/Steps") }, // no label
            ],
            edges: [
                { id: "to-group", source: "7", target: "outer" }, // no anchors or style
                { ...edge, id: "loose-end", source: "n1", target: { x: 500, y: 520 } }, // dropped on empty canvas
                { ...edge, id: "loose-start", source: { x: 0, y: 0 }, target: "7" },
            ],
            groups: [
                { id: "outer", x: 20, y: 20, label: "Shop" },
                { id: "inner", x: 40, y: 40, parent: "outer" },
            ],
        };
        expect(parseDiagramFile(serializeDiagram(all))).toEqual(all);
    });

    it("should drop __proto__ keys, so opening a file can't change Object.prototype", () => {
        const text = file({ diagram: { nodes: [cart] } }).replace('"label"', '"style":{"__proto__":{"polluted":true}},"__proto__":{"polluted":true},"label"');
        const [node] = parseDiagramFile(text).nodes;
        expect(Object.hasOwn(node, "__proto__")).toBe(false);
        expect(Object.hasOwn(node.style, "__proto__")).toBe(false);
        expect(node).toEqual({ ...cart, style: {} });
    });

    it("should reject files that aren't Wireflow diagrams", () => {
        expect(problem("")).toBe("It isn't a JSON file.");
        expect(problem("<svg/>")).toBe("It isn't a JSON file.");
        expect(problem("null")).toBe("It doesn't contain a Wireflow diagram.");
        expect(problem("[1, 2]")).toBe("It doesn't contain a Wireflow diagram.");
        expect(problem(JSON.stringify({ name: "wireflow", dependencies: {} }))).toBe("It doesn't contain a Wireflow diagram.");
        expect(problem(JSON.stringify({ format: "drawio", version: 1, diagram }))).toBe("It isn't a Wireflow file.");
        expect(problem(file({ diagram: null }))).toBe("It doesn't contain a Wireflow diagram.");
        expect(problem(file({ diagram: { nodes: [], edges: {} } }))).toBe("It doesn't contain a Wireflow diagram.");
    });

    it("should reject unknown and newer file versions", () => {
        expect(problem(file({ version: "1", diagram }))).toBe("It has an unknown file version.");
        expect(problem(file({ version: 0, diagram }))).toBe("It has an unknown file version.");
        expect(problem(file({ version: 2, diagram }))).toBe("It was saved by a newer version of Wireflow.");
    });

    it("should reject diagrams the canvas can't draw", () => {
        const nodes = (...list) => file({ diagram: { nodes: list } });
        expect(problem(nodes(null))).toBe("It has a node whose id is missing or isn't text.");
        expect(problem(nodes({ x: 1, y: 1 }))).toBe("It has a node whose id is missing or isn't text.");
        expect(problem(nodes({ ...cart, id: 7 }))).toBe("It has a node whose id is missing or isn't text."); // G6 can't select it
        expect(problem(nodes(cart, { ...cart }))).toBe('It has more than one item with the id "n1".');
        expect(problem(nodes({ ...cart, x: "100" }))).toBe('The node "n1" has no position.');
        expect(problem(nodes({ ...cart, label: 7 }))).toBe('The node "n1" has a label that isn\'t text.');
        expect(problem(nodes(error))).toBe('The node "n2" is in a group that doesn\'t exist.');
        expect(problem(nodes({ ...cart, img: undefined, template: "Misc/Hologram" }))).toBe(
            'It uses a screen template this version of Wireflow doesn\'t have: "Misc/Hologram".',
        );
        expect(problem(file({ diagram: { nodes: [cart], groups: [{ label: "?" }] } }))).toBe("It has a group whose id is missing or isn't text.");
    });

    it("should reject groups that are inside themselves, which would hang the page", () => {
        const groups = (...list) => file({ diagram: { nodes: [cart], groups: list } });
        expect(problem(groups({ id: "g1", parent: "g1" }))).toBe('The group "g1" is inside itself.');
        expect(problem(groups({ id: "g1", parent: "g2" }, { id: "g2", parent: "g1" }))).toMatch(/^The group "g[12]" is inside itself\.$/);
        expect(problem(groups({ id: "g0", parent: "g1" }, { id: "g1", parent: "g2" }, { id: "g2", parent: "g1" }))).toMatch(
            /^The group "g[12]" is inside itself\.$/,
        );
        expect(problem(groups({ id: "g1", parent: "g9" }))).toBe('The group "g1" is in a group that doesn\'t exist.');
    });

    it("should reject edges the canvas or the edge panel can't handle", () => {
        const edges = (...list) => file({ diagram: { nodes: [cart, { ...cart, id: "n2" }], edges: list } });
        const notConnected = 'The edge "e1" isn\'t connected to items in the diagram.';
        expect(problem(edges({ source: "n1", target: "n2" }))).toBe("It has an edge whose id is missing or isn't text.");
        expect(problem(edges({ ...edge, target: "n9" }))).toBe(notConnected);
        expect(problem(edges({ ...edge, target: undefined }))).toBe(notConnected);
        expect(problem(edges({ ...edge, target: { x: "500", y: 520 } }))).toBe(notConnected);
        expect(problem(edges({ ...edge, id: "e0" }, { ...edge, target: "e0" }))).toBe(notConnected); // edges end on nodes or groups
        expect(problem(edges({ ...edge, style: null }))).toBe('The edge "e1" has a style that isn\'t valid.');
        expect(problem(edges({ ...edge, color: 0xa4b2c0 }))).toBe('The edge "e1" has a color that isn\'t text.');
    });
});
