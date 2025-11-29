/**
 * @typedef {import('./GameController.js').ChallengeCondition} ChallengeCondition
 * @typedef {import('../core/SimulationBackend.js').SimulationStats} SimulationStats
 */

/**
 * Creates a challenge condition requiring passengers transported within a time limit.
 * @param {number} passengerCount - Number of passengers to transport
 * @param {number} timeLimit - Time limit in seconds
 * @returns {ChallengeCondition}
 */
export const requirePassengerCountWithinTime = function (
  passengerCount,
  timeLimit,
) {
  return {
    description: `Transport <span class='emphasis-color'>${passengerCount}</span> people in <span class='emphasis-color'>${timeLimit.toFixed(0)}</span> seconds or less`,
    /**
     * @param {SimulationStats} world - Current simulation stats
     * @returns {boolean | null} True if won, false if lost, null if in progress
     */
    evaluate: function (world) {
      if (
        world.elapsedTime >= timeLimit ||
        world.transportedCount >= passengerCount
      ) {
        return (
          world.elapsedTime <= timeLimit &&
          world.transportedCount >= passengerCount
        );
      } else {
        return null;
      }
    },
  };
};

/**
 * Creates a challenge condition requiring passengers transported with max wait time limit.
 * @param {number} passengerCount - Number of passengers to transport
 * @param {number} maxWaitTime - Maximum wait time allowed in seconds
 * @returns {ChallengeCondition}
 */
export const requirePassengerCountWithMaxWaitTime = function (
  passengerCount,
  maxWaitTime,
) {
  return {
    description: `Transport <span class='emphasis-color'>${passengerCount}</span> people and let no one wait more than <span class='emphasis-color'>${maxWaitTime.toFixed(1)}</span> seconds`,
    /**
     * @param {SimulationStats} world - Current simulation stats
     * @returns {boolean | null} True if won, false if lost, null if in progress
     */
    evaluate: function (world) {
      if (
        world.maxWaitTime >= maxWaitTime ||
        world.transportedCount >= passengerCount
      ) {
        return (
          world.maxWaitTime <= maxWaitTime &&
          world.transportedCount >= passengerCount
        );
      } else {
        return null;
      }
    },
  };
};

/**
 * Creates a challenge condition with both time limit and max wait time constraints.
 * @param {number} passengerCount - Number of passengers to transport
 * @param {number} timeLimit - Time limit in seconds
 * @param {number} maxWaitTime - Maximum wait time allowed in seconds
 * @returns {ChallengeCondition}
 */
export const requirePassengerCountWithinTimeWithMaxWaitTime = function (
  passengerCount,
  timeLimit,
  maxWaitTime,
) {
  return {
    description: `Transport <span class='emphasis-color'>${passengerCount}</span> people in <span class='emphasis-color'>${timeLimit.toFixed(0)}</span> seconds or less and let no one wait more than <span class='emphasis-color'>${maxWaitTime.toFixed(1)}</span> seconds`,
    /**
     * @param {SimulationStats} world - Current simulation stats
     * @returns {boolean | null} True if won, false if lost, null if in progress
     */
    evaluate: function (world) {
      if (
        world.elapsedTime >= timeLimit ||
        world.maxWaitTime >= maxWaitTime ||
        world.transportedCount >= passengerCount
      ) {
        return (
          world.elapsedTime <= timeLimit &&
          world.maxWaitTime <= maxWaitTime &&
          world.transportedCount >= passengerCount
        );
      } else {
        return null;
      }
    },
  };
};

/**
 * Creates a challenge condition requiring passengers transported within move limit.
 * @param {number} passengerCount - Number of passengers to transport
 * @param {number} moveLimit - Maximum number of elevator moves allowed
 * @returns {ChallengeCondition}
 */
export const requirePassengerCountWithinMoves = function (
  passengerCount,
  moveLimit,
) {
  return {
    description: `Transport <span class='emphasis-color'>${passengerCount}</span> people using <span class='emphasis-color'>${moveLimit}</span> elevator moves or less`,
    /**
     * @param {SimulationStats} world - Current simulation stats
     * @returns {boolean | null} True if won, false if lost, null if in progress
     */
    evaluate: function (world) {
      if (
        world.moveCount >= moveLimit ||
        world.transportedCount >= passengerCount
      ) {
        return (
          world.moveCount <= moveLimit &&
          world.transportedCount >= passengerCount
        );
      } else {
        return null;
      }
    },
  };
};

/**
 * Creates a perpetual demo condition that never ends.
 * @returns {ChallengeCondition}
 */
export const requireDemo = function () {
  return {
    description: "Perpetual demo",
    /**
     * @returns {null} Always returns null (never ends)
     */
    evaluate: function () {
      return null;
    },
  };
};

/**
 * Array of all game challenges in order of difficulty.
 * @type {Array<import('./GameController.js').Challenge>}
 */
export const challenges = [
  {
    options: { floorCount: 3, elevatorCount: 1, spawnRate: 0.3 },
    condition: requirePassengerCountWithinTime(15, 60),
  },
  {
    options: {
      floorCount: 5,
      elevatorCount: 1,
      spawnRate: 0.5,
      elevatorCapacities: [6],
    },
    condition: requirePassengerCountWithinTime(23, 60),
  },
  {
    options: { floorCount: 8, elevatorCount: 2, spawnRate: 0.6 },
    condition: requirePassengerCountWithinTime(26, 60),
  },
  {
    options: { floorCount: 6, elevatorCount: 4, spawnRate: 1.7 },
    condition: requirePassengerCountWithinTime(100, 68),
  },
  {
    options: {
      floorCount: 6,
      elevatorCount: 2,
      spawnRate: 0.4,
      elevatorCapacities: [5],
    },
    condition: requirePassengerCountWithMaxWaitTime(50, 21),
  },
  {
    options: { floorCount: 7, elevatorCount: 3, spawnRate: 0.6 },
    condition: requirePassengerCountWithMaxWaitTime(50, 20),
  },
  {
    options: {
      floorCount: 13,
      elevatorCount: 2,
      spawnRate: 1.1,
      elevatorCapacities: [8, 10],
    },
    condition: requirePassengerCountWithinTime(50, 70),
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1 },
    condition: requirePassengerCountWithMaxWaitTime(60, 19),
  },
  {
    options: { floorCount: 9, elevatorCount: 5, spawnRate: 1.1 },
    condition: requirePassengerCountWithMaxWaitTime(80, 17),
  },
  {
    options: {
      floorCount: 9,
      elevatorCount: 6,
      spawnRate: 1.1,
      elevatorCapacities: [4],
    },
    condition: requirePassengerCountWithMaxWaitTime(100, 16),
  },
  {
    options: {
      floorCount: 9,
      elevatorCount: 6,
      spawnRate: 1.0,
      elevatorCapacities: [5],
    },
    condition: requirePassengerCountWithMaxWaitTime(110, 15),
  },
  {
    options: { floorCount: 8, elevatorCount: 6, spawnRate: 0.9 },
    condition: requirePassengerCountWithMaxWaitTime(120, 15),
  },
  {
    options: {
      floorCount: 12,
      elevatorCount: 4,
      spawnRate: 1.4,
      elevatorCapacities: [5, 10],
    },
    condition: requirePassengerCountWithinTime(70, 80),
  },
  {
    options: {
      floorCount: 21,
      elevatorCount: 5,
      spawnRate: 1.9,
      elevatorCapacities: [10],
    },
    condition: requirePassengerCountWithinTime(110, 80),
  },
  {
    options: {
      floorCount: 21,
      elevatorCount: 8,
      spawnRate: 1.5,
      elevatorCapacities: [6, 8],
    },
    condition: requirePassengerCountWithinTimeWithMaxWaitTime(2675, 1800, 45),
  },
  {
    options: {
      floorCount: 21,
      elevatorCount: 8,
      spawnRate: 1.5,
      elevatorCapacities: [6, 8],
    },
    condition: requireDemo(),
  },
];
