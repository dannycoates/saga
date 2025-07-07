import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWorldController, createWorldCreator } from '../../src/core/World.js';
import { createFrameRequester } from '../../src/core/utils.js';

describe('World controller', () => {
  let controller;
  let fakeWorld;
  let fakeCodeObj;
  let frameRequester;
  const DT_MAX = 1000.0 / 59;

  beforeEach(() => {
    controller = createWorldController(DT_MAX);
    
    fakeWorld = {
      update: vi.fn(),
      init: vi.fn(),
      updateDisplayPositions: vi.fn(),
      trigger: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      challengeEnded: false,
      elevatorInterfaces: [],
      floors: []
    };
    
    fakeCodeObj = {
      init: vi.fn(),
      update: vi.fn()
    };
    
    frameRequester = createFrameRequester(10.0);
  });

  it('does not update world on first animation frame', () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    frameRequester.trigger();
    expect(fakeWorld.update).not.toHaveBeenCalled();
  });

  it('calls world update with correct delta t', () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    frameRequester.trigger();
    frameRequester.trigger();
    expect(fakeWorld.update).toHaveBeenCalledWith(0.01);
  });

  it('calls world update with scaled delta t', () => {
    controller.timeScale = 2.0;
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    frameRequester.trigger();
    frameRequester.trigger();
    expect(fakeWorld.update).toHaveBeenCalledWith(0.02);
  });

  it('does not update world when paused', () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    controller.setPaused(true);
    frameRequester.trigger();
    frameRequester.trigger();
    expect(fakeWorld.update).not.toHaveBeenCalled();
  });

  it('initializes code on first update when unpaused', () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, false);
    controller.setPaused(false);
    frameRequester.trigger();
    frameRequester.trigger();
    expect(fakeCodeObj.init).toHaveBeenCalledWith(fakeWorld.elevatorInterfaces, fakeWorld.floors);
    expect(fakeWorld.init).toHaveBeenCalled();
  });

  it('handles user code errors', () => {
    const error = new Error('User code error');
    fakeCodeObj.update.mockImplementation(() => { throw error; });
    
    const errorHandler = vi.fn();
    controller.on('usercode_error', errorHandler);
    
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    frameRequester.trigger();
    frameRequester.trigger();
    
    expect(errorHandler).toHaveBeenCalled();
    expect(errorHandler.mock.calls[0][0]).toBe(error);
    expect(controller.isPaused).toBe(true);
  });
});

describe('World creator', () => {
  let creator;

  beforeEach(() => {
    creator = createWorldCreator();
  });

  it('creates floors with correct properties', () => {
    const floors = creator.createFloors(4, 50, () => {});
    
    expect(floors.length).toBe(4);
    expect(floors[0].level).toBe(0);
    expect(floors[0].yPosition).toBe(150); // (4-1-0) * 50
    expect(floors[3].level).toBe(3);
    expect(floors[3].yPosition).toBe(0); // (4-1-3) * 50
  });

  it('creates elevators with correct properties', () => {
    const elevators = creator.createElevators(2, 5, 50, [4, 6]);
    
    expect(elevators.length).toBe(2);
    expect(elevators[0].maxUsers).toBe(4);
    expect(elevators[1].maxUsers).toBe(6);
    expect(elevators[0].floorCount).toBe(5);
    expect(elevators[0].floorHeight).toBe(50);
  });

  it('creates random users with correct properties', () => {
    const user = creator.createRandomUser();
    
    expect(user.weight).toBeGreaterThanOrEqual(55);
    expect(user.weight).toBeLessThanOrEqual(100);
    expect(['child', 'female', 'male']).toContain(user.displayType);
  });

  it('creates world with default options', () => {
    const world = creator.createWorld({});
    
    expect(world.floorHeight).toBe(50);
    expect(world.floors.length).toBe(4);
    expect(world.elevators.length).toBe(2);
    expect(world.users).toEqual([]);
    expect(world.transportedCounter).toBe(0);
  });
});