// Project stages and the CSV export of the estimate (#84).
import { describe, expect, it } from "vitest";
import { applyActions, planOps, snapshot } from "@/lib/ai/diagram";
import { csvCell, toCsv } from "@/lib/diagram/csv";
import { estimateCsv, groupTotal, projectEstimate, stageHours } from "@/lib/diagram/estimate";
import { parseFile, serializeFile } from "@/lib/diagram/file";
import { MAX_ESTIMATE, MAX_PERCENT, MAX_STAGES, STORAGE_KEY, type Diagram, type Stage } from "@/lib/diagram/model";
import { groupItems } from "@/lib/diagram/ops";
import { enforceRules, serialize } from "@/lib/diagram/rules";
import { readDiagram, writeDiagram } from "@/lib/diagram/storage";
import { createDiagramStore } from "@/lib/diagram/store";
import { card, MemoryStorage } from "./helpers";

const est = (id: string, hours: number | undefined, x = 0, header?: string) => {
  const c = card(id, x, 0);
  return { ...c, data: { ...c.data, ...(hours !== undefined && { estimate: hours }), ...(header && { headerText: header }) } };
};
const STAGES: Stage[] = [
  { label: "Design", percent: 25 },
  { label: "Project management", hours: 6 },
];
// A group of two cards (10 h), a card in none (6 h), an unestimated card; two stages.
function project(settings: Diagram["settings"] = { hourlyRate: 100, currency: "EUR", stages: STAGES }): Diagram {
  const d = groupItems(
    { nodes: [est("a", 4, 0, "Login"), est("b", 6, 300, "Sign up"), est("c", 6, 600, "Home"), est("d", undefined, 900, "Help")], edges: [] },
    ["a", "b"],
    { id: "auth", label: "Auth" }
  );
  return { ...d, settings };
}

describe("project stages", () => {
  it("add fixed hours, or a percentage of the cards' hours, to the project total; group totals stay cards only", () => {
    const d = project();
    expect(stageHours({ label: "QA", percent: 15 }, 20)).toBe(3);
    expect(stageHours({ label: "PM", hours: 6 }, 20)).toBe(6);
    const e = projectEstimate(d);
    expect(e.cards).toEqual({ hours: 16, estimated: 3, cards: 4 });
    expect(e.stages.map((s) => s.hours)).toEqual([4, 6]);
    expect(e.hours).toBe(26);
    expect(groupTotal(d.nodes, "auth").hours).toBe(10);
    expect(projectEstimate(project({})).hours).toBe(16);
  });

  it("are kept by the rules with a name and one valid amount, at most MAX_STAGES of them", () => {
    const s = (stages: unknown) => enforceRules({ nodes: [], edges: [], settings: { stages } }).diagram.settings?.stages;
    expect(s([{ label: "QA", percent: 15.555, extra: "<b>" }, { label: "PM", hours: 6 }])).toEqual([
      { label: "QA", percent: 15.56 },
      { label: "PM", hours: 6 },
    ]);
    // Hours win over a percentage; a bad amount falls back to the other one; neither drops the stage.
    expect(s([{ label: "A", hours: 2, percent: 10 }, { label: "B", hours: -1, percent: 10 }, { label: "C", hours: "2" }])).toEqual([
      { label: "A", hours: 2 },
      { label: "B", percent: 10 },
    ]);
    expect(s([{ hours: MAX_ESTIMATE + 1 }, { percent: MAX_PERCENT + 1 }, null, "QA"])).toBeUndefined();
    expect(s([{ hours: 1 }])).toEqual([{ label: "", hours: 1 }]);
    expect(s([{ label: "x".repeat(500), hours: 1 }])![0].label).toHaveLength(200);
    expect(s(Array.from({ length: MAX_STAGES + 5 }, () => ({ label: "S", hours: 1 })))).toHaveLength(MAX_STAGES);
    expect(s([])).toBeUndefined();
    expect(s({ label: "QA", hours: 1 })).toBeUndefined();
  });

  it("are one undo step each and survive changes to the cards", () => {
    const store = createDiagramStore({ initial: project({ hourlyRate: 100 }), save: () => true });
    store.setSettings({ stages: [{ label: "QA", percent: 10 }] });
    store.setSettings({ stages: [{ label: "QA", percent: 10 }, { label: "PM", hours: 4 }] });
    store.setEstimate("d", 4);
    store.removeSelected();
    store.apply((d) => ({ nodes: d.nodes.filter((n) => n.id !== "c"), edges: d.edges }));
    expect(store.diagram().settings).toEqual({ hourlyRate: 100, stages: [{ label: "QA", percent: 10 }, { label: "PM", hours: 4 }] });
    store.undo();
    store.undo();
    store.undo();
    expect(store.getState().settings?.stages).toEqual([{ label: "QA", percent: 10 }]);
    store.undo();
    expect(store.getState().settings).toEqual({ hourlyRate: 100 });
    store.redo();
    expect(store.getState().settings?.stages).toHaveLength(1);
    store.setSettings({ stages: undefined });
    expect(store.getState().settings).toEqual({ hourlyRate: 100 });
  });

  it("are saved as version 4, so an editor that knows version 3 (and would drop them) doesn't save over them", () => {
    const storage = new MemoryStorage();
    expect(writeDiagram(storage, serialize(project()))).toBe(true);
    const stored = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(stored.version).toBe(4);
    expect(stored.settings.stages).toEqual(STAGES);
    expect(readDiagram(storage)).toMatchObject({ status: "loaded", diagram: { settings: { stages: STAGES } } });
    // A version 3 diagram opens unchanged.
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...project({ hourlyRate: 90 }), version: 3 }));
    expect(readDiagram(storage)).toMatchObject({ status: "loaded", diagram: { settings: { hourlyRate: 90 } } });
  });

  it("are in the file (version 4), and version 3 files still open", () => {
    const d = project();
    const file = JSON.parse(serializeFile(d));
    expect(file.version).toBe(4);
    expect(file.diagram.settings.stages).toEqual(STAGES);
    expect(serialize(parseFile(JSON.stringify(file)).diagram)).toBe(serialize(d));
    const v3 = { format: "wireflow", version: 3, diagram: { ...project({ hourlyRate: 90 }) } };
    expect(parseFile(JSON.stringify(v3)).diagram.settings).toEqual({ hourlyRate: 90 });
  });

  it("are shown to the AI, which keeps them through its edits", () => {
    const d = project();
    expect(snapshot({ data: d }).stages).toEqual(STAGES);
    expect(snapshot({ data: project({ hourlyRate: 1 }) })).not.toHaveProperty("stages");
    const store = createDiagramStore({ initial: d, save: () => true });
    const plan = planOps({ summary: "", operations: [{ op: "update_screen", id: "c", label: "Feed" }] }, store.diagram());
    if (plan.errors) throw new Error(JSON.stringify(plan.errors));
    store.apply((x) => applyActions(x, plan.actions));
    expect(store.diagram().settings?.stages).toEqual(STAGES);
  });
});

describe("the estimate as CSV", () => {
  it("quotes text (doubling quotes) and writes numbers as numbers, with CRLF line ends", () => {
    expect(csvCell('Say "hi", then\nleave')).toBe('"Say ""hi"", then\nleave"');
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(null)).toBe("");
    expect(csvCell(NaN)).toBe("");
    expect(toCsv([["a", 1], [null, "b"]])).toBe('"a",1\r\n,"b"\r\n');
  });

  it("makes text a spreadsheet would run as a formula plain text", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1", "-2+3", "@SUM(A1)", "\t=1", "\r=1"]) {
      expect(csvCell(evil)).toBe(`"'${evil.replace(/"/g, '""')}"`);
    }
    // Only at the start; numbers the app writes are never touched.
    expect(csvCell("Sign-up = 2 steps")).toBe('"Sign-up = 2 steps"');
    expect(csvCell(-3)).toBe("-3");
  });

  it("lists every card, group, the subtotal, the stages and the total, with the rate and cost", () => {
    expect(estimateCsv(project()).split("\r\n")).toEqual([
      '"Type","Name","Group","Hours","Basis","Rate (EUR/h)","Cost (EUR)"',
      '"Card","Login","Auth",4,"",100,400',
      '"Card","Sign up","Auth",6,"",100,600',
      '"Card","Home","",6,"",100,600',
      '"Card","Help","",,"",100,',
      '"Group","Auth","",10,"2 of 2 cards estimated",100,1000',
      '"Subtotal","Cards","",16,"3 of 4 cards estimated",100,1600',
      '"Stage","Design","",4,"25% of card hours",100,400',
      '"Stage","Project management","",6,"Fixed hours",100,600',
      '"Total","Total","",26,"",100,2600',
      "",
    ]);
  });

  it("leaves out the rate and cost without a rate, names nested groups by their path, and escapes names", () => {
    let d: Diagram = { nodes: [est("a", 1.333, 0, "=cmd|' /C calc'!A0"), est("c", undefined, 300), est("b", 2, 600)], edges: [] };
    d = groupItems(d, ["a", "c"], { id: "inner", label: "Pay, \"now\"" });
    d = groupItems(d, ["inner", "b"], { id: "outer", label: "Checkout" });
    d = { ...d, settings: { stages: [{ label: "", percent: 10 }] } };
    const lines = estimateCsv(d).split("\r\n");
    expect(lines[0]).toBe('"Type","Name","Group","Hours","Basis"');
    expect(lines).toContain(`"Card","'=cmd|' /C calc'!A0","Checkout / Pay, ""now""",1.33,""`);
    expect(lines).toContain('"Group","Pay, ""now""","Checkout",1.33,"1 of 2 cards estimated"');
    expect(lines).toContain('"Stage","Stage","",0.33,"10% of card hours"');
    expect(lines).toContain('"Total","Total","",3.67,""');
  });
});
