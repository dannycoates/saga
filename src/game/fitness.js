import { createWorldController, createWorldCreator } from '../core/World.js';
import { createFrameRequester, getCodeObjFromCode, map, sum, range } from '../core/utils.js';

const requireNothing = function() {
  return {
    description: "No requirement",
    evaluate: function() { 
      return null; 
    }
  };
};

export const fitnessChallenges = [
  {
    options: { 
      description: "Small scenario", 
      floorCount: 4, 
      elevatorCount: 2, 
      spawnRate: 0.6 
    }, 
    condition: requireNothing()
  },
  {
    options: { 
      description: "Medium scenario", 
      floorCount: 6, 
      elevatorCount: 3, 
      spawnRate: 1.5, 
      elevatorCapacities: [5] 
    }, 
    condition: requireNothing()
  },
  {
    options: { 
      description: "Large scenario", 
      floorCount: 18, 
      elevatorCount: 6, 
      spawnRate: 1.9, 
      elevatorCapacities: [8] 
    }, 
    condition: requireNothing()
  }
];

// Simulation without visualisation
export function calculateFitness(challenge, codeObj, stepSize, stepsToSimulate) {
  const controller = createWorldController(stepSize);
  const result = {};

  const worldCreator = createWorldCreator();
  const world = worldCreator.createWorld(challenge.options);
  const frameRequester = createFrameRequester(stepSize);

  controller.on("usercode_error", function(e) {
    result.error = e;
  });
  
  world.on("stats_changed", function() {
    result.transportedPerSec = world.transportedPerSec;
    result.avgWaitTime = world.avgWaitTime;
    result.transportedCount = world.transportedCounter;
  });

  controller.start(world, codeObj, frameRequester.register, true);

  for (let stepCount = 0; stepCount < stepsToSimulate && !controller.isPaused; stepCount++) {
    frameRequester.trigger();
  }
  return result;
}

function makeAverageResult(results) {
  const averagedResult = {};
  Object.keys(results[0].result).forEach(resultProperty => {
    const sum = results.reduce((acc, r) => acc + r.result[resultProperty], 0);
    averagedResult[resultProperty] = sum / results.length;
  });
  return { options: results[0].options, result: averagedResult };
}

export async function doFitnessSuite(codeStr, runCount) {
  try {
    const codeObj = await getCodeObjFromCode(codeStr);
  } catch(e) {
    return { error: "" + e };
  }
  
  console.log("Fitness testing code", codeObj);
  let error = null;

  const testruns = [];
  for (let i = 0; i < runCount; i++) {
    const results = fitnessChallenges.map(challenge => {
      const fitness = calculateFitness(challenge, codeObj, 1000.0/60.0, 12000);
      if (fitness.error) { 
        error = fitness.error; 
        return;
      }
      return { options: challenge.options, result: fitness };
    });
    if (error) { 
      break;
    }
    testruns.push(results);
  }
  
  if (error) {
    return { error: "" + error };
  }

  // Now do averaging over all properties for each challenge's test runs
  const averagedResults = range(0, testruns[0].length).map(n => {
    return makeAverageResult(testruns.map(run => run[n]));
  });
  
  return averagedResults;
}

export function fitnessSuite(codeStr, preferWorker, callback) {
  if (!!Worker && preferWorker) {
    // Web workers are available, neat.
    try {
      const w = new Worker(new URL('./fitness.worker.js', import.meta.url), { type: 'module' });
      w.postMessage(codeStr);
      w.onmessage = function(msg) {
        console.log("Got message from fitness worker", msg);
        const results = msg.data;
        callback(results);
      };
      return;
    } catch(e) {
      console.log("Fitness worker creation failed, falling back to normal", e);
    }
  }
  // Fall back do sync calculation without web worker
  doFitnessSuite(codeStr, 2).then(results => {
    callback(results);
  });
}