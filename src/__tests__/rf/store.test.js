import { describe, expect, it } from "vitest";
import fixture from "../../../e2e/fixtures/checkout-flow.json";
import { applyActions } from "../../rf/ops";
import { createDiagramStore } from "../../rf/store";

function setup() {
    const writes = [];
    const store = createDiagramStore({ doc: fixture, img: (url) => url, save: (json) => writes.push(JSON.parse(json)) });
    return { store, writes, last: () => writes.at(-1) };
}

describe("createDiagramStore", () => {
    it("should save nothing on load or on a selection change", () => {
        const { store, writes } = setup();
        store.onNodesChange([{ id: "signin01", type: "select", selected: true }]);
        expect(writes).toEqual([]);
        expect(store.getState().canUndo).toBe(false);
    });

    it("should save a connection as a G6 edge, and undo and redo it", () => {
        const { store, last } = setup();
        store.onConnect({ source: "complete", sourceHandle: "bottom", target: "signin01", targetHandle: "bottom" });
        expect(last().edges.at(-1)).toMatchObject({ source: "complete", sourceAnchor: 2, target: "signin01", targetAnchor: 2 });

        store.undo();
        expect(last()).toEqual(fixture);
        expect(store.getState()).toMatchObject({ canUndo: false, canRedo: true });

        store.redo();
        expect(last().edges).toHaveLength(5);
        expect(store.getState()).toMatchObject({ canUndo: true, canRedo: false });
    });

    it("should not save while a node is dragged, and save once when it is dropped", () => {
        const { store, writes, last } = setup();
        store.onNodesChange([{ id: "signin01", type: "position", position: { x: 110, y: 116 }, dragging: true }]);
        store.onNodesChange([{ id: "signin01", type: "position", position: { x: 120, y: 116 }, dragging: true }]);
        expect(writes).toEqual([]);
        store.onNodesChange([{ id: "signin01", type: "position", position: { x: 120, y: 116 }, dragging: false }]);
        expect(writes).toHaveLength(1);
        expect(last().nodes[0]).toMatchObject({ id: "signin01", x: 168, y: 160 });
    });

    it("should apply a batch of changes, like an AI edit, as one undo step", () => {
        const { store, writes, last } = setup();
        store.apply((doc) =>
            applyActions(doc, [
                { kind: "remove", id: "complete" },
                { kind: "update", id: "edge0001", model: { label: "Sign in" } },
                { kind: "group", id: "browse", label: "Browse", members: ["signin01", "product1"] },
            ]),
        );
        expect(writes).toHaveLength(1);
        expect(last().groups.map((g) => g.id)).toEqual(["group001", "browse"]);

        store.undo();
        expect(last()).toEqual(fixture);
    });

    it("should copy and paste screens with the arrows between them (#70)", () => {
        const { store, last } = setup();
        store.onNodesChange([
            { id: "signin01", type: "select", selected: true },
            { id: "product1", type: "select", selected: true },
        ]);
        store.copy();
        store.paste();
        const pasted = last().nodes.slice(-2);
        expect(pasted.map((n) => n.label)).toEqual(["Sign in", "Products"]);
        expect(last().edges.at(-1)).toMatchObject({ source: pasted[0].id, target: pasted[1].id, label: "Log in" });
        expect(store.getState().nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(pasted.map((n) => n.id));
    });
});
