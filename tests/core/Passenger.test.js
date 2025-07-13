import { describe, it, expect, beforeEach } from "vitest";
import { Passenger } from "../../src/core/Passenger.js";
import { Floor } from "../../src/core/Floor.js";

describe("Passenger class", () => {
  describe("Passenger model", () => {
    let passenger;
    let startingFloor;
    let destinationFloor;

    beforeEach(() => {
      startingFloor = 2;
      destinationFloor = 5;
      passenger = new Passenger(80, startingFloor, destinationFloor);
    });

    it("initializes with correct properties", () => {
      expect(passenger.weight).toBe(80);
      expect(passenger.startingFloor).toBe(startingFloor);
      expect(passenger.destinationFloor).toBe(5);
      expect(passenger.elevator).toBe(null);
    });

    it("can enter and exit elevators", () => {
      const mockElevator = { id: "test-elevator" };

      expect(passenger.enterElevator(mockElevator)).toBe(true);
      expect(passenger.elevator).toBe(mockElevator);

      expect(passenger.exitElevator()).toBe(true);
      expect(passenger.elevator).toBe(null);
    });

    it("reports current floor correctly", () => {
      expect(passenger.currentFloor).toBe(2); // starting floor

      const mockElevator = { currentFloor: 3 };
      passenger.enterElevator(mockElevator);
      expect(passenger.currentFloor).toBe(3); // elevator's floor
    });

    it("knows when to exit", () => {
      expect(passenger.shouldExitAt(5)).toBe(true);
      expect(passenger.shouldExitAt(3)).toBe(false);
    });
  });
});
