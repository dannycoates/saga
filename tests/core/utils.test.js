import { describe, it, expect } from 'vitest';
import { 
  limitNumber, 
  epsilonEquals,
  Observable,
  randomInt,
  sum,
  sortBy
} from '../../src/core/utils.js';

describe('Utils', () => {
  describe('limitNumber', () => {
    it('should limit number within range', () => {
      expect(limitNumber(5, 0, 10)).toBe(5);
      expect(limitNumber(-5, 0, 10)).toBe(0);
      expect(limitNumber(15, 0, 10)).toBe(10);
    });
  });

  describe('epsilonEquals', () => {
    it('should compare numbers with epsilon tolerance', () => {
      expect(epsilonEquals(1.0, 1.0)).toBe(true);
      // Test with a difference definitely greater than epsilon
      expect(epsilonEquals(1.0, 1.00000002)).toBe(false);
      // Test with a difference definitely less than epsilon
      expect(epsilonEquals(1.0, 1.000000005)).toBe(true);
      // Another test with clear difference
      expect(epsilonEquals(1.0, 1.0001)).toBe(false);
    });
  });

  describe('Observable', () => {
    it('should trigger events', () => {
      const obs = new Observable();
      let called = false;
      let receivedArg;
      
      obs.on('test', (arg) => {
        called = true;
        receivedArg = arg;
      });
      
      obs.trigger('test', 'hello');
      expect(called).toBe(true);
      expect(receivedArg).toBe('hello');
    });

    it('should handle off', () => {
      const obs = new Observable();
      let callCount = 0;
      const handler = () => callCount++;
      
      obs.on('test', handler);
      obs.trigger('test');
      expect(callCount).toBe(1);
      
      obs.off('test', handler);
      obs.trigger('test');
      expect(callCount).toBe(1);
    });
  });

  describe('Array utilities', () => {
    it('should sum array', () => {
      expect(sum([1, 2, 3, 4])).toBe(10);
      expect(sum([])).toBe(0);
    });

    it('should sort by property', () => {
      const items = [
        { name: 'c', val: 3 },
        { name: 'a', val: 1 },
        { name: 'b', val: 2 }
      ];
      
      const sorted = sortBy(items, 'val');
      expect(sorted[0].name).toBe('a');
      expect(sorted[1].name).toBe('b');
      expect(sorted[2].name).toBe('c');
    });
  });
});