import { describe, expect, it } from "vitest";
import { analytics, DEFAULT_RYBBIT, rybbitScript } from "@/lib/env";

describe("analytics env vars", () => {
  it("loads nothing when nothing is set", () => {
    expect(analytics({})).toEqual({});
  });

  it("reads Rybbit and GA4 settings", () => {
    expect(
      analytics({
        NEXT_PUBLIC_RYBBIT_SRC: "https://stats.example.com/api/script.js",
        NEXT_PUBLIC_RYBBIT_SITE_ID: "3",
        NEXT_PUBLIC_GA_ID: "G-ABC123",
      })
    ).toEqual({
      rybbit: { src: "https://stats.example.com/api/script.js", siteId: "3", origin: "https://stats.example.com" },
      gaId: "G-ABC123",
    });
  });

  it("falls back to this site's own Rybbit property when none is configured", () => {
    expect(rybbitScript({})).toEqual(DEFAULT_RYBBIT);
    expect(rybbitScript({}).origin).toBe("https://rybbit-d367d4.automatio.run");
  });

  it("prefers a configured Rybbit property over the default", () => {
    expect(
      rybbitScript({ NEXT_PUBLIC_RYBBIT_SRC: "https://stats.example.com/api/script.js", NEXT_PUBLIC_RYBBIT_SITE_ID: "9" })
    ).toEqual({ src: "https://stats.example.com/api/script.js", siteId: "9", origin: "https://stats.example.com" });
  });

  it("refuses values that would be unsafe in the page", () => {
    expect(() => analytics({ NEXT_PUBLIC_GA_ID: "G-1');alert(1);('" })).toThrow(/G-ABC123/);
    expect(() =>
      analytics({ NEXT_PUBLIC_RYBBIT_SRC: "http://stats.example.com/s.js", NEXT_PUBLIC_RYBBIT_SITE_ID: "3" })
    ).toThrow(/https/);
    expect(() => analytics({ NEXT_PUBLIC_RYBBIT_SRC: "https://stats.example.com/s.js" })).toThrow(/SITE_ID/);
  });
});
