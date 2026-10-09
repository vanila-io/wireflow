import { describe, expect, it } from "vitest";
import { currentImg, templateKey, templateKeys, templateUrl } from "../../utils/templates";

describe("templates", () => {
    it("should key every template by its folder and file name", () => {
        expect(templateKeys()).toHaveLength(102);
        expect(templateKeys()).toContain("E-Commerce/Cart");
        expect(templateKeys()).toContain("Sign in/Sign in 1");
        expect(templateUrl("E-Commerce/Cart")).toMatch(/Cart\.svg$/);
        expect(templateUrl("E-Commerce/Nope")).toBeUndefined();
    });

    it("should have unique file names, so URLs of older builds map to one template", () => {
        const names = templateKeys().map((key) => key.split("/")[1]);
        expect(new Set(names).size).toBe(names.length);
    });

    it("should map this build's URLs back to their key", () => {
        for (const key of templateKeys()) {
            expect(templateUrl(templateKey(templateUrl(key)))).toBe(templateUrl(key));
        }
        expect(templateKey(templateUrl("Misc/Error"))).toBe("Misc/Error");
    });

    it("should recognise template URLs of the Create React App and older Vite builds", () => {
        expect(templateKey("/static/media/Cart.2ae03932.svg")).toBe("E-Commerce/Cart");
        expect(templateKey("/static/media/Sign in 1.a1b484ff.svg")).toBe("Sign in/Sign in 1");
        expect(templateKey("/assets/Cart%20Popup-BfX1a_b3.svg")).toBe("E-Commerce/Cart Popup");
        expect(templateKey("https://wireflow.co/assets/Products%201-C-x9Lq2Z.svg")).toBe("E-Commerce/Products 1");
    });

    it("should not treat other images as templates", () => {
        expect(templateKey(undefined)).toBeUndefined();
        expect(templateKey(42)).toBeUndefined();
        expect(templateKey("https://example.com/photo.png")).toBeUndefined();
        expect(templateKey("/assets/Unknown-AbCdEfGh.svg")).toBeUndefined();
        expect(templateKey("/assets/%E0%A4%A-AbCdEfGh.svg")).toBeUndefined(); // malformed escape
    });

    it("should re-point old template URLs at this build and keep anything else", () => {
        expect(currentImg("/static/media/Cart.2ae03932.svg")).toBe(templateUrl("E-Commerce/Cart"));
        expect(currentImg(templateUrl("Misc/Steps"))).toBe(templateUrl("Misc/Steps"));
        expect(currentImg("https://example.com/photo.png")).toBe("https://example.com/photo.png");
    });
});
