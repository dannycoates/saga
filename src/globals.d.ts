/**
 * Global type declarations for external dependencies and build-time variables.
 */

// Build-time constant injected by Vite
declare const __BASE_URL__: string;

// CheerpJ runtime globals
declare function cheerpjInit(config: {
  status: string;
  natives: Record<string, Function>;
  overrideDocumentBase: string;
  preloadResources: Record<string, number[]>;
}): Promise<void>;

declare function cheerpjRunMain(
  mainClass: string,
  classPath: string,
  ...args: string[]
): Promise<number>;

declare function cheerpjRunLibrary(path: string): Promise<Record<string, any>>;

declare function cheerpOSAddStringFile(path: string, content: string): void;

// Pyodide runtime globals
declare function loadPyodide(config: {
  indexURL: string;
  convertNullToNone: boolean;
}): Promise<{
  runPython(code: string): any;
  runPythonAsync(code: string): Promise<any>;
  globals: {
    set(name: string, value: any): void;
    get(name: string): any;
  };
}>;

// Window augmentation for app instance
interface Window {
  app?: import("./app.js").ElevatorApp;
  cheerpjInit?: typeof cheerpjInit;
  cheerpjRunMain?: typeof cheerpjRunMain;
  cheerpjRunLibrary?: typeof cheerpjRunLibrary;
  cheerpOSAddStringFile?: typeof cheerpOSAddStringFile;
}

// Custom element interfaces for web components
interface ElevatorStatsElement extends HTMLElement {
  world: import("./game/GameController.js").GameController;
}

interface ChallengeControlElement extends HTMLElement {
  app: import("./app.js").ElevatorApp;
  gameController: import("./game/GameController.js").GameController;
}

interface CodeStatusElement extends HTMLElement {
  setError(error?: Error): void;
}

interface ElevatorFloorElement extends HTMLElement {
  floor: import("./ui/viewmodels/FloorViewModel.js").FloorViewModel;
}

interface ElevatorCarElement extends HTMLElement {
  elevator: import("./ui/viewmodels/ElevatorViewModel.js").ElevatorViewModel;
}

interface ElevatorPassengerElement extends HTMLElement {
  passenger: import("./ui/viewmodels/PassengerViewModel.js").PassengerViewModel;
}
