import { describe, it, expect } from "vitest";
import {
  limitNumber,
  epsilonEquals,
} from "../../src/core/utils.js";

describe("Utils", () => {
  describe("limitNumber", () => {
    it("should limit number within range", () => {
      expect(limitNumber(5, 0, 10)).toBe(5);
      expect(limitNumber(-5, 0, 10)).toBe(0);
      expect(limitNumber(15, 0, 10)).toBe(10);
    });
  });

  describe("epsilonEquals", () => {
    it("should compare numbers with epsilon tolerance", () => {
      expect(epsilonEquals(1.0, 1.0)).toBe(true);
      // Test with a difference definitely greater than epsilon
      expect(epsilonEquals(1.0, 1.00000002)).toBe(false);
      // Test with a difference definitely less than epsilon
      expect(epsilonEquals(1.0, 1.000000005)).toBe(true);
      // Another test with clear difference
      expect(epsilonEquals(1.0, 1.0001)).toBe(false);
    });
  });

});
