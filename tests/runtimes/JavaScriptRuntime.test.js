import { describe, it, expect, beforeEach } from "vitest";
import { JavaScriptRuntime } from "../../src/runtimes/JavaScriptRuntime.js";

describe("JavaScriptRuntime", () => {
  let runtime;

  beforeEach(() => {
    runtime = new JavaScriptRuntime();
  });

  describe("constructor", () => {
    it("should initialize with language id", () => {
      expect(runtime.language).toBe("javascript");
    });

    it("should be loaded by default (native JS)", () => {
      expect(runtime.isLoaded).toBe(true);
    });

    it("should start with no loaded module", () => {
      expect(runtime.loadedModule).toBe(null);
    });
  });

  describe("loadRuntime", () => {
    it("should be a no-op (JS is native)", async () => {
      await runtime.loadRuntime();
      expect(runtime.isLoaded).toBe(true);
    });
  });

  describe("loadCode", () => {
    it("should load valid code with tick function", async () => {
      const code = "export function tick(elevators, floors) {}";

      await runtime.loadCode(code);

      expect(runtime.loadedModule).not.toBe(null);
      expect(typeof runtime.loadedModule.tick).toBe("function");
    });

    it("should throw if code doesn't export tick", async () => {
      const code = "export function notTick() {}";

      await expect(runtime.loadCode(code)).rejects.toThrow(
        "Code must export a tick function",
      );
    });

    it("should store loaded code", async () => {
      const code = "export function tick() {}";

      await runtime.loadCode(code);

      expect(runtime.loadedCode).toBe(code);
    });

    it("should handle code with multiple exports", async () => {
      const code = `
        export function tick() {}
        export function helper() {}
        export const value = 42;
      `;

      await runtime.loadCode(code);

      expect(runtime.loadedModule.tick).toBeDefined();
      expect(runtime.loadedModule.helper).toBeDefined();
      expect(runtime.loadedModule.value).toBe(42);
    });
  });

  describe("execute", () => {
    it("should throw if no code loaded", async () => {
      await expect(runtime.execute([], [])).rejects.toThrow(
        "No code loaded. Call loadCode() first.",
      );
    });

    it("should call tick with elevators and floors", async () => {
      let capturedElevators, capturedFloors;
      const code = `
        export function tick(elevators, floors) {
          globalThis.__testElevators = elevators;
          globalThis.__testFloors = floors;
        }
      `;

      await runtime.loadCode(code);

      const elevators = [{ currentFloor: 0 }];
      const floors = [{ level: 0 }];

      await runtime.execute(elevators, floors);

      expect(globalThis.__testElevators).toEqual(elevators);
      expect(globalThis.__testFloors).toEqual(floors);

      // Cleanup
      delete globalThis.__testElevators;
      delete globalThis.__testFloors;
    });

    it("should handle async tick functions", async () => {
      const code = `
        export async function tick(elevators, floors) {
          await Promise.resolve();
          return "done";
        }
      `;

      await runtime.loadCode(code);
      const result = await runtime.execute([], []);

      expect(result).toBe("done");
    });
  });

  describe("getDefaultTemplate", () => {
    it("should return non-empty template", () => {
      const template = runtime.getDefaultTemplate();

      expect(template.length).toBeGreaterThan(0);
    });

    it("should contain tick function", () => {
      const template = runtime.getDefaultTemplate();

      expect(template).toContain("export function tick");
    });

    it("should contain documentation comments", () => {
      const template = runtime.getDefaultTemplate();

      expect(template).toContain("@class Elevator");
      expect(template).toContain("@class Floor");
      expect(template).toContain("goToFloor");
    });

    it("should be valid JavaScript", async () => {
      const template = runtime.getDefaultTemplate();

      // Should load without error
      await runtime.loadCode(template);
      expect(runtime.loadedModule.tick).toBeDefined();
    });
  });

  describe("cleanup", () => {
    it("should clear loaded module", async () => {
      await runtime.loadCode("export function tick() {}");
      expect(runtime.loadedModule).not.toBe(null);

      runtime.cleanup();

      expect(runtime.loadedModule).toBe(null);
    });

    it("should clear loaded code", async () => {
      await runtime.loadCode("export function tick() {}");
      expect(runtime.loadedCode).not.toBe(null);

      runtime.cleanup();

      expect(runtime.loadedCode).toBe(null);
    });
  });

  describe("integration: elevator control", () => {
    it("should be able to control elevator", async () => {
      const code = `
        export function tick(elevators, floors) {
          const elevator = elevators[0];
          if (elevator.currentFloor === 0) {
            elevator.goToFloor(2);
          }
        }
      `;

      await runtime.loadCode(code);

      const goToFloorMock = { called: false, floor: null };
      const elevators = [
        {
          currentFloor: 0,
          goToFloor: (floor) => {
            goToFloorMock.called = true;
            goToFloorMock.floor = floor;
          },
        },
      ];
      const floors = [{ level: 0 }, { level: 1 }, { level: 2 }];

      await runtime.execute(elevators, floors);

      expect(goToFloorMock.called).toBe(true);
      expect(goToFloorMock.floor).toBe(2);
    });

    it("should handle reading floor buttons", async () => {
      const code = `
        export function tick(elevators, floors) {
          const floor = floors.find(f => f.buttons.up);
          if (floor) {
            elevators[0].goToFloor(floor.level);
          }
        }
      `;

      await runtime.loadCode(code);

      let targetFloor = null;
      const elevators = [
        {
          currentFloor: 0,
          goToFloor: (floor) => {
            targetFloor = floor;
          },
        },
      ];
      const floors = [
        { level: 0, buttons: { up: false, down: false } },
        { level: 1, buttons: { up: true, down: false } },
        { level: 2, buttons: { up: false, down: false } },
      ];

      await runtime.execute(elevators, floors);

      expect(targetFloor).toBe(1);
    });
  });
});
