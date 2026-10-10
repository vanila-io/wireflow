import { describe, expect, it } from "vitest";
import { STORAGE_KEY } from "@/lib/diagram/model";
import { serialize } from "@/lib/diagram/rules";
import { backup, BACKUP_KEY, migrate, readDiagram, writeDiagram } from "@/lib/diagram/storage";
import { card, edge, MemoryStorage, PRODUCTION_EDGE, PRODUCTION_SAMPLE } from "./helpers";

describe("autosave storage", () => {
  it("reads what the editor saved before this change (version 1, no version field) unchanged", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(PRODUCTION_SAMPLE));
    const loaded = readDiagram(storage);
    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") return;
    expect(loaded.diagram.nodes.map((n) => n.data)).toEqual(PRODUCTION_SAMPLE.nodes.map((n) => n.data));
    expect(loaded.diagram.nodes.map((n) => n.position)).toEqual(PRODUCTION_SAMPLE.nodes.map((n) => n.position));
    expect(loaded.diagram.edges).toEqual([PRODUCTION_EDGE]);
    expect(loaded.dropped).toEqual({ nodes: 0, edges: 0 });
    // Reading writes nothing, and needs no backup.
    expect(loaded.backup).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(PRODUCTION_SAMPLE));
  });

  it("writes the same key with a version, in a shape the previous editor still reads", () => {
    const storage = new MemoryStorage();
    expect(writeDiagram(storage, serialize({ nodes: [card("a")], edges: [] }))).toBe(true);
    const stored = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(stored.version).toBe(2);
    // The previous loader: saved?.nodes?.length, then nodes/edges as React Flow data.
    expect(stored.nodes[0]).toMatchObject({
      id: "a",
      type: "flow",
      position: { x: 0, y: 0 },
      data: { graphicId: "article-article-1", src: "/graphics/article/article-1.svg" },
    });
    expect(stored.edges).toEqual([]);
  });

  it("migrates by version and refuses what is not a diagram", () => {
    expect(migrate({ nodes: [], edges: [] })).toEqual({ version: 1, data: { nodes: [], edges: [] } });
    expect(migrate({ version: 2, nodes: [] })?.version).toBe(2);
    for (const bad of [null, [], "x", { edges: [] }, { version: 0, nodes: [] }, { version: "2", nodes: [] }]) {
      expect(migrate(bad)).toBeNull();
    }
  });

  it("keeps unreadable data in a backup key instead of losing it", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{"nodes": [tr');
    expect(readDiagram(storage)).toEqual({ status: "unreadable", backup: BACKUP_KEY });
    expect(storage.getItem(BACKUP_KEY)).toBe('{"nodes": [tr');
  });

  it("keeps every unreadable version, not just the first", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "first");
    readDiagram(storage);
    storage.setItem(STORAGE_KEY, "second");
    const second = readDiagram(storage);
    expect(second.status === "unreadable" && second.backup).toMatch(/^wireflow-flow-v1\.backup\.\d+$/);
    expect(storage.getItem(BACKUP_KEY)).toBe("first");
    expect(storage.getItem((second as { backup: string }).backup)).toBe("second");
    expect(backup(new MemoryStorage(3), "too long")).toBeNull();
  });

  it("reports data from a newer version, recognised before its shape, so it is not overwritten", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, nodes: { a: card("a") }, links: [] }));
    expect(readDiagram(storage)).toEqual({ status: "newer", diagram: { nodes: [], edges: [] } });
  });

  // #107: a dangling edge saved by an older build is dropped on load.
  it("applies the rules on load and keeps the original before the first save", () => {
    const storage = new MemoryStorage();
    const original = JSON.stringify({
      nodes: [card("a"), card("b")],
      edges: [edge("ok", "a", "b"), edge("bad", "a", "deleted")],
    });
    storage.setItem(STORAGE_KEY, original);
    const loaded = readDiagram(storage);
    expect(loaded).toMatchObject({ status: "loaded", backup: BACKUP_KEY, kept: true, dropped: { edges: 1 } });
    expect(loaded.status === "loaded" && loaded.diagram.edges.map((e) => e.id)).toEqual(["ok"]);
    expect(storage.getItem(BACKUP_KEY)).toBe(original);
    // No room for the copy: the editor must not save over the original.
    const full = new MemoryStorage(original.length + STORAGE_KEY.length + 10);
    full.setItem(STORAGE_KEY, original);
    expect(readDiagram(full)).toMatchObject({ status: "loaded", backup: null, kept: false });
  });

  it("never writes over a diagram saved by a newer version", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 9, nodes: [] }));
    expect(writeDiagram(storage, serialize({ nodes: [card("a")], edges: [] }))).toBe(false);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(9);
  });

  it("reports a full or blocked storage instead of throwing", () => {
    expect(writeDiagram(new MemoryStorage(10), serialize({ nodes: [card("a")], edges: [] }))).toBe(false);
  });
});
