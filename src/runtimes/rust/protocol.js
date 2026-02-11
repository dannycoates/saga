/**
 * @typedef {import('../BaseRuntime.js').ElevatorAPI} ElevatorAPI
 * @typedef {import('../BaseRuntime.js').FloorAPI} FloorAPI
 */

// SharedArrayBuffer layout offsets
export const SYNC_OFFSET = 0;
export const STATE_LENGTH_OFFSET = 4;
export const RESPONSE_LENGTH_OFFSET = 8;
export const STATE_DATA_OFFSET = 12;
export const RESPONSE_DATA_OFFSET = 32768;

// Synchronization signals
export const SIGNAL_IDLE = 0;
export const SIGNAL_TICK_READY = 1;
export const SIGNAL_TICK_DONE = 2;
export const SIGNAL_SHUTDOWN = -1;

/**
 * Serializes elevator and floor state into a binary buffer.
 * Writes at STATE_DATA_OFFSET using little-endian byte order.
 *
 * Format:
 *   u32 elevator_count
 *   u32 floor_count
 *   Per elevator: i32 current_floor, i32 destination_floor (-1 if null),
 *                 f32 percent_full, u32 pressed_button_count, i32[] pressed_buttons
 *   Per floor: i32 level, u8 button_up (0/1), u8 button_down (0/1)
 *
 * @param {ElevatorAPI[]} elevators
 * @param {FloorAPI[]} floors
 * @param {Uint8Array} buffer - Uint8Array over the full SharedArrayBuffer
 * @returns {number} Number of bytes written
 */
export function serializeState(elevators, floors, buffer) {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  let offset = STATE_DATA_OFFSET;

  view.setUint32(offset, elevators.length, true);
  offset += 4;
  view.setUint32(offset, floors.length, true);
  offset += 4;

  for (const elevator of elevators) {
    view.setInt32(offset, elevator.currentFloor, true);
    offset += 4;
    view.setInt32(
      offset,
      elevator.destinationFloor === null ? -1 : elevator.destinationFloor,
      true,
    );
    offset += 4;
    view.setFloat32(offset, elevator.percentFull, true);
    offset += 4;

    const buttons = elevator.pressedFloorButtons;
    view.setUint32(offset, buttons.length, true);
    offset += 4;
    for (const btn of buttons) {
      view.setInt32(offset, btn, true);
      offset += 4;
    }
  }

  for (const floor of floors) {
    view.setInt32(offset, floor.level, true);
    offset += 4;
    view.setUint8(offset, floor.buttons.up ? 1 : 0);
    offset += 1;
    view.setUint8(offset, floor.buttons.down ? 1 : 0);
    offset += 1;
  }

  return offset - STATE_DATA_OFFSET;
}

/**
 * Deserializes elevator commands from the binary buffer.
 * Reads from RESPONSE_DATA_OFFSET using little-endian byte order.
 *
 * Format:
 *   u32 command_count
 *   Per command: u32 elevator_id, i32 target_floor
 *
 * @param {Uint8Array} buffer - Uint8Array over the full SharedArrayBuffer
 * @param {number} length - Number of bytes in the response
 * @returns {Array<{elevatorId: number, floor: number}>}
 */
export function deserializeCommands(buffer, length) {
  if (length === 0) return [];

  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  let offset = RESPONSE_DATA_OFFSET;

  const commandCount = view.getUint32(offset, true);
  offset += 4;

  const commands = [];
  for (let i = 0; i < commandCount; i++) {
    const elevatorId = view.getUint32(offset, true);
    offset += 4;
    const floor = view.getInt32(offset, true);
    offset += 4;
    commands.push({ elevatorId, floor });
  }

  return commands;
}
