import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../src/utils/EventBus.js";
import { APP_CONSTANTS } from "../../src/config/constants.js";

// Create mock functions for presenters
const mockPresentCodeStatus = vi.fn();
const mockPresentFeedback = vi.fn();
const mockPresentPassenger = vi.fn();
const mockPresentStats = vi.fn();
const mockPresentWorld = vi.fn();

// Mock presenters
vi.mock("../../src/ui/presenters.js", () => ({
  presentCodeStatus: (...args) => mockPresentCodeStatus(...args),
  presentFeedback: (...args) => mockPresentFeedback(...args),
  presentPassenger: (...args) => mockPresentPassenger(...args),
  presentStats: (...args) => mockPresentStats(...args),
  presentWorld: (...args) => mockPresentWorld(...args),
}));

// Create mock ViewModelManager instance
const mockViewModelManagerInstance = {
  cleanup: vi.fn(),
};

// Mock ViewModelManager
vi.mock("../../src/ui/ViewModelManager.js", () => ({
  ViewModelManager: {
    create: vi.fn(() => ({ ...mockViewModelManagerInstance, cleanup: vi.fn() })),
  },
}));

// Create mock ResponsiveScaling instance
const mockResponsiveScalingInstance = {
  initialize: vi.fn(),
  cleanup: vi.fn(),
};

// Mock ResponsiveScaling as a class
vi.mock("../../src/ui/ResponsiveScaling.js", () => ({
  ResponsiveScaling: class MockResponsiveScaling {
    constructor() {
      this.initialize = mockResponsiveScalingInstance.initialize;
      this.cleanup = mockResponsiveScalingInstance.cleanup;
    }
  },
}));

// Import after mocks are set up
import { AppEventHandlers } from "../../src/ui/AppEventHandlers.js";
import { ViewModelManager } from "../../src/ui/ViewModelManager.js";

// Mock DOM elements storage
let mockElements = {};

const createMockElement = (id) => {
  if (mockElements[id]) return mockElements[id];

  const element = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    querySelector: vi.fn().mockReturnValue({ textContent: "" }),
    getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, width: 800 }),
    classList: {
      toggle: vi.fn(),
    },
    style: {},
    value: "javascript",
    textContent: "",
  };
  mockElements[id] = element;
  return element;
};

// Set up global mocks before any tests
beforeEach(() => {
  // Reset mock elements
  mockElements = {};

  // Reset all mock functions
  mockPresentCodeStatus.mockClear();
  mockPresentFeedback.mockClear();
  mockPresentPassenger.mockClear();
  mockPresentStats.mockClear();
  mockPresentWorld.mockClear();
  mockViewModelManagerInstance.cleanup.mockClear();
  mockResponsiveScalingInstance.initialize.mockClear();
  mockResponsiveScalingInstance.cleanup.mockClear();
  ViewModelManager.create.mockClear();

  vi.stubGlobal("document", {
    getElementById: vi.fn((id) => createMockElement(id)),
    querySelector: vi.fn((selector) => createMockElement(selector)),
    addEventListener: vi.fn(),
    body: {
      style: {},
    },
  });

  vi.stubGlobal("localStorage", {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
  });

  vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
  vi.stubGlobal("alert", vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

/**
 * Creates mock dependencies for AppEventHandlers
 */
function createMocks() {
  const eventBus = new EventBus();

  const app = {
    startChallenge: vi.fn(),
    currentChallenge: { id: 0 },
  };

  const dom = {
    getElement: vi.fn((id) => createMockElement(id)),
    showRuntimeStatus: vi.fn(),
    clearElements: vi.fn(),
  };

  const editor = {
    currentLanguage: "javascript",
    getCode: vi.fn().mockReturnValue("// test code"),
    setCode: vi.fn(),
    reset: vi.fn(),
    setLanguage: vi.fn(),
    setLayoutMode: vi.fn(),
    view: { focus: vi.fn() },
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  const runtimeManager = {
    selectLanguage: vi.fn().mockResolvedValue(undefined),
  };

  const gameController = {
    timeScale: 1.0,
  };

  const urlManager = {
    createParamsUrl: vi.fn().mockReturnValue("?challenge=2"),
  };

  return { eventBus, app, dom, editor, runtimeManager, gameController, urlManager };
}

describe("AppEventHandlers", () => {
  let handlers;
  let mocks;

  beforeEach(() => {
    mocks = createMocks();
    handlers = new AppEventHandlers(
      mocks.eventBus,
      mocks.app,
      mocks.dom,
      mocks.editor,
      mocks.runtimeManager,
      mocks.gameController,
      mocks.urlManager,
    );
  });

  afterEach(() => {
    if (handlers) {
      handlers.cleanup();
    }
  });

  describe("constructor", () => {
    it("should initialize with all dependencies", () => {
      expect(handlers.eventBus).toBe(mocks.eventBus);
      expect(handlers.app).toBe(mocks.app);
      expect(handlers.dom).toBe(mocks.dom);
      expect(handlers.editor).toBe(mocks.editor);
      expect(handlers.runtimeManager).toBe(mocks.runtimeManager);
      expect(handlers.gameController).toBe(mocks.gameController);
      expect(handlers.urlManager).toBe(mocks.urlManager);
    });

    it("should create AbortController for cleanup", () => {
      expect(handlers.abortController).toBeInstanceOf(AbortController);
    });

    it("should initialize empty bound handlers", () => {
      expect(handlers.boundHandlers).toEqual({});
    });

    it("should create ResponsiveScaling instance", () => {
      expect(handlers.responsiveScaling).toBeDefined();
      expect(handlers.responsiveScaling.initialize).toBeDefined();
    });

    it("should create ViewModelManager via factory", () => {
      expect(ViewModelManager.create).toHaveBeenCalledWith({
        eventBus: mocks.eventBus,
      });
      expect(handlers.viewModelManager).toBeDefined();
    });
  });

  describe("setupAllHandlers", () => {
    it("should call all setup methods", () => {
      const setupButtonSpy = vi.spyOn(handlers, "setupButtonHandlers");
      const setupEditorSpy = vi.spyOn(handlers, "setupEditorHandlers");
      const setupLanguageSpy = vi.spyOn(handlers, "setupLanguageHandler");
      const setupGameSpy = vi.spyOn(handlers, "setupGameControllerHandlers");
      const setupLayoutSpy = vi.spyOn(handlers, "setupLayoutToggle");

      handlers.setupAllHandlers();

      expect(setupButtonSpy).toHaveBeenCalled();
      expect(setupEditorSpy).toHaveBeenCalled();
      expect(setupLanguageSpy).toHaveBeenCalled();
      expect(setupGameSpy).toHaveBeenCalled();
      expect(setupLayoutSpy).toHaveBeenCalled();
    });
  });

  describe("setupButtonHandlers", () => {
    beforeEach(() => {
      handlers.setupButtonHandlers();
    });

    it("should add click handler to reset button", () => {
      expect(mocks.dom.getElement).toHaveBeenCalledWith("buttonReset");
    });

    it("should add click handler to reset undo button", () => {
      expect(mocks.dom.getElement).toHaveBeenCalledWith("buttonResetUndo");
    });

    it("should add click handler to apply button", () => {
      expect(mocks.dom.getElement).toHaveBeenCalledWith("buttonApply");
    });
  });

  describe("setupEditorHandlers", () => {
    beforeEach(() => {
      handlers.setupEditorHandlers();
    });

    it("should add apply_code event listener to editor", () => {
      expect(mocks.editor.addEventListener).toHaveBeenCalledWith(
        "apply_code",
        expect.any(Function),
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    it("should subscribe to app:user_code_error event", () => {
      const errorHandler = vi.fn();
      mocks.eventBus.on("app:user_code_error", errorHandler);

      const testError = new Error("Test error");
      mocks.eventBus.emit("app:user_code_error", testError);

      expect(errorHandler).toHaveBeenCalled();
    });

    it("should call presentCodeStatus on user code error", () => {
      const testError = new Error("Test error");
      mocks.eventBus.emit("app:user_code_error", testError);

      expect(mockPresentCodeStatus).toHaveBeenCalled();
    });
  });

  describe("setupLanguageHandler", () => {
    beforeEach(() => {
      handlers.setupLanguageHandler();
    });

    it("should get language select element", () => {
      expect(mocks.dom.getElement).toHaveBeenCalledWith("languageSelect");
    });

    it("should store language change handler in boundHandlers", () => {
      expect(handlers.boundHandlers.languageChange).toBeDefined();
    });
  });

  describe("setupGameControllerHandlers", () => {
    beforeEach(() => {
      handlers.setupGameControllerHandlers();
    });

    describe("game:challenge_initialized event", () => {
      it("should cleanup and recreate ViewModelManager", () => {
        const oldCleanup = handlers.viewModelManager.cleanup;

        mocks.eventBus.emit("game:challenge_initialized", {
          clearStats: true,
          options: { isRenderingEnabled: true, floorHeight: 50 },
          initialState: { floors: [], elevators: [], passengers: [] },
        });

        expect(oldCleanup).toHaveBeenCalled();
        // ViewModelManager.create should be called again (once in constructor, once on event)
        expect(ViewModelManager.create).toHaveBeenCalledTimes(2);
      });

      it("should present stats when clearStats is true", () => {
        mocks.eventBus.emit("game:challenge_initialized", {
          clearStats: true,
          options: {},
          initialState: { floors: [], elevators: [], passengers: [] },
        });

        expect(mockPresentStats).toHaveBeenCalled();
      });

      it("should not present stats when clearStats is false", () => {
        mocks.eventBus.emit("game:challenge_initialized", {
          clearStats: false,
          options: {},
          initialState: { floors: [], elevators: [], passengers: [] },
        });

        expect(mockPresentStats).not.toHaveBeenCalled();
      });

      it("should present world", () => {
        mocks.eventBus.emit("game:challenge_initialized", {
          clearStats: false,
          options: {},
          initialState: { floors: [], elevators: [], passengers: [] },
        });

        expect(mockPresentWorld).toHaveBeenCalled();
      });

      it("should initialize responsive scaling", () => {
        mocks.eventBus.emit("game:challenge_initialized", {
          clearStats: false,
          options: {},
          initialState: { floors: [], elevators: [], passengers: [] },
        });

        expect(mockResponsiveScalingInstance.initialize).toHaveBeenCalled();
      });
    });

    describe("game:simulation_started event", () => {
      it("should present stats", () => {
        mocks.eventBus.emit("game:simulation_started", {});

        expect(mockPresentStats).toHaveBeenCalled();
      });
    });

    describe("viewmodel:passenger_created event", () => {
      it("should present new passenger", () => {
        const mockViewModel = { id: "p1" };

        mocks.eventBus.emit("viewmodel:passenger_created", {
          passengerId: "p1",
          viewModel: mockViewModel,
        });

        expect(mockPresentPassenger).toHaveBeenCalledWith(
          expect.anything(),
          mockViewModel,
        );
      });
    });

    describe("simulation:challenge_ended event", () => {
      it("should present success feedback on challenge success", () => {
        mocks.eventBus.emit("simulation:challenge_ended", { succeeded: true });

        expect(mockPresentFeedback).toHaveBeenCalledWith(
          expect.anything(),
          APP_CONSTANTS.MESSAGES.SUCCESS_TITLE,
          APP_CONSTANTS.MESSAGES.SUCCESS_MESSAGE,
          expect.any(String),
        );
      });

      it("should create URL for next challenge on success", () => {
        mocks.eventBus.emit("simulation:challenge_ended", { succeeded: true });

        expect(mocks.urlManager.createParamsUrl).toHaveBeenCalledWith({
          challenge: 2, // currentChallenge.id (0) + 2
        });
      });

      it("should present failure feedback on challenge failure", () => {
        mocks.eventBus.emit("simulation:challenge_ended", { succeeded: false });

        expect(mockPresentFeedback).toHaveBeenCalledWith(
          expect.anything(),
          APP_CONSTANTS.MESSAGES.FAILURE_TITLE,
          APP_CONSTANTS.MESSAGES.FAILURE_MESSAGE,
          "",
        );
      });
    });

    describe("game:cleanup event", () => {
      it("should cleanup ViewModelManager", () => {
        const cleanupSpy = handlers.viewModelManager.cleanup;

        mocks.eventBus.emit("game:cleanup", {});

        expect(cleanupSpy).toHaveBeenCalled();
      });

      it("should clear world elements", () => {
        mocks.eventBus.emit("game:cleanup", {});

        expect(mocks.dom.clearElements).toHaveBeenCalledWith("world");
      });

      it("should cleanup responsive scaling", () => {
        mocks.eventBus.emit("game:cleanup", {});

        expect(mockResponsiveScalingInstance.cleanup).toHaveBeenCalled();
      });
    });
  });

  describe("setupLayoutToggle", () => {
    beforeEach(() => {
      handlers.setupLayoutToggle();
    });

    it("should get layout toggle element", () => {
      expect(document.getElementById).toHaveBeenCalledWith("layout-toggle");
    });

    it("should get splitter element", () => {
      expect(document.getElementById).toHaveBeenCalledWith("layout-splitter");
    });

    it("should store layout toggle handler in boundHandlers", () => {
      expect(handlers.boundHandlers.layoutToggle).toBeDefined();
    });

    it("should store splitter handlers in boundHandlers", () => {
      expect(handlers.boundHandlers.splitterMouseDown).toBeDefined();
      expect(handlers.boundHandlers.splitterMouseMove).toBeDefined();
      expect(handlers.boundHandlers.splitterMouseUp).toBeDefined();
    });

    it("should load saved layout preference from localStorage", () => {
      expect(localStorage.getItem).toHaveBeenCalledWith("layout-preference");
    });

    it("should default to side-by-side when no saved preference", () => {
      localStorage.getItem.mockReturnValue(null);

      // Reset and setup again
      handlers.boundHandlers = {};
      handlers.setupLayoutToggle();

      // Should set side-by-side class
      const container = mockElements[".container"];
      expect(container.classList.toggle).toHaveBeenCalledWith("side-by-side", true);
    });

    it("should respect saved vertical preference", () => {
      localStorage.getItem.mockReturnValue("vertical");

      // Reset and setup again
      handlers.boundHandlers = {};
      mockElements = {};
      handlers.setupLayoutToggle();

      const container = mockElements[".container"];
      expect(container.classList.toggle).toHaveBeenCalledWith("side-by-side", false);
    });
  });

  describe("cleanup", () => {
    it("should abort all event listeners", () => {
      const abortSpy = vi.spyOn(handlers.abortController, "abort");

      handlers.cleanup();

      expect(abortSpy).toHaveBeenCalled();
    });

    it("should clear bound handlers", () => {
      handlers.boundHandlers = { test: vi.fn() };

      handlers.cleanup();

      expect(handlers.boundHandlers).toEqual({});
    });
  });

  describe("event listener cleanup via AbortController", () => {
    it("should remove event listeners when aborted", () => {
      handlers.setupGameControllerHandlers();

      // Abort should remove listeners
      handlers.cleanup();

      // Clear the mock to track new calls
      mockPresentStats.mockClear();

      // Emit an event - handlers should not be called
      mocks.eventBus.emit("game:simulation_started", {});

      // presentStats should NOT be called because listener was removed
      expect(mockPresentStats).not.toHaveBeenCalled();
    });
  });
});

describe("AppEventHandlers integration", () => {
  let handlers;
  let mocks;

  beforeEach(() => {
    mocks = createMocks();
    handlers = new AppEventHandlers(
      mocks.eventBus,
      mocks.app,
      mocks.dom,
      mocks.editor,
      mocks.runtimeManager,
      mocks.gameController,
      mocks.urlManager,
    );
    handlers.setupAllHandlers();
  });

  afterEach(() => {
    if (handlers) {
      handlers.cleanup();
    }
  });

  it("should handle full challenge lifecycle", () => {
    // 1. Challenge initialized
    mocks.eventBus.emit("game:challenge_initialized", {
      clearStats: true,
      options: { isRenderingEnabled: true },
      initialState: { floors: [], elevators: [], passengers: [] },
    });

    expect(mockPresentWorld).toHaveBeenCalled();
    expect(mockPresentStats).toHaveBeenCalled();

    // 2. Simulation started
    mockPresentStats.mockClear();
    mocks.eventBus.emit("game:simulation_started", {});

    expect(mockPresentStats).toHaveBeenCalled();

    // 3. Passenger created
    const mockPassengerVM = { id: "p1" };
    mocks.eventBus.emit("viewmodel:passenger_created", {
      passengerId: "p1",
      viewModel: mockPassengerVM,
    });

    expect(mockPresentPassenger).toHaveBeenCalledWith(expect.anything(), mockPassengerVM);

    // 4. Challenge ended successfully
    mocks.eventBus.emit("simulation:challenge_ended", { succeeded: true });

    expect(mockPresentFeedback).toHaveBeenCalledWith(
      expect.anything(),
      APP_CONSTANTS.MESSAGES.SUCCESS_TITLE,
      APP_CONSTANTS.MESSAGES.SUCCESS_MESSAGE,
      expect.any(String),
    );

    // 5. Cleanup
    mocks.eventBus.emit("game:cleanup", {});

    expect(mocks.dom.clearElements).toHaveBeenCalledWith("world");
  });

  it("should handle user code errors", () => {
    const testError = new Error("Syntax error in user code");
    mocks.eventBus.emit("app:user_code_error", testError);

    expect(mockPresentCodeStatus).toHaveBeenCalled();
  });

  it("should handle challenge failure", () => {
    mocks.eventBus.emit("simulation:challenge_ended", { succeeded: false });

    expect(mockPresentFeedback).toHaveBeenCalledWith(
      expect.anything(),
      APP_CONSTANTS.MESSAGES.FAILURE_TITLE,
      APP_CONSTANTS.MESSAGES.FAILURE_MESSAGE,
      "",
    );
  });
});
