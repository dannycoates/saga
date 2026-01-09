(** Elevator Saga OCaml Toplevel
    Entry point for the js_of_ocaml compiled toplevel.
    Exports functions to JavaScript for runtime integration. *)

open Js_of_ocaml
open Js_of_ocaml_toplevel

(** Internal storage for elevator and floor JavaScript objects.
    These are set by the runtime before each tick call. *)
let elevators : Js.Unsafe.any Js.js_array Js.t ref = ref (new%js Js.array_empty)
let floors : Js.Unsafe.any Js.js_array Js.t ref = ref (new%js Js.array_empty)

(** Whether tick function has been verified to exist *)
let tick_verified = ref false

(** Execute OCaml code in the toplevel and return (success, output)
    Uses JsooTop.execute with print_result=true to get output *)
let execute_code code =
  let buffer = Buffer.create 256 in
  let fmt = Format.formatter_of_buffer buffer in
  let success = ref true in
  (try
    JsooTop.execute true fmt code
  with _ ->
    success := false);
  Format.pp_print_flush fmt ();
  let output = Buffer.contents buffer in
  (* Check if output contains "Error:" to detect failures *)
  let contains_substring haystack needle =
    let nlen = String.length needle in
    let hlen = String.length haystack in
    if nlen > hlen then false
    else
      let rec check i =
        if i > hlen - nlen then false
        else if String.sub haystack i nlen = needle then true
        else check (i + 1)
      in check 0
  in
  let has_error = contains_substring output "Error:" in
  (!success && not has_error, output)


(** Register JavaScript callbacks for accessing elevator/floor arrays from OCaml toplevel code *)
let register_callbacks () =
  Js.Unsafe.set Js.Unsafe.global "_ocaml_get_elevators"
    (Js.wrap_callback (fun () -> !elevators));
  Js.Unsafe.set Js.Unsafe.global "_ocaml_get_floors"
    (Js.wrap_callback (fun () -> !floors))

(** Force stdlib to be included by referencing functions from it *)
let _force_stdlib_inclusion =
  (* Touch various stdlib functions to ensure they're linked *)
  let _ = ref 0 in
  let _ = incr in
  let _ = (!) in
  let _ = (:=) in
  let _ = (+) in
  let _ = (-) in
  let _ = ( * ) in
  let _ = (/) in
  let _ = (<) in
  let _ = (>) in
  let _ = (=) in
  let _ = (<>) in
  let _ = (&&) in
  let _ = (||) in
  let _ = not in
  let _ = fst in
  let _ = snd in
  let _ = List.length in
  let _ = Array.length in
  let _ = String.length in
  ()

(** Whether initialization has completed *)
let initialized = ref false

(** Initialize the toplevel.
    Must call JsooTop.initialize() to set up the toplevel environment. *)
let initialize () =
  if !initialized then () else begin
    register_callbacks ();
    (* Force stdlib reference *)
    let _ = _force_stdlib_inclusion in
    (* Set up compiler flags *)
    Clflags.debug := true;
    (* Initialize the js_of_ocaml toplevel - this sets up:
       - /static/cmis directory for CMI files
       - Toploop environment with initial env
       - Input name *)
    JsooTop.initialize ();
    initialized := true
  end

(** Load user code *)
let load_code code_str =
  tick_verified := false;

  (* Execute user code *)
  let success, output = execute_code code_str in
  if not success then
    failwith output;

  (* Verify tick function exists by checking its type *)
  let check_success, check_output = execute_code "let _ : unit -> unit = tick;;" in
  if not check_success then
    failwith ("Code must define a 'tick' function of type unit -> unit: " ^ check_output);

  tick_verified := true;
  output

(** Call the user's tick function *)
let call_tick () =
  if not !tick_verified then
    failwith "No tick function loaded";
  let success, output = execute_code "tick ();;" in
  if not success then
    failwith ("Tick execution error: " ^ output)

(** Export the toplevel API to JavaScript *)
let () =
  Js.export "ocamlToplevel"
    (object%js
      (** Initialize the toplevel - must be called before loadCode *)
      val initialize = Js.wrap_callback (fun () -> initialize ())

      (** Load user code, returns output string *)
      method loadCode (code : Js.js_string Js.t) =
        try
          let result = load_code (Js.to_string code) in
          Js.string result
        with Failure msg ->
          Js_error.raise_ (Js_error.of_error (new%js Js.error_constr (Js.string msg)))

      (** Set elevator array reference *)
      method setElevators (arr : Js.Unsafe.any Js.js_array Js.t) =
        elevators := arr

      (** Set floor array reference *)
      method setFloors (arr : Js.Unsafe.any Js.js_array Js.t) =
        floors := arr

      (** Check if tick function is defined *)
      method hasTick = Js.bool !tick_verified

      (** Raw execute for testing - returns {success: bool, output: string} *)
      method rawExecute (code : Js.js_string Js.t) =
        let success, output = execute_code (Js.to_string code) in
        object%js
          val success = Js.bool success
          val output = Js.string output
        end

      (** Execute tick function *)
      method callTick =
        try
          call_tick ()
        with
        | Failure msg ->
          Js_error.raise_ (Js_error.of_error (new%js Js.error_constr (Js.string msg)))
        | exn ->
          let msg = Printexc.to_string exn in
          Js_error.raise_ (Js_error.of_error (new%js Js.error_constr (Js.string msg)))
    end)
