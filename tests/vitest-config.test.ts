import { describe, expect, it } from "vitest";
import config from "../vitest.config";

describe("vitest config", () => {
  it("does not discover tests copied into release artifacts", () => {
    const testConfig = "test" in config ? config.test : undefined;

    expect(testConfig?.exclude).toEqual(
      expect.arrayContaining(["dist/**", "**/dist/**", "**/release-*/**"]),
    );
  });
});
