import { describe, it, expect } from "vitest";
import { checkInstall } from "../health.js";

describe("checkInstall", () => {
  it("returns install info when playwright is available", async () => {
    const result = await checkInstall();
    // Playwright IS in our dependencies, so this should succeed
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("playwright_installed");
      expect(result.data).toHaveProperty("browser_binary");
    }
  });
});
