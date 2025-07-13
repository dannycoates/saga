import { describe, it, expect, beforeEach } from "vitest";
import { Elevator } from "../../src/core/Elevator";

describe("Elevator", () => {
  let elevator;

  beforeEach(() => {
    // Default elevator: 5 floors, 1 floor/sec speed, 4 max users
    elevator = new Elevator(0, 1, 5, 4);
  });

  describe("constructor", () => {
    it("should initialize with correct default values", () => {
      expect(elevator.index).toBe(0);
      expect(elevator.MAXSPEED).toBe(1);
      expect(elevator.MAXFLOOR).toBe(5);
      expect(elevator.position).toBe(0);
      expect(elevator.destination).toBe(0);
      expect(elevator.velocity).toBe(0);
      expect(elevator.moves).toBe(0);
      expect(elevator.capacity).toBe(4);
      expect(elevator.buttons.length).toBe(5);
      expect(elevator.goingDownIndicator).toBe(true);
      expect(elevator.goingUpIndicator).toBe(true);
    });
  });

  describe("currentFloor", () => {
    it("should return floor number for integer positions", () => {
      elevator.position = 2.0;
      expect(elevator.currentFloor).toBe(2);
    });

    it("should floor fractional positions", () => {
      elevator.position = 2.9;
      expect(elevator.currentFloor).toBe(2);
      elevator.position = 2.1;
      expect(elevator.currentFloor).toBe(2);
    });
  });

  describe("destinationFloor", () => {
    it("should return null when not moving", () => {
      expect(elevator.destinationFloor).toBe(null);
    });

    it("should return destination when moving", () => {
      elevator.goToFloor(3);
      expect(elevator.destinationFloor).toBe(3);
    });
  });

  describe("direction", () => {
    it("should return 0 when at destination", () => {
      expect(elevator.direction).toBe(0);
    });

    it("should return 1 when going up", () => {
      elevator.goToFloor(3);
      expect(elevator.direction).toBe(1);
    });

    it("should return -1 when going down", () => {
      elevator.position = 4;
      elevator.goToFloor(1);
      expect(elevator.direction).toBe(-1);
    });
  });

  describe("isMoving", () => {
    it("should return false when stationary", () => {
      expect(elevator.isMoving).toBe(false);
    });

    it("should return true when has different destination", () => {
      elevator.goToFloor(2);
      expect(elevator.isMoving).toBe(true);
    });
  });

  describe("goToFloor", () => {
    it("should set destination and increment moves", () => {
      elevator.goToFloor(3);
      expect(elevator.destination).toBe(3);
      expect(elevator.moves).toBe(1);
    });

    it("should clamp to valid floor range", () => {
      elevator.goToFloor(-1);
      expect(elevator.destination).toBe(0);

      elevator.goToFloor(10);
      expect(elevator.destination).toBe(4); // MAXFLOOR - 1
    });

    it("should not increment moves if already at destination", () => {
      elevator.goToFloor(3);
      expect(elevator.moves).toBe(1);
      elevator.goToFloor(3);
      expect(elevator.moves).toBe(1);
    });
  });

  describe("tick", () => {
    it("should return true when not moving", () => {
      expect(elevator.tick(0.1)).toBe(true);
    });

    it("should update position when moving", () => {
      elevator.pause = 0;
      elevator.goToFloor(2);
      const initialPos = elevator.position;
      // First tick calculates velocity but position update uses previous velocity (0)
      elevator.tick(0.1);
      // Second tick will show movement
      elevator.tick(0.1);
      expect(elevator.position).toBeGreaterThan(initialPos);
    });

    it("should return true when arriving at destination", () => {
      elevator.goToFloor(1);
      // Simulate movement close to destination
      elevator.position = 0.99;
      elevator.velocity = 0.1;
      elevator.pause = 0;
      const arrived = elevator.tick(0.1);
      expect(arrived).toBe(true);
      expect(elevator.position).toBe(1);
      expect(elevator.velocity).toBe(0);
    });

    it("should clear floor button when arriving", () => {
      elevator.goToFloor(2);
      elevator.buttons[2] = true;
      elevator.position = 1.99;
      elevator.velocity = 0.1;
      elevator.pause = 0;
      elevator.tick(0.1);
      expect(elevator.buttons[2]).toBe(false);
    });

    it("should handle very small time steps", () => {
      elevator.goToFloor(1);
      elevator.pause = 0;
      const initialPos = elevator.position;
      // First tick to set velocity
      elevator.tick(0.001);
      // Second tick to see movement
      elevator.tick(0.001);
      expect(elevator.position).toBeGreaterThan(initialPos);
      expect(elevator.position).toBeLessThan(0.01);
    });

    it("should handle arrival within tolerance", () => {
      elevator.goToFloor(2);
      elevator.position = 1.995;
      elevator.velocity = 0.1;
      elevator.pause = 0;
      const arrived = elevator.tick(0.1);
      expect(arrived).toBe(true);
      expect(elevator.position).toBe(2);
    });
  });

  describe("calculateVelocity", () => {
    it("should accelerate from rest", () => {
      elevator.goToFloor(3);
      const velocity = elevator.calculateVelocity(0.1);
      expect(velocity).toBeGreaterThan(0);
    });

    it("should decelerate when approaching destination", () => {
      elevator.goToFloor(1);
      elevator.position = 0.8; // Closer to destination
      elevator.velocity = 1.0; // Max speed
      const newVelocity = elevator.calculateVelocity(0.1);
      expect(newVelocity).toBeLessThan(elevator.velocity);
    });

    it("should reverse direction when overshooting", () => {
      elevator.position = 2;
      elevator.velocity = 1.0; // Going up
      elevator.goToFloor(1); // Need to go down
      const newVelocity = elevator.calculateVelocity(0.1);
      expect(newVelocity).toBeLessThan(elevator.velocity);
    });

    it("should respect max speed", () => {
      elevator.goToFloor(4);
      elevator.velocity = 0.9;
      // Large time step that would exceed max speed
      elevator.tick(0.5);
      expect(Math.abs(elevator.velocity)).toBeLessThanOrEqual(
        elevator.MAXSPEED,
      );
    });
  });

  describe("passenger management", () => {
    let mockUser;

    beforeEach(() => {
      mockUser = {
        weight: 100,
        enterElevator: () => {},
        exitElevator: () => {},
      };
    });

    it("should add passengers to available slots", () => {
      const slot = elevator.addPassenger(mockUser);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(elevator.passengers[slot]).toBe(mockUser);
    });

    it("should return false when full", () => {
      for (let i = 0; i < 4; i++) {
        elevator.addPassenger(mockUser);
      }
      expect(elevator.addPassenger(mockUser)).toBe(false);
    });

    it("should calculate percentFull correctly", () => {
      expect(elevator.percentFull).toBe(0);
      elevator.addPassenger({ weight: 100, enterElevator: () => {} });
      expect(elevator.percentFull).toBe(0.25);
      elevator.addPassenger({ weight: 100, enterElevator: () => {} });
      expect(elevator.percentFull).toBe(0.5);
    });

    it("should handle removePassenger", () => {
      elevator.addPassenger(mockUser);
      expect(elevator.isEmpty).toBe(false);
      elevator.removePassenger(mockUser);
      expect(elevator.isEmpty).toBe(true);
    });

    it("should correctly report isFull", () => {
      expect(elevator.isFull).toBe(false);
      for (let i = 0; i < 4; i++) {
        elevator.addPassenger({ weight: 100, enterElevator: () => {} });
      }
      expect(elevator.isFull).toBe(true);
    });

    it("should correctly report isEmpty", () => {
      expect(elevator.isEmpty).toBe(true);
      elevator.addPassenger(mockUser);
      expect(elevator.isEmpty).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle zero speed elevator", () => {
      const slowElevator = new Elevator(0, 0, 5, 4);
      slowElevator.goToFloor(2);
      slowElevator.tick(0.1);
      expect(slowElevator.velocity).toBe(0);
    });

    it("should handle single floor building", () => {
      const singleFloor = new Elevator(0, 1, 1, 4);
      singleFloor.goToFloor(5); // Invalid floor
      expect(singleFloor.destination).toBe(0);
    });

    it("should handle very large time steps", () => {
      elevator.goToFloor(4);
      // Multiple ticks to simulate movement over time
      for (let i = 0; i < 20; i++) {
        elevator.tick(0.5);
      }
      expect(elevator.position).toBe(4);
      expect(elevator.velocity).toBe(0);
    });

    it("should handle negative positions gracefully", () => {
      elevator.position = -0.5; // Somehow got negative
      elevator.goToFloor(2);
      elevator.tick(0.1);
      expect(elevator.direction).toBe(1);
    });

    it("should handle fractional destinations", () => {
      elevator.destination = 2.5; // Fractional destination
      elevator.position = 2.49;
      elevator.velocity = 0.1;
      elevator.pause = 0;
      const arrived = elevator.tick(0.1);
      expect(arrived).toBe(true);
      expect(elevator.position).toBe(2.5);
    });
  });

  describe("distanceToDestination", () => {
    it("should calculate correct distance", () => {
      elevator.position = 1;
      elevator.destination = 3;
      expect(elevator.distanceToDestination).toBe(2);
    });

    it("should be zero when at destination", () => {
      elevator.position = 2;
      elevator.destination = 2;
      expect(elevator.distanceToDestination).toBe(0);
    });
  });

  describe("tick edge cases", () => {
    it("should handle multiple rapid calls", () => {
      elevator.goToFloor(1);
      // Simulate many small time steps
      for (let i = 0; i < 300; i++) {
        elevator.tick(0.01);
      }
      expect(elevator.position).toBe(1);
      expect(elevator.velocity).toBe(0);
    });

    it("should handle destination changes mid-flight", () => {
      elevator.goToFloor(4);
      elevator.tick(1.5);
      elevator.tick(0.1);
      const midPosition = elevator.position;
      expect(midPosition).toBeGreaterThan(0);

      // Change destination
      elevator.goToFloor(1);
      expect(elevator.moves).toBe(2);

      // Should eventually reach new destination
      for (let i = 0; i < 100; i++) {
        elevator.tick(0.1);
      }
      expect(elevator.position).toBe(1);
    });

    it("should handle button state correctly during movement", () => {
      elevator.goToFloor(3);
      elevator.buttons[3] = true;

      // Move partway
      elevator.tick(0.1);
      elevator.tick(0.1);
      expect(elevator.buttons[3]).toBe(true);

      // Arrive
      for (let i = 0; i < 60; i++) {
        elevator.tick(0.1);
      }
      expect(elevator.position).toBe(3);
      expect(elevator.buttons[3]).toBe(false);
    });

    it("should handle concurrent passenger operations during movement", () => {
      const user1 = {
        weight: 80,
        enterElevator: () => {},
        exitElevator: () => {},
      };
      const user2 = {
        weight: 90,
        enterElevator: () => {},
        exitElevator: () => {},
      };

      elevator.addPassenger(user1);
      elevator.goToFloor(3);

      // Add passenger while moving
      elevator.tick(0.1);
      elevator.tick(0.1);
      const slot = elevator.addPassenger(user2);
      expect(slot).toBeGreaterThanOrEqual(0);

      // Remove passenger while moving
      elevator.removePassenger(user1);
      expect(elevator.percentFull).toBeCloseTo(0.225, 3);
    });
  });
});
