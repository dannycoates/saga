import { describe, it, expect } from "vitest";
import { limitNumber } from "../../src/core/utils.js";

describe("Utils", () => {
  describe("limitNumber", () => {
    it("should limit number within range", () => {
      expect(limitNumber(5, 0, 10)).toBe(5);
      expect(limitNumber(-5, 0, 10)).toBe(0);
      expect(limitNumber(15, 0, 10)).toBe(10);
    });
  });
});
