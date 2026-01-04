// WASM imports from "env" module - provided by JavaScript at instantiation
extern "env" fn js_goToFloor(id: u32, floor: i32) void;
extern "env" fn js_getCurrentFloor(id: u32) i32;
extern "env" fn js_getDestinationFloor(id: u32) i32;
extern "env" fn js_getPercentFull(id: u32) f32;
extern "env" fn js_getPressedButtonCount(id: u32) u32;
extern "env" fn js_getPressedButton(id: u32, idx: u32) i32;
extern "env" fn js_getFloorButtonUp(id: u32) bool;
extern "env" fn js_getFloorButtonDown(id: u32) bool;
extern "env" fn js_getFloorLevel(id: u32) i32;
extern "env" fn js_getElevatorCount() i32;
extern "env" fn js_getFloorCount() i32;

pub const Elevator = struct {
    id: u32,

    pub fn currentFloor(self: Elevator) i32 {
        return js_getCurrentFloor(self.id);
    }

    pub fn destinationFloor(self: Elevator) ?i32 {
        const d = js_getDestinationFloor(self.id);
        return if (d == -1) null else d;
    }

    pub fn percentFull(self: Elevator) f32 {
        return js_getPercentFull(self.id);
    }

    pub fn goToFloor(self: Elevator, floor: i32) void {
        js_goToFloor(self.id, floor);
    }

    pub fn pressedFloorButtons(self: Elevator) PressedButtonIterator {
        return .{
            .elevator_id = self.id,
            .index = 0,
            .count = js_getPressedButtonCount(self.id),
        };
    }
};

pub const PressedButtonIterator = struct {
    elevator_id: u32,
    index: u32,
    count: u32,

    pub fn next(self: *PressedButtonIterator) ?i32 {
        if (self.index >= self.count) return null;
        const btn = js_getPressedButton(self.elevator_id, self.index);
        self.index += 1;
        return btn;
    }
};

pub const Floor = struct {
    id: u32,

    pub fn level(self: Floor) i32 {
        return js_getFloorLevel(self.id);
    }

    pub fn buttons(self: Floor) Buttons {
        return .{ .floor_id = self.id };
    }
};

pub const Buttons = struct {
    floor_id: u32,

    pub fn up(self: Buttons) bool {
        return js_getFloorButtonUp(self.floor_id);
    }

    pub fn down(self: Buttons) bool {
        return js_getFloorButtonDown(self.floor_id);
    }
};

pub fn getElevators() ElevatorIterator {
    return .{ .index = 0, .count = @intCast(js_getElevatorCount()) };
}

pub fn getFloors() FloorIterator {
    return .{ .index = 0, .count = @intCast(js_getFloorCount()) };
}

pub fn getElevatorCount() i32 {
    return js_getElevatorCount();
}

pub fn getFloorCount() i32 {
    return js_getFloorCount();
}

pub const ElevatorIterator = struct {
    index: u32,
    count: u32,

    pub fn next(self: *ElevatorIterator) ?Elevator {
        if (self.index >= self.count) return null;
        const elev = Elevator{ .id = self.index };
        self.index += 1;
        return elev;
    }
};

pub const FloorIterator = struct {
    index: u32,
    count: u32,

    pub fn next(self: *FloorIterator) ?Floor {
        if (self.index >= self.count) return null;
        const f = Floor{ .id = self.index };
        self.index += 1;
        return f;
    }
};
