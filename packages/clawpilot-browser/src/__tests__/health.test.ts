import { describe, it, expect } from "vitest";
import { checkInstall, checkSession, getStateDir } from "../health.js";

describe("checkSession", () => {
  it("returns session_exists:false when state dir does not exist", async () => {
    const result = await checkSession("/tmp/clawpilot-test-nonexistent-" + Date.now());
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.session_exists).toBe(false);
      expect(result.data.session_valid).toBe(false);
    }
  });

  it("returns session_exists:false when state dir is empty", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(`${tmpdir()}/clawpilot-test-`);
    try {
      const result = await checkSession(dir);
      expect(result.ok).toBe(true);
      if (result.ok && result.data) {
        expect(result.data.session_exists).toBe(false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns session_exists:true when state dir has files", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(`${tmpdir()}/clawpilot-test-`);
    writeFileSync(join(dir, "cookie-data"), "test");
    try {
      const result = await checkSession(dir);
      expect(result.ok).toBe(true);
      if (result.ok && result.data) {
        expect(result.data.session_exists).toBe(true);
        expect(result.data.session_age_hours).toBeTypeOf("number");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

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
