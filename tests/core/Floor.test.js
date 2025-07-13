import { describe, it, expect, beforeEach } from "vitest";
import { Floor } from "../../src/core/Floor.js";

describe("Floor class", () => {
  describe("Floor model", () => {
    let floor;

    beforeEach(() => {
      floor = new Floor(3);
    });

    it("initializes with correct properties", () => {
      expect(floor.level).toBe(3);
      expect(floor.buttons.up).toBe(false);
      expect(floor.buttons.down).toBe(false);
    });

    it("can set button states", () => {
      floor.buttons.up = true;
      expect(floor.buttons.up).toBe(true);
      expect(floor.buttons.down).toBe(false);

      floor.buttons.down = true;
      expect(floor.buttons.down).toBe(true);
    });
  });
});
