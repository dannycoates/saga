import { doFitnessSuite } from './fitness.js';

self.onmessage = async function(msg) {
  // Assume it is a code object that should be fitness-tested
  const codeStr = msg.data;
  const results = await doFitnessSuite(codeStr, 6);
  console.log("Posting message back", results);
  self.postMessage(results);
};