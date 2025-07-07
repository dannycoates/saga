import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Floor } from '../../src/core/Floor.js';

describe('Floor class', () => {
  let floor;
  let errorHandler;

  beforeEach(() => {
    errorHandler = vi.fn();
    floor = new Floor(3, 150, errorHandler);
  });

  it('initializes with correct properties', () => {
    expect(floor.level).toBe(3);
    expect(floor.yPosition).toBe(150);
    expect(floor.buttons.up).toBe(false);
    expect(floor.buttons.down).toBe(false);
  });

  it('presses up button and triggers events', () => {
    const buttonStateHandler = vi.fn();
    const upButtonHandler = vi.fn();
    
    floor.addEventListener('buttonstate_change', (e) => buttonStateHandler(e.detail));
    floor.addEventListener('up_button_pressed', (e) => upButtonHandler(e.detail));
    
    floor.pressUpButton();
    
    expect(floor.buttons.up).toBe(true);
    expect(buttonStateHandler).toHaveBeenCalled();
    expect(buttonStateHandler.mock.calls[0][0]).toEqual(floor.buttons);
    expect(upButtonHandler).toHaveBeenCalled();
    expect(upButtonHandler.mock.calls[0][0]).toBe(floor);
  });

  it('does not trigger events when button already pressed', () => {
    floor.buttons.up = true;
    
    const buttonStateHandler = vi.fn();
    floor.addEventListener('buttonstate_change', (e) => buttonStateHandler(e.detail));
    
    floor.pressUpButton();
    
    expect(buttonStateHandler).not.toHaveBeenCalled();
  });

  it('presses down button and triggers events', () => {
    const buttonStateHandler = vi.fn();
    const downButtonHandler = vi.fn();
    
    floor.addEventListener('buttonstate_change', (e) => buttonStateHandler(e.detail));
    floor.addEventListener('down_button_pressed', (e) => downButtonHandler(e.detail));
    
    floor.pressDownButton();
    
    expect(floor.buttons.down).toBe(true);
    expect(buttonStateHandler).toHaveBeenCalled();
    expect(buttonStateHandler.mock.calls[0][0]).toEqual(floor.buttons);
    expect(downButtonHandler).toHaveBeenCalled();
    expect(downButtonHandler.mock.calls[0][0]).toBe(floor);
  });

  it('handles elevator availability for up indicator', () => {
    floor.buttons.up = true;
    floor.buttons.down = true;
    
    const buttonStateHandler = vi.fn();
    floor.addEventListener('buttonstate_change', (e) => buttonStateHandler(e.detail));
    
    const elevator = {
      goingUpIndicator: true,
      goingDownIndicator: false
    };
    
    floor.elevatorAvailable(elevator);
    
    expect(floor.buttons.up).toBe(false);
    expect(floor.buttons.down).toBe(true);
    expect(buttonStateHandler).toHaveBeenCalled();
    expect(buttonStateHandler.mock.calls[0][0]).toEqual(floor.buttons);
  });

  it('handles elevator availability for down indicator', () => {
    floor.buttons.up = true;
    floor.buttons.down = true;
    
    const elevator = {
      goingUpIndicator: false,
      goingDownIndicator: true
    };
    
    floor.elevatorAvailable(elevator);
    
    expect(floor.buttons.up).toBe(true);
    expect(floor.buttons.down).toBe(false);
  });

  it('handles elevator availability for both indicators', () => {
    floor.buttons.up = true;
    floor.buttons.down = true;
    
    const elevator = {
      goingUpIndicator: true,
      goingDownIndicator: true
    };
    
    floor.elevatorAvailable(elevator);
    
    expect(floor.buttons.up).toBe(false);
    expect(floor.buttons.down).toBe(false);
  });

  it('gets spawn position Y correctly', () => {
    expect(floor.getSpawnPosY()).toBe(180); // yPosition + 30
  });

  it('returns floor number correctly', () => {
    expect(floor.floorNum()).toBe(3);
  });

  it('handles errors with error handler', () => {
    const error = new Error('Test error');
    
    // Mock dispatchEvent to throw an error
    floor.dispatchEvent = vi.fn(() => { throw error; });
    
    // Press button which will call tryTrigger
    floor.pressUpButton();
    
    expect(errorHandler).toHaveBeenCalledWith(error);
  });
});