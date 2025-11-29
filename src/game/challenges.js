export const requirePassengerCountWithinTime = function (
  passengerCount,
  timeLimit,
) {
  return {
    description: `Transport <span class='emphasis-color'>${passengerCount}</span> people in <span class='emphasis-color'>${timeLimit.toFixed(0)}</span> seconds or less`,
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

export const requirePassengerCountWithMaxWaitTime = function (
  passengerCount,
  maxWaitTime,
) {
  return {
    description: `Transport <span class='emphasis-color'>${passengerCount}</span> people and let no one wait more than <span class='emphasis-color'>${maxWaitTime.toFixed(1)}</span> seconds`,
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

export const requirePassengerCountWithinTimeWithMaxWaitTime = function (
  passengerCount,
  timeLimit,
  maxWaitTime,
) {
  return {
    description: `Transport <span class='emphasis-color'>${passengerCount}</span> people in <span class='emphasis-color'>${timeLimit.toFixed(0)}</span> seconds or less and let no one wait more than <span class='emphasis-color'>${maxWaitTime.toFixed(1)}</span> seconds`,
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

export const requirePassengerCountWithinMoves = function (
  passengerCount,
  moveLimit,
) {
  return {
    description: `Transport <span class='emphasis-color'>${passengerCount}</span> people using <span class='emphasis-color'>${moveLimit}</span> elevator moves or less`,
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

export const requireDemo = function () {
  return {
    description: "Perpetual demo",
    evaluate: function () {
      return null;
    },
  };
};

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
