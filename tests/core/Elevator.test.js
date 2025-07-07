import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elevator } from '../../src/core/Elevator.js';

describe('Elevator class', () => {
  let elevator;
  const speedFloorsPerSec = 2;
  const floorCount = 10;
  const floorHeight = 50;
  const maxUsers = 4;

  beforeEach(() => {
    elevator = new Elevator(speedFloorsPerSec, floorCount, floorHeight, maxUsers);
  });

  it('initializes with correct properties', () => {
    expect(elevator.floorCount).toBe(10);
    expect(elevator.floorHeight).toBe(50);
    expect(elevator.maxUsers).toBe(4);
    expect(elevator.currentFloor).toBe(0);
    expect(elevator.goingDownIndicator).toBe(true);
    expect(elevator.goingUpIndicator).toBe(true);
    expect(elevator.buttons.length).toBe(10);
    expect(elevator.buttons.every(b => b === false)).toBe(true);
  });

  it('sets floor position correctly', () => {
    elevator.setFloorPosition(5);
    expect(elevator.currentFloor).toBe(5);
    expect(elevator.y).toBe(200); // (10-1)*50 - 5*50 = 450 - 250 = 200
  });

  it('handles user entering elevator', () => {
    const user = { weight: 80 };
    const pos = elevator.userEntering(user);
    
    expect(pos).toEqual(expect.arrayContaining([expect.any(Number), 30]));
    expect(elevator.userSlots.some(slot => slot.user === user)).toBe(true);
  });

  it('returns false when elevator is full', () => {
    const users = Array(4).fill(null).map(() => ({ weight: 80 }));
    users.forEach(user => elevator.userEntering(user));
    
    const extraUser = { weight: 80 };
    const pos = elevator.userEntering(extraUser);
    expect(pos).toBe(false);
  });

  it('presses floor button and triggers events', () => {
    const buttonPressHandler = vi.fn();
    const buttonsChangedHandler = vi.fn();
    
    elevator.on('floor_button_pressed', buttonPressHandler);
    elevator.on('floor_buttons_changed', buttonsChangedHandler);
    
    elevator.pressFloorButton(5);
    
    expect(elevator.buttons[5]).toBe(true);
    expect(buttonPressHandler).toHaveBeenCalled();
    expect(buttonPressHandler.mock.calls[0][0]).toBe(5);
    expect(buttonsChangedHandler).toHaveBeenCalled();
    expect(buttonsChangedHandler.mock.calls[0][0]).toBe(elevator.buttons);
    expect(buttonsChangedHandler.mock.calls[0][1]).toBe(5);
  });

  it('limits floor button presses to valid range', () => {
    elevator.pressFloorButton(-1);
    expect(elevator.buttons[0]).toBe(true);
    
    elevator.pressFloorButton(15);
    expect(elevator.buttons[9]).toBe(true);
  });

  it('removes user from elevator', () => {
    const user1 = { weight: 80 };
    const user2 = { weight: 90 };
    
    elevator.userEntering(user1);
    elevator.userEntering(user2);
    
    // Count users before
    const userCountBefore = elevator.userSlots.filter(slot => slot.user !== null).length;
    expect(userCountBefore).toBe(2);
    
    elevator.userExiting(user1);
    
    // Count users after
    const userCountAfter = elevator.userSlots.filter(slot => slot.user !== null).length;
    expect(userCountAfter).toBe(1);
    
    // Check that user1 is gone and user2 remains
    expect(elevator.userSlots.some(slot => slot.user === user1)).toBe(false);
    expect(elevator.userSlots.some(slot => slot.user === user2)).toBe(true);
  });

  it('calculates load factor correctly', () => {
    expect(elevator.getLoadFactor()).toBe(0);
    
    const user1 = { weight: 80 };
    const user2 = { weight: 100 };
    elevator.userEntering(user1);
    elevator.userEntering(user2);
    
    expect(elevator.getLoadFactor()).toBe(180 / 400); // 0.45
  });

  it('determines if elevator is full or empty', () => {
    expect(elevator.isEmpty()).toBe(true);
    expect(elevator.isFull()).toBe(false);
    
    const users = Array(4).fill(null).map(() => ({ weight: 80 }));
    users.forEach(user => elevator.userEntering(user));
    
    expect(elevator.isEmpty()).toBe(false);
    expect(elevator.isFull()).toBe(true);
  });

  it('determines suitability for travel', () => {
    elevator.goingUpIndicator = true;
    elevator.goingDownIndicator = false;
    
    expect(elevator.isSuitableForTravelBetween(2, 5)).toBe(true); // Going up
    expect(elevator.isSuitableForTravelBetween(5, 2)).toBe(false); // Going down
    expect(elevator.isSuitableForTravelBetween(3, 3)).toBe(true); // Same floor
  });

  it('gets pressed floors correctly', () => {
    elevator.pressFloorButton(2);
    elevator.pressFloorButton(5);
    elevator.pressFloorButton(8);
    
    expect(elevator.getPressedFloors()).toEqual([2, 5, 8]);
  });

  it('calculates exact floor positions', () => {
    expect(elevator.getYPosOfFloor(0)).toBe(450); // (10-1)*50 - 0*50
    expect(elevator.getYPosOfFloor(9)).toBe(0); // (10-1)*50 - 9*50
    
    expect(elevator.getExactFloorOfYPos(450)).toBe(0);
    expect(elevator.getExactFloorOfYPos(0)).toBe(9);
  });

  it('handles new state updates', () => {
    const newFloorHandler = vi.fn();
    elevator.on('new_current_floor', newFloorHandler);
    
    // Move elevator to a different floor position
    elevator.y = 200; // Floor 5 position
    elevator.trigger('new_state');
    
    // Should update current floor
    expect(elevator.currentFloor).toBe(5);
    expect(newFloorHandler).toHaveBeenCalled();
    expect(newFloorHandler.mock.calls[0][0]).toBe(5);
  });
});