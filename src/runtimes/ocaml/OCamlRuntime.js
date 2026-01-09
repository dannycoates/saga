import { BaseRuntime } from "../BaseRuntime.js";

/**
 * @typedef {import('../BaseRuntime.js').ElevatorAPI} ElevatorAPI
 * @typedef {import('../BaseRuntime.js').FloorAPI} FloorAPI
 */

/**
 * @typedef {Object} OCamlToplevelAPI
 * @property {() => void} initialize
 * @property {(code: string) => {output: string}} rawExecute
 * @property {(code: string) => void} loadCode
 * @property {() => boolean} hasTick
 * @property {() => void} callTick
 */

/* eslint-disable no-unused-vars */
/**
 * Extend Window interface for OCaml runtime globals
 * @typedef {Window & typeof globalThis & {
 *   ocamlToplevel?: OCamlToplevelAPI,
 *   _elev_count?: () => number,
 *   _elev_current_floor?: (id: number) => number,
 *   _elev_destination_floor?: (id: number) => number,
 *   _elev_go_to_floor?: (id: number, floor: number) => void,
 *   _elev_pressed_buttons?: (id: number) => number[],
 *   _elev_percent_full?: (id: number) => number,
 *   _floor_count?: () => number,
 *   _floor_level?: (id: number) => number,
 *   _floor_button_up?: (id: number) => boolean,
 *   _floor_button_down?: (id: number) => boolean,
 * }} OCamlWindow
 */
/* eslint-enable no-unused-vars */

/** @type {OCamlWindow} */
const win = window;

const DEFAULT_TEMPLATE = `(* Elevator Saga - OCaml

   API:
     Elevator: current_floor, destination_floor, go_to_floor,
               pressed_buttons, percent_full, count
     Floor: level, button_up, button_down, count
     Helpers: elevators (), floors (), sign *)

let next_floor = ref 1

let tick () =
  let e = 0 in
  let num_floors = Floor.count () in
  match Elevator.destination_floor e with
  | None ->
    if !next_floor >= num_floors then next_floor := 0;
    incr next_floor;
    Elevator.go_to_floor e !next_floor
  | Some _ -> ()
;;
`;

/**
 * OCaml code that defines the Elevator and Floor API modules.
 * Uses simple Js.Unsafe calls to access JavaScript helper functions.
 */
const ELEVATOR_API_CODE = `
open Js_of_ocaml;;

(* Helper to call JS functions with one int arg *)
let call1i name arg : 'a =
  Js.Unsafe.fun_call (Js.Unsafe.get Js.Unsafe.global name)
    (Array.map Js.Unsafe.inject (Array.make 1 arg));;

(* Helper to call JS functions with two int args *)
let call2i name a1 a2 : 'a =
  let args = Array.map Js.Unsafe.inject (Array.of_list [a1; a2]) in
  Js.Unsafe.fun_call (Js.Unsafe.get Js.Unsafe.global name) args;;

(* Helper to call JS functions with no args *)
let call0 name : 'a =
  Js.Unsafe.fun_call (Js.Unsafe.get Js.Unsafe.global name)
    (Array.map Js.Unsafe.inject (Array.make 0 0));;

(* Elevator module *)
module Elevator = struct
  let current_floor id : int = call1i "_elev_current_floor" id
  let destination_floor id : int option =
    let v : int = call1i "_elev_destination_floor" id in
    if v < 0 then None else Some v
  let go_to_floor id floor : unit = ignore (call2i "_elev_go_to_floor" id floor)
  let count () : int = call0 "_elev_count"
  let pressed_buttons id : int list =
    let arr : int Js.js_array Js.t = call1i "_elev_pressed_buttons" id in
    let len = Js.Unsafe.get arr "length" in
    List.init len (fun i -> Js.Optdef.get (Js.array_get arr i) (fun () -> 0))
  let percent_full id : float = call1i "_elev_percent_full" id
end;;

(* Floor module *)
module Floor = struct
  let level id : int = call1i "_floor_level" id
  let button_up id : bool = Js.to_bool (call1i "_floor_button_up" id)
  let button_down id : bool = Js.to_bool (call1i "_floor_button_down" id)
  let count () : int = call0 "_floor_count"
end;;

(* Helper functions *)
let elevators () = List.init (Elevator.count ()) Fun.id;;
let floors () = List.init (Floor.count ()) Fun.id;;
let sign x = compare x 0;;
`;

/**
 * OCaml runtime using js_of_ocaml toplevel for in-browser OCaml execution.
 *
 * @extends BaseRuntime
 */
export class OCamlRuntime extends BaseRuntime {
  /**
   * Creates an OCaml runtime instance.
   */
  constructor() {
    super("ocaml");
    /** @type {any} OCaml toplevel instance from window.ocamlToplevel */
    this.toplevel = null;
    /** @type {ElevatorAPI[]} Current elevator references */
    this.elevators = [];
    /** @type {FloorAPI[]} Current floor references */
    this.floors = [];
  }

  /**
   * Loads the js_of_ocaml toplevel.
   * @override
   * @returns {Promise<void>}
   */
  async loadRuntime() {
    if (this.isLoading || this.isLoaded) return;
    this.isLoading = true;

    try {
      // Load the toplevel script if not already loaded
      if (typeof win.ocamlToplevel === "undefined") {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `${__BASE_URL__}ocaml/toplevel.js`;
          script.onload = resolve;
          script.onerror = () =>
            reject(new Error("Failed to load OCaml toplevel"));
          document.head.appendChild(script);
        });
      }

      // Get the exported toplevel object
      if (typeof win.ocamlToplevel === "undefined") {
        throw new Error("OCaml toplevel not initialized after script load");
      }

      this.toplevel = win.ocamlToplevel;

      // Initialize the toplevel
      this.toplevel.initialize();

      // Setup stdlib and primitive types
      this.toplevel.rawExecute("open Stdlib;;");
      this.toplevel.rawExecute(`
        type unit = Unit.t = ();;
        type bool = Bool.t = false | true;;
        type 'a list = 'a List.t = [] | (::) of 'a * 'a list;;
        type 'a option = 'a Option.t = None | Some of 'a;;
      `);

      // Note: Elevator/Floor API is prepended to user code in loadCode()
      this.isLoaded = true;
    } catch (error) {
      throw new Error(`Failed to load OCaml runtime: ${error.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Loads user OCaml code.
   * @override
   * @param {string} code - OCaml code to load
   * @returns {Promise<void>}
   */
  async loadCode(code) {
    if (!this.isLoaded) {
      throw new Error("OCaml runtime not loaded");
    }

    try {
      // Prepend the API code to user code so they're in the same execution context
      const fullCode = ELEVATOR_API_CODE + "\n" + code;
      this.toplevel.loadCode(fullCode);

      // Verify tick function exists
      if (!this.toplevel.hasTick()) {
        throw new Error("Code must define a tick function");
      }

      this.loadedCode = code;
    } catch (e) {
      // Re-throw with cleaner message
      const msg = e.message || String(e);
      throw new Error(`OCaml error: ${msg}`);
    }
  }

  /**
   * Executes the user's tick function.
   * @override
   * @param {ElevatorAPI[]} elevators
   * @param {FloorAPI[]} floors
   * @returns {Promise<void>}
   */
  async execute(elevators, floors) {
    if (!this.isLoaded) {
      throw new Error("OCaml runtime not loaded");
    }
    if (!this.loadedCode) {
      throw new Error("No code loaded. Call loadCode() first.");
    }

    // Store references
    this.elevators = elevators;
    this.floors = floors;

    // Set up JavaScript helper functions that OCaml can call
    win._elev_count = () => elevators.length;
    win._elev_current_floor = (/** @type {number} */ id) =>
      elevators[id]?.currentFloor ?? 0;
    win._elev_destination_floor = (/** @type {number} */ id) =>
      elevators[id]?.destinationFloor ?? -1;
    win._elev_go_to_floor = (
      /** @type {number} */ id,
      /** @type {number} */ floor,
    ) => elevators[id]?.goToFloor(floor);
    win._elev_pressed_buttons = (/** @type {number} */ id) =>
      elevators[id]?.pressedFloorButtons ?? [];
    win._elev_percent_full = (/** @type {number} */ id) =>
      elevators[id]?.percentFull ?? 0.0;
    win._floor_count = () => floors.length;
    win._floor_level = (/** @type {number} */ id) => floors[id]?.level ?? 0;
    win._floor_button_up = (/** @type {number} */ id) =>
      floors[id]?.buttons?.up ?? false;
    win._floor_button_down = (/** @type {number} */ id) =>
      floors[id]?.buttons?.down ?? false;

    // Call the user's tick function
    try {
      this.toplevel.callTick();
    } catch (e) {
      const msg = e.message || String(e);
      throw new Error(`OCaml execution error: ${msg}`);
    }
  }

  /**
   * Gets the default OCaml code template.
   * @override
   * @returns {string}
   */
  getDefaultTemplate() {
    return DEFAULT_TEMPLATE;
  }

  /**
   * Cleans up runtime resources.
   * @override
   */
  cleanup() {
    this.elevators = [];
    this.floors = [];
    this.loadedCode = null;
    // Keep toplevel loaded for restart efficiency
  }
}
