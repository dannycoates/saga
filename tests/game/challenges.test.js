import { describe, it, expect } from "vitest";
import {
  requirePassengerCountWithinTime,
  requirePassengerCountWithMaxWaitTime,
  requirePassengerCountWithinTimeWithMaxWaitTime,
  requirePassengerCountWithinMoves,
  requireDemo,
  challenges,
} from "../../src/game/challenges.js";

describe("challenge conditions", () => {
  describe("requirePassengerCountWithinTime", () => {
    const condition = requirePassengerCountWithinTime(10, 60);

    it("should return null when in progress", () => {
      expect(
        condition.evaluate({
          transportedCount: 5,
          elapsedTime: 30,
          transportedPerSec: 0,
          avgWaitTime: 0,
          maxWaitTime: 0,
          moveCount: 0,
        }),
      ).toBe(null);
    });

    it("should return true when passenger count met within time", () => {
      expect(
        condition.evaluate({
          transportedCount: 10,
          elapsedTime: 55,
          transportedPerSec: 0,
          avgWaitTime: 0,
          maxWaitTime: 0,
          moveCount: 0,
        }),
      ).toBe(true);
    });

    it("should return true at exact boundary", () => {
      expect(
        condition.evaluate({
          transportedCount: 10,
          elapsedTime: 60,
          transportedPerSec: 0,
          avgWaitTime: 0,
          maxWaitTime: 0,
          moveCount: 0,
        }),
      ).toBe(true);
    });

    it("should return false when time exceeded without enough passengers", () => {
      expect(
        condition.evaluate({
          transportedCount: 5,
          elapsedTime: 61,
          transportedPerSec: 0,
          avgWaitTime: 0,
          maxWaitTime: 0,
          moveCount: 0,
        }),
      ).toBe(false);
    });

    it("should include description with passenger count and time", () => {
      expect(condition.description).toContain("10");
      expect(condition.description).toContain("60");
    });
  });

  describe("requirePassengerCountWithMaxWaitTime", () => {
    const condition = requirePassengerCountWithMaxWaitTime(50, 21);

    it("should return null when in progress", () => {
      expect(
        condition.evaluate({
          transportedCount: 10,
          elapsedTime: 30,
          transportedPerSec: 0,
          avgWaitTime: 5,
          maxWaitTime: 10,
          moveCount: 0,
        }),
      ).toBe(null);
    });

    it("should return true when passenger count met within wait limit", () => {
      expect(
        condition.evaluate({
          transportedCount: 50,
          elapsedTime: 100,
          transportedPerSec: 0,
          avgWaitTime: 5,
          maxWaitTime: 15,
          moveCount: 0,
        }),
      ).toBe(true);
    });

    it("should return false when max wait time exceeded", () => {
      expect(
        condition.evaluate({
          transportedCount: 5,
          elapsedTime: 30,
          transportedPerSec: 0,
          avgWaitTime: 15,
          maxWaitTime: 22,
          moveCount: 0,
        }),
      ).toBe(false);
    });

    it("should return false when both triggered but wait exceeded", () => {
      expect(
        condition.evaluate({
          transportedCount: 50,
          elapsedTime: 100,
          transportedPerSec: 0,
          avgWaitTime: 15,
          maxWaitTime: 25,
          moveCount: 0,
        }),
      ).toBe(false);
    });
  });

  describe("requirePassengerCountWithinTimeWithMaxWaitTime", () => {
    const condition = requirePassengerCountWithinTimeWithMaxWaitTime(
      100,
      120,
      30,
    );

    it("should return null when in progress", () => {
      expect(
        condition.evaluate({
          transportedCount: 50,
          elapsedTime: 60,
          transportedPerSec: 0,
          avgWaitTime: 5,
          maxWaitTime: 10,
          moveCount: 0,
        }),
      ).toBe(null);
    });

    it("should return true when all conditions met", () => {
      expect(
        condition.evaluate({
          transportedCount: 100,
          elapsedTime: 110,
          transportedPerSec: 0,
          avgWaitTime: 5,
          maxWaitTime: 20,
          moveCount: 0,
        }),
      ).toBe(true);
    });

    it("should return false when time exceeded", () => {
      expect(
        condition.evaluate({
          transportedCount: 50,
          elapsedTime: 121,
          transportedPerSec: 0,
          avgWaitTime: 5,
          maxWaitTime: 10,
          moveCount: 0,
        }),
      ).toBe(false);
    });

    it("should return false when wait time exceeded", () => {
      expect(
        condition.evaluate({
          transportedCount: 50,
          elapsedTime: 60,
          transportedPerSec: 0,
          avgWaitTime: 15,
          maxWaitTime: 31,
          moveCount: 0,
        }),
      ).toBe(false);
    });
  });

  describe("requirePassengerCountWithinMoves", () => {
    const condition = requirePassengerCountWithinMoves(20, 50);

    it("should return null when in progress", () => {
      expect(
        condition.evaluate({
          transportedCount: 10,
          elapsedTime: 30,
          transportedPerSec: 0,
          avgWaitTime: 0,
          maxWaitTime: 0,
          moveCount: 25,
        }),
      ).toBe(null);
    });

    it("should return true when passengers met within move limit", () => {
      expect(
        condition.evaluate({
          transportedCount: 20,
          elapsedTime: 30,
          transportedPerSec: 0,
          avgWaitTime: 0,
          maxWaitTime: 0,
          moveCount: 40,
        }),
      ).toBe(true);
    });

    it("should return false when moves exceeded without enough passengers", () => {
      expect(
        condition.evaluate({
          transportedCount: 10,
          elapsedTime: 30,
          transportedPerSec: 0,
          avgWaitTime: 0,
          maxWaitTime: 0,
          moveCount: 51,
        }),
      ).toBe(false);
    });
  });

  describe("requireDemo", () => {
    const condition = requireDemo();

    it("should always return null", () => {
      expect(
        condition.evaluate({
          transportedCount: 1000,
          elapsedTime: 9999,
          transportedPerSec: 100,
          avgWaitTime: 50,
          maxWaitTime: 100,
          moveCount: 5000,
        }),
      ).toBe(null);
    });
  });

  describe("challenges array", () => {
    it("should have 16 challenges", () => {
      expect(challenges).toHaveLength(16);
    });

    it("should have valid options for each challenge", () => {
      challenges.forEach((challenge, i) => {
        expect(challenge.options).toBeDefined();
        expect(challenge.options.floorCount).toBeGreaterThan(0);
        expect(challenge.options.elevatorCount).toBeGreaterThan(0);
        expect(challenge.options.spawnRate).toBeGreaterThan(0);
        expect(challenge.condition).toBeDefined();
        expect(typeof challenge.condition.evaluate).toBe("function");
        expect(typeof challenge.condition.description).toBe("string");
      });
    });

    it("should have the last challenge as a demo", () => {
      const last = challenges[challenges.length - 1];
      expect(last.condition.evaluate(/** @type {any} */ ({}))).toBe(null);
    });
  });
});
