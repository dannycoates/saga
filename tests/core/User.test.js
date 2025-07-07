import { describe, it, expect, beforeEach } from 'vitest';
import { User } from '../../src/core/User.js';

describe('User class', () => {
  let u;

  beforeEach(() => {
    u = new User(80); // Create user with weight 80
  });

  it('updates display position when told to', () => {
    u.moveTo(1.0, 1.0);
    u.updateDisplayPosition();
    expect(u.worldX).toBe(1.0);
    expect(u.worldY).toBe(1.0);
  });

  it('has initial properties set correctly', () => {
    expect(u.weight).toBe(80);
    expect(u.currentFloor).toBe(0);
    expect(u.destinationFloor).toBe(0);
    expect(u.done).toBe(false);
    expect(u.removeMe).toBe(false);
  });

  it('appears on floor with correct destination', () => {
    const mockFloor = {
      level: 2,
      getSpawnPosY: () => 100,
      pressUpButton: () => {},
      pressDownButton: () => {}
    };
    
    u.appearOnFloor(mockFloor, 5);
    expect(u.currentFloor).toBe(2);
    expect(u.destinationFloor).toBe(5);
    expect(u.y).toBe(100);
  });

  it('presses up button when going up', () => {
    let upPressed = false;
    const mockFloor = {
      pressUpButton: () => { upPressed = true; },
      pressDownButton: () => {}
    };
    
    u.currentFloor = 2;
    u.destinationFloor = 5;
    u.pressFloorButton(mockFloor);
    expect(upPressed).toBe(true);
  });

  it('presses down button when going down', () => {
    let downPressed = false;
    const mockFloor = {
      pressUpButton: () => {},
      pressDownButton: () => { downPressed = true; }
    };
    
    u.currentFloor = 5;
    u.destinationFloor = 2;
    u.pressFloorButton(mockFloor);
    expect(downPressed).toBe(true);
  });
});