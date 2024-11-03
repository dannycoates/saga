
var asFloor = function(obj, floorLevel, yPosition, errorHandler) {
    var floor = riot.observable(obj);

    floor.level = floorLevel;
    floor.yPosition = yPosition;
    floor.buttons = {up: false, down: false};

    // TODO: Ideally the floor should have a facade where tryTrigger is done
    var tryTrigger = function(event, arg1, arg2, arg3, arg4) {
        try {
            floor.trigger(event, arg1, arg2, arg3, arg4);
        } catch(e) { errorHandler(e); }
    };

    floor.pressUpButton = function() {
        var prev = floor.buttons.up;
        floor.buttons.up = true;
        if(prev !== floor.buttons.up) {
            tryTrigger("buttonstate_change", floor.buttons);
            tryTrigger("up_button_pressed", floor);
        }
    };

    floor.pressDownButton = function() {
        var prev = floor.buttons.down;
        floor.buttons.down = true;
        if(prev !== floor.buttons.down) {
            tryTrigger("buttonstate_change", floor.buttons);
            tryTrigger("down_button_pressed", floor);
        }
    };

    floor.elevatorAvailable = function(elevator) {
        if(elevator.goingUpIndicator && floor.buttons.up) {
            floor.buttons.up = false;
            tryTrigger("buttonstate_change", floor.buttons);
        }
        if(elevator.goingDownIndicator && floor.buttons.down) {
            floor.buttons.down = false;
            tryTrigger("buttonstate_change", floor.buttons);
        }
    };

    floor.getSpawnPosY = function() {
        return floor.yPosition + 30;
    };

    floor.floorNum = function() {
        return floor.level;
    };

    return floor;
};
