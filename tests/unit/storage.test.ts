import { describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '@/lib/diagram/model';
import { serialize } from '@/lib/diagram/rules';
import { backup, BACKUP_KEY, HISTORY_KEY, migrate, readDiagram, readHistory, writeDiagram, writeHistory } from '@/lib/diagram/storage';
import { createHistory, record } from '@/lib/diagram/history';
import { card, edge, MemoryStorage, PRODUCTION_SAMPLE } from './helpers';

describe('autosave storage', () => {
  it('reads production data (version 1, no version field) unchanged', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(PRODUCTION_SAMPLE));
    const loaded = readDiagram(storage);
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;
    expect(loaded.diagram.nodes.map((n) => n.data)).toEqual(PRODUCTION_SAMPLE.nodes.map((n) => n.data));
    expect(loaded.diagram.nodes.map((n) => n.position)).toEqual(PRODUCTION_SAMPLE.nodes.map((n) => n.position));
    expect(loaded.diagram.edges).toEqual(PRODUCTION_SAMPLE.edges);
    // Reading writes nothing.
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(PRODUCTION_SAMPLE));
  });

  it('writes the same key with a version, in a shape production still reads', () => {
    const storage = new MemoryStorage();
    expect(writeDiagram(storage, serialize({ nodes: [card('a')], edges: [] }))).toBe(true);
    const stored = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(stored.version).toBe(2);
    // Production's loader: saved?.nodes?.length, then nodes/edges as React Flow data.
    expect(stored.nodes[0]).toMatchObject({ id: 'a', type: 'flow', position: { x: 0, y: 0 }, data: { graphicId: 'article-article-1', src: '/graphics/article/article-1.svg' } });
    expect(stored.edges).toEqual([]);
  });

  it('migrates by version and refuses what is not a diagram', () => {
    expect(migrate({ nodes: [], edges: [] })).toEqual({ version: 1, data: { nodes: [], edges: [] } });
    expect(migrate({ version: 2, nodes: [] })?.version).toBe(2);
    for (const bad of [null, [], 'x', { edges: [] }, { version: 0, nodes: [] }, { version: '2', nodes: [] }]) expect(migrate(bad)).toBeNull();
  });

  it('keeps unreadable data in a backup key instead of losing it', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{"nodes": [tr');
    expect(readDiagram(storage).status).toBe('unreadable');
    expect(storage.getItem(BACKUP_KEY)).toBe('{"nodes": [tr');
    // A second unreadable load doesn't overwrite the first backup.
    storage.setItem(STORAGE_KEY, 'other');
    readDiagram(storage);
    expect(storage.getItem(BACKUP_KEY)).toBe('{"nodes": [tr');
  });

  it('reports data from a newer version so it is not overwritten', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, nodes: [card('a')], edges: [], future: true }));
    const loaded = readDiagram(storage);
    expect(loaded.status).toBe('newer');
  });

  it('applies the rules on load: a dangling edge saved by an older build is dropped', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ nodes: [card('a'), card('b')], edges: [edge('ok', 'a', 'b'), edge('bad', 'a', 'deleted')] }));
    const loaded = readDiagram(storage);
    expect(loaded.status === 'loaded' && loaded.diagram.edges.map((e) => e.id)).toEqual(['ok']);
    expect(loaded.status === 'loaded' && loaded.dropped.edges).toBe(1);
  });

  // Review findings: newer data with another shape, repeated unreadable data,
  // dropped items and saves over a newer version all used to lose data.
  it('recognises a newer version before looking at its shape', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, nodes: { a: card('a') }, links: [] }));
    expect(readDiagram(storage)).toEqual({ status: 'newer', diagram: { nodes: [], edges: [] } });
  });

  it('keeps every unreadable version, not just the first', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, 'first');
    expect(readDiagram(storage)).toEqual({ status: 'unreadable', backup: BACKUP_KEY });
    storage.setItem(STORAGE_KEY, 'second');
    const second = readDiagram(storage);
    expect(second.status === 'unreadable' && second.backup).toMatch(new RegExp(`^${BACKUP_KEY.replace('.', '\\.')}\\.\\d+$`));
    expect(storage.getItem(BACKUP_KEY)).toBe('first');
    expect(storage.getItem((second as { backup: string }).backup)).toBe('second');
    expect(backup(new MemoryStorage(3), 'too long')).toBeNull();
  });

  it('keeps the original before the first save when the rules dropped something', () => {
    const storage = new MemoryStorage();
    const original = JSON.stringify({ nodes: [card('a'), { ...card('b'), data: { graphicId: 'gone-template' } }], edges: [] });
    storage.setItem(STORAGE_KEY, original);
    const loaded = readDiagram(storage);
    expect(loaded).toMatchObject({ status: 'loaded', backup: BACKUP_KEY, kept: true, dropped: { nodes: 1 } });
    expect(storage.getItem(BACKUP_KEY)).toBe(original);
    // A clean diagram needs no copy.
    storage.setItem(STORAGE_KEY, JSON.stringify({ nodes: [card('a')], edges: [] }));
    expect(readDiagram(storage)).toMatchObject({ backup: null, kept: true });
    // No room for the copy: the editor must not save over the original.
    const full = new MemoryStorage(original.length + STORAGE_KEY.length + 10);
    full.setItem(STORAGE_KEY, original);
    expect(readDiagram(full)).toMatchObject({ status: 'loaded', backup: null, kept: false });
  });

  it('never writes over a diagram saved by a newer version', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 9, nodes: [] }));
    expect(writeDiagram(storage, serialize({ nodes: [card('a')], edges: [] }))).toBe(false);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(9);
  });

  it('reports a full or blocked storage instead of throwing', () => {
    expect(writeDiagram(new MemoryStorage(10), serialize({ nodes: [card('a')], edges: [] }))).toBe(false);
  });

  it('keeps as much undo history as fits, and reads only well-formed history', () => {
    let h = createHistory('{"nodes":[],"edges":[]}');
    for (let i = 0; i < 20; i++) h = record(h, serialize({ nodes: [card(`n${i}`, i * 10, 0)], edges: [] }));
    const roomy = new MemoryStorage();
    writeHistory(roomy, h);
    expect(readHistory(roomy)?.past).toHaveLength(20);
    const tight = new MemoryStorage(1000);
    writeHistory(tight, h);
    const kept = readHistory(tight);
    expect(kept?.present).toEqual(h.present);
    expect(kept!.past.length).toBeLessThan(20);
    const broken = new MemoryStorage();
    broken.setItem(HISTORY_KEY, '{"past":[1],"present":{},"future":[]}');
    expect(readHistory(broken)).toBeNull();
    // Steps go through the rules (a session history may come from an older build).
    const dirty = new MemoryStorage();
    const step = (id: number, json: string) => ({ id, json });
    dirty.setItem(HISTORY_KEY, JSON.stringify({ past: [step(1, JSON.stringify({ nodes: [card('a'), card('b')], edges: [edge('x', 'a', 'gone')] }))], present: step(2, serialize({ nodes: [], edges: [] })), future: [] }));
    expect(JSON.parse(readHistory(dirty)!.past[0].json).edges).toEqual([]);
    dirty.setItem(HISTORY_KEY, JSON.stringify({ past: [step(1, 'not json')], present: step(2, '{}'), future: [] }));
    expect(readHistory(dirty)).toBeNull();
  });
});
