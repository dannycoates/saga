import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RuntimeManager } from "../../src/runtimes/RuntimeManager.js";

// Mock the virtual runtime registry for testing
vi.mock("virtual:runtime-registry", () => {
  // Create mock runtime classes
  const createMockRuntimeClass = (language) => {
    return class MockRuntime {
      constructor() {
        this.language = language;
        this.isLoaded = language === "javascript"; // JS is always loaded
        this.isLoading = false;
        this.loadedCode = null;
      }
      async loadRuntime() {
        this.isLoaded = true;
      }
      async loadCode(code) {
        this.loadedCode = code;
      }
      async execute(elevators, floors) {
        return { elevators, floors };
      }
      async start() {}
      cleanup() {}
      getDefaultTemplate() {
        return `// ${language} template\nexport function tick(elevators, floors) {}`;
      }
    };
  };

  // Mock metadata matching the real runtime structure
  const runtimeRegistry = [
    { id: "javascript", displayName: "JavaScript", fileExtension: ".js" },
    { id: "python", displayName: "Python", fileExtension: ".py" },
    { id: "java", displayName: "Java", fileExtension: ".java" },
    { id: "zig", displayName: "Zig", fileExtension: ".zig" },
    { id: "tcl", displayName: "Tcl", fileExtension: ".tcl" },
  ];

  return {
    runtimeRegistry,
    getSupportedLanguages: () => runtimeRegistry.map((r) => r.id),
    getRuntimeInfo: (id) => runtimeRegistry.find((r) => r.id === id),
    isLanguageSupported: (id) => runtimeRegistry.some((r) => r.id === id),
    runtimeImports: {
      javascript: () =>
        Promise.resolve({
          default: createMockRuntimeClass("javascript"),
          editorConfig: {
            getLanguageExtension: () => Promise.resolve({}),
            getLinter: () => Promise.resolve(null),
          },
        }),
      python: () =>
        Promise.resolve({
          default: createMockRuntimeClass("python"),
          editorConfig: {
            getLanguageExtension: () => Promise.resolve({}),
            getLinter: () => Promise.resolve(null),
          },
        }),
      java: () =>
        Promise.resolve({
          default: createMockRuntimeClass("java"),
          editorConfig: {
            getLanguageExtension: () => Promise.resolve({}),
            getLinter: () => Promise.resolve(null),
          },
        }),
      zig: () =>
        Promise.resolve({
          default: createMockRuntimeClass("zig"),
          editorConfig: {
            getLanguageExtension: () => Promise.resolve({}),
            getLinter: () => Promise.resolve(null),
          },
        }),
      tcl: () =>
        Promise.resolve({
          default: createMockRuntimeClass("tcl"),
          editorConfig: {
            getLanguageExtension: () => Promise.resolve({}),
            getLinter: () => Promise.resolve(null),
          },
        }),
    },
  };
});

describe("RuntimeManager", () => {
  let manager;

  beforeEach(() => {
    manager = new RuntimeManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should start with empty runtimes Map", () => {
      expect(manager.runtimes).toBeInstanceOf(Map);
      expect(manager.runtimes.size).toBe(0);
    });

    it("should default to javascript language", () => {
      expect(manager.currentLanguage).toBe("javascript");
    });

    it("should start with empty loading promises", () => {
      expect(manager.moduleLoadingPromises).toBeInstanceOf(Map);
      expect(manager.moduleLoadingPromises.size).toBe(0);
      expect(manager.runtimeLoadingPromises).toBeInstanceOf(Map);
      expect(manager.runtimeLoadingPromises.size).toBe(0);
    });

    it("should start with empty loaded modules", () => {
      expect(manager.loadedModules).toBeInstanceOf(Map);
      expect(manager.loadedModules.size).toBe(0);
    });
  });

  describe("getDefaultTemplate", () => {
    it("should return template for javascript", async () => {
      const template = await manager.getDefaultTemplate("javascript");
      expect(template).toContain("tick");
    });

    it("should return template for python", async () => {
      const template = await manager.getDefaultTemplate("python");
      expect(template).toContain("tick");
    });

    it("should return template for java", async () => {
      const template = await manager.getDefaultTemplate("java");
      expect(template).toContain("tick");
    });
  });

  describe("getDefaultTemplates", () => {
    it("should return templates for all languages", async () => {
      const templates = await manager.getDefaultTemplates();

      expect(templates.javascript).toBeDefined();
      expect(templates.python).toBeDefined();
      expect(templates.java).toBeDefined();
      expect(templates.zig).toBeDefined();
      expect(templates.tcl).toBeDefined();
    });

    it("should return non-empty templates", async () => {
      const templates = await manager.getDefaultTemplates();

      expect(templates.javascript.length).toBeGreaterThan(0);
      expect(templates.python.length).toBeGreaterThan(0);
      expect(templates.java.length).toBeGreaterThan(0);
    });
  });

  describe("getCurrentRuntime", () => {
    it("should return null when no runtime is loaded", () => {
      const runtime = manager.getCurrentRuntime();
      expect(runtime).toBeNull();
    });

    it("should return runtime after it is loaded", async () => {
      await manager.getOrCreateRuntime("javascript");
      const runtime = manager.getCurrentRuntime();
      expect(runtime).toBeDefined();
      expect(runtime.language).toBe("javascript");
    });
  });

  describe("getCurrentRuntimeAsync", () => {
    it("should load and return javascript runtime by default", async () => {
      const runtime = await manager.getCurrentRuntimeAsync();
      expect(runtime).toBeDefined();
      expect(runtime.language).toBe("javascript");
    });

    it("should return correct runtime after language change", async () => {
      manager.currentLanguage = "python";
      const runtime = await manager.getCurrentRuntimeAsync();
      expect(runtime.language).toBe("python");
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
      expect(runtime).toBeDefined();
      expect(runtime.language).toBe("javascript");
    });
  });

  describe("loadRuntimeModule", () => {
    it("should load a runtime module", async () => {
      const module = await manager.loadRuntimeModule("javascript");
      expect(module).toBeDefined();
      expect(module.default).toBeDefined();
    });

    it("should cache loaded modules", async () => {
      const module1 = await manager.loadRuntimeModule("javascript");
      const module2 = await manager.loadRuntimeModule("javascript");
      expect(module1).toBe(module2);
    });

    it("should throw for unsupported language", async () => {
      await expect(manager.loadRuntimeModule("ruby")).rejects.toThrow(
        "Unsupported language: ruby",
      );
    });
  });

  describe("getOrCreateRuntime", () => {
    it("should create a runtime instance", async () => {
      const runtime = await manager.getOrCreateRuntime("javascript");
      expect(runtime).toBeDefined();
      expect(runtime.language).toBe("javascript");
    });

    it("should cache runtime instances", async () => {
      const runtime1 = await manager.getOrCreateRuntime("javascript");
      const runtime2 = await manager.getOrCreateRuntime("javascript");
      expect(runtime1).toBe(runtime2);
    });

    it("should create different instances for different languages", async () => {
      const jsRuntime = await manager.getOrCreateRuntime("javascript");
      const pyRuntime = await manager.getOrCreateRuntime("python");
      expect(jsRuntime).not.toBe(pyRuntime);
      expect(jsRuntime.language).toBe("javascript");
      expect(pyRuntime.language).toBe("python");
    });
  });

  describe("loadCurrentRuntime", () => {
    it("should load the current runtime", async () => {
      const runtime = await manager.loadCurrentRuntime();
      expect(runtime).toBeDefined();
      expect(runtime.isLoaded).toBe(true);
    });

    it("should cache loading promises for modules", async () => {
      // Call loadRuntimeModule twice concurrently
      const promise1 = manager.loadRuntimeModule("javascript");
      const promise2 = manager.loadRuntimeModule("javascript");

      const [module1, module2] = await Promise.all([promise1, promise2]);

      // Should return the same module
      expect(module1).toBe(module2);
    });
  });

  describe("loadCode", () => {
    it("should load code into current runtime", async () => {
      const code = 'export function tick() { console.log("test"); }';
      await manager.loadCode(code);

      const runtime = manager.getCurrentRuntime();
      expect(runtime.loadedCode).toBe(code);
    });
  });

  describe("start", () => {
    it("should call start on current runtime", async () => {
      await manager.loadCurrentRuntime();
      const runtime = manager.getCurrentRuntime();
      const startSpy = vi.spyOn(runtime, "start");

      await manager.start();

      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe("execute", () => {
    it("should execute with current runtime", async () => {
      const elevators = [{ currentFloor: 0, goToFloor: vi.fn() }];
      const floors = [{ level: 0, buttons: { up: false, down: false } }];

      await manager.loadCurrentRuntime();
      const result = await manager.execute(elevators, floors);

      expect(result).toEqual({ elevators, floors });
    });
  });

  describe("cleanup", () => {
    it("should cleanup all loaded runtimes", async () => {
      // Load multiple runtimes
      await manager.getOrCreateRuntime("javascript");
      await manager.getOrCreateRuntime("python");

      const jsRuntime = manager.runtimes.get("javascript");
      const pyRuntime = manager.runtimes.get("python");

      const jsCleanup = vi.spyOn(jsRuntime, "cleanup");
      const pyCleanup = vi.spyOn(pyRuntime, "cleanup");

      manager.cleanup();

      expect(jsCleanup).toHaveBeenCalled();
      expect(pyCleanup).toHaveBeenCalled();
    });
  });

  describe("language switching", () => {
    it("should switch between languages correctly", async () => {
      expect(manager.currentLanguage).toBe("javascript");

      await manager.selectLanguage("python");
      expect(manager.currentLanguage).toBe("python");
      expect((await manager.getCurrentRuntimeAsync()).language).toBe("python");

      await manager.selectLanguage("java");
      expect(manager.currentLanguage).toBe("java");
      expect((await manager.getCurrentRuntimeAsync()).language).toBe("java");

      await manager.selectLanguage("javascript");
      expect(manager.currentLanguage).toBe("javascript");
      expect((await manager.getCurrentRuntimeAsync()).language).toBe(
        "javascript",
      );
    });
  });
});
