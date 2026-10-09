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
        expect(problem(nodes(null))).toBe("It has a node without an id.");
        expect(problem(nodes({ x: 1, y: 1 }))).toBe("It has a node without an id.");
        expect(problem(nodes(cart, { ...cart }))).toBe('It has more than one item with the id "n1".');
        expect(problem(nodes({ ...cart, x: "100" }))).toBe('The node "n1" has no position.');
        expect(problem(nodes({ ...cart, label: 7 }))).toBe('The node "n1" has a label that isn\'t text.');
        expect(problem(nodes(error))).toBe('The node "n2" is in a group that doesn\'t exist.');
        expect(problem(nodes({ ...cart, img: undefined, template: "Misc/Hologram" }))).toBe(
            'It uses a screen template this version of Wireflow doesn\'t have: "Misc/Hologram".',
        );
        expect(problem(file({ diagram: { nodes: [cart], edges: [{ ...edge, target: "n9" }] } }))).toBe(
            'The edge "e1" isn\'t connected to items in the diagram.',
        );
        expect(problem(file({ diagram: { nodes: [cart], groups: [{ label: "?" }] } }))).toBe("It has a group without an id.");
    });
});
