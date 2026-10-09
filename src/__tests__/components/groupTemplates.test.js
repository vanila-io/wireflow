import { describe, expect, it } from "vitest";
import nodes from "../../components/FlowItemPanel/nodesData";
import { groupTemplates } from "../../components/FlowItemPanel/groupTemplates";

const CATEGORIES = ["Article", "Blog", "E-Commerce", "Features", "Gallery", "Header", "Misc", "Multimedia", "Sign in", "Socials"];

describe("nodesData", () => {
    it("should file every template under the asset folder its image comes from", () => {
        for (const { img, category } of nodes) {
            expect(decodeURIComponent(img)).toContain(`/assets/images/${category}/`);
        }
    });
});

describe("groupTemplates", () => {
    it("should group every template by category, in the order categories first appear", () => {
        const groups = groupTemplates(nodes);

        expect(groups.map((group) => group.category)).toEqual(CATEGORIES);
        expect(groups.flatMap((group) => group.items)).toEqual(nodes);
    });

    it("should keep only templates whose label matches the keyword and drop empty categories", () => {
        const groups = groupTemplates(nodes, "cart");

        expect(groups.map((group) => group.category)).toEqual(["E-Commerce"]);
        expect(groups[0].items.map((item) => item.label)).toEqual(["Cart pop up", "Cart"]);
    });

    it("should keep a whole category when its name matches the keyword, ignoring case and surrounding spaces", () => {
        const groups = groupTemplates(nodes, "  MULTIMEDIA ");

        expect(groups.map((group) => group.category)).toEqual(["Multimedia"]);
        expect(groups[0].items).toEqual(nodes.filter((node) => node.category === "Multimedia"));
    });

    it("should return every template for a blank keyword and nothing when no template matches", () => {
        expect(groupTemplates(nodes, "   ")).toEqual(groupTemplates(nodes));
        expect(groupTemplates(nodes, "no such template")).toEqual([]);
    });
});
