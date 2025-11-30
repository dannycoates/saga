import { describe, it, expect, beforeEach, vi } from "vitest";
import { RuntimeManager } from "../../src/runtimes/RuntimeManager.js";

describe("RuntimeManager", () => {
  let manager;

  beforeEach(() => {
    manager = new RuntimeManager();
    // Mock python and java runtimes to avoid loading Pyodide/CheerpJ
    vi.spyOn(manager.runtimes.python, "loadRuntime").mockImplementation(
      async () => {
        manager.runtimes.python.isLoaded = true;
      },
    );
    vi.spyOn(manager.runtimes.java, "loadRuntime").mockImplementation(
      async () => {
        manager.runtimes.java.isLoaded = true;
      },
    );
  });

  describe("constructor", () => {
    it("should create all runtime instances", () => {
      expect(manager.runtimes.javascript).toBeDefined();
      expect(manager.runtimes.python).toBeDefined();
      expect(manager.runtimes.java).toBeDefined();
    });

    it("should default to javascript language", () => {
      expect(manager.currentLanguage).toBe("javascript");
    });

    it("should start with empty loading promises", () => {
      expect(manager.loadingPromises).toEqual({});
    });
  });

  describe("defaultTemplates", () => {
    it("should return templates for all languages", () => {
      const templates = manager.defaultTemplates;

      expect(templates.javascript).toBeDefined();
      expect(templates.python).toBeDefined();
      expect(templates.java).toBeDefined();
    });

    it("should return non-empty templates", () => {
      const templates = manager.defaultTemplates;

      expect(templates.javascript.length).toBeGreaterThan(0);
      expect(templates.python.length).toBeGreaterThan(0);
      expect(templates.java.length).toBeGreaterThan(0);
    });

    it("should contain tick function in templates", () => {
      const templates = manager.defaultTemplates;

      expect(templates.javascript).toContain("tick");
      expect(templates.python).toContain("tick");
      expect(templates.java).toContain("tick");
    });
  });

  describe("getCurrentRuntime", () => {
    it("should return javascript runtime by default", () => {
      const runtime = manager.getCurrentRuntime();
      expect(runtime).toBe(manager.runtimes.javascript);
    });

    it("should return correct runtime after language change", () => {
      manager.currentLanguage = "python";
      const runtime = manager.getCurrentRuntime();
      expect(runtime).toBe(manager.runtimes.python);
    });
  });

  describe("selectLanguage", () => {
    it("should set current language", async () => {
      await manager.selectLanguage("python");
      expect(manager.currentLanguage).toBe("python");
    });

    it("should throw for unsupported language", async () => {
      await expect(manager.selectLanguage("ruby")).rejects.toThrow(
        "Unsupported language: ruby",
      );
    });

    it("should return the selected runtime", async () => {
      const runtime = await manager.selectLanguage("javascript");
      expect(runtime).toBe(manager.runtimes.javascript);
    });
  });

  describe("loadCurrentRuntime", () => {
    it("should return already loaded javascript runtime", async () => {
      const runtime = await manager.loadCurrentRuntime();
      expect(runtime).toBe(manager.runtimes.javascript);
      expect(runtime.isLoaded).toBe(true);
    });

    it("should cache loading promises", async () => {
      // Force python to need loading
      manager.currentLanguage = "python";
      const pythonRuntime = manager.runtimes.python;

      // Mock loadRuntime to track calls
      const loadSpy = vi
        .spyOn(pythonRuntime, "loadRuntime")
        .mockResolvedValue();
      pythonRuntime.isLoaded = false;
      pythonRuntime.isLoading = false;

      // Call loadCurrentRuntime twice
      const promise1 = manager.loadCurrentRuntime();
      const promise2 = manager.loadCurrentRuntime();

      await Promise.all([promise1, promise2]);

      // Should only call loadRuntime once due to caching
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it("should not reload already loaded runtime", async () => {
      const jsRuntime = manager.runtimes.javascript;
      const loadSpy = vi.spyOn(jsRuntime, "loadRuntime");

      await manager.loadCurrentRuntime();

      expect(loadSpy).not.toHaveBeenCalled();
    });
  });

  describe("loadCode", () => {
    it("should load code into current runtime", async () => {
      const code = 'export function tick() { console.log("test"); }';
      const loadSpy = vi
        .spyOn(manager.runtimes.javascript, "loadCode")
        .mockResolvedValue();

      await manager.loadCode(code);

      expect(loadSpy).toHaveBeenCalledWith(code);
    });

    it("should ensure runtime is loaded before loading code", async () => {
      manager.currentLanguage = "python";
      const pythonRuntime = manager.runtimes.python;
      pythonRuntime.isLoaded = false;
      pythonRuntime.isLoading = false;

      const loadRuntimeSpy = vi
        .spyOn(pythonRuntime, "loadRuntime")
        .mockImplementation(async () => {
          pythonRuntime.isLoaded = true;
        });
      const loadCodeSpy = vi
        .spyOn(pythonRuntime, "loadCode")
        .mockResolvedValue();

      await manager.loadCode("def tick(): pass");

      expect(loadRuntimeSpy).toHaveBeenCalled();
      expect(loadCodeSpy).toHaveBeenCalled();
    });
  });

  describe("start", () => {
    it("should call start on current runtime", async () => {
      const startSpy = vi
        .spyOn(manager.runtimes.javascript, "start")
        .mockResolvedValue();

      await manager.start();

      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe("execute", () => {
    it("should execute with current runtime", async () => {
      const elevators = [{ currentFloor: 0, goToFloor: vi.fn() }];
      const floors = [{ level: 0, buttons: { up: false, down: false } }];

      const executeSpy = vi
        .spyOn(manager.runtimes.javascript, "execute")
        .mockResolvedValue();

      await manager.execute(elevators, floors);

      expect(executeSpy).toHaveBeenCalledWith(elevators, floors);
    });

    it("should return execution result", async () => {
      vi.spyOn(manager.runtimes.javascript, "execute").mockResolvedValue(
        "result",
      );

      const result = await manager.execute([], []);

      expect(result).toBe("result");
    });
  });

  describe("cleanup", () => {
    it("should cleanup all runtimes", () => {
      const jsCleanup = vi.spyOn(manager.runtimes.javascript, "cleanup");
      const pyCleanup = vi.spyOn(manager.runtimes.python, "cleanup");
      const javaCleanup = vi.spyOn(manager.runtimes.java, "cleanup");

      manager.cleanup();

      expect(jsCleanup).toHaveBeenCalled();
      expect(pyCleanup).toHaveBeenCalled();
      expect(javaCleanup).toHaveBeenCalled();
    });
  });

  describe("language switching", () => {
    it("should switch between languages correctly", async () => {
      expect(manager.currentLanguage).toBe("javascript");

      await manager.selectLanguage("python");
      expect(manager.currentLanguage).toBe("python");
      expect(manager.getCurrentRuntime()).toBe(manager.runtimes.python);

      await manager.selectLanguage("java");
      expect(manager.currentLanguage).toBe("java");
      expect(manager.getCurrentRuntime()).toBe(manager.runtimes.java);

      await manager.selectLanguage("javascript");
      expect(manager.currentLanguage).toBe("javascript");
      expect(manager.getCurrentRuntime()).toBe(manager.runtimes.javascript);
    });
  });
});
