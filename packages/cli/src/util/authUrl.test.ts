import { afterEach, describe, expect, it } from "vitest";
import { resolveAuthUrl } from "./authUrl.js";

describe("resolveAuthUrl", () => {
  afterEach(() => {
    delete process.env.KURUMERA_AUTH_URL;
  });

  // ── #23 default is the public origin ────────────────────────────────────
  it("defaults to the public kurumera.com origin", () => {
    expect(resolveAuthUrl()).toBe("https://kurumera.com/api/v1");
  });

  // ── #22 KURUMERA_AUTH_URL respected ─────────────────────────────────────
  it("respects KURUMERA_AUTH_URL when set", () => {
    process.env.KURUMERA_AUTH_URL = "https://staging.example.com/api/v1";
    expect(resolveAuthUrl()).toBe("https://staging.example.com/api/v1");
  });

  it("an explicit value (e.g. --auth-url) wins over KURUMERA_AUTH_URL", () => {
    process.env.KURUMERA_AUTH_URL = "https://staging.example.com/api/v1";
    expect(resolveAuthUrl("https://explicit.example.com/api/v1")).toBe("https://explicit.example.com/api/v1");
  });

  // ── #21 never inherits config.apiUrl — proven at the type level: the
  // function does not even accept a config/apiUrl argument, so there is no
  // way for a caller to make it fall back to the commerce API base. ────────
  it("has no parameter for a commerce/config API URL fallback", () => {
    expect(resolveAuthUrl.length).toBe(1); // only `explicit?: string`
  });
});
