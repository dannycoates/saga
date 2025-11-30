import { Page, TestType } from "@playwright/test";

/**
 * Custom fixture types for Elevator Saga E2E tests
 */
interface CustomFixtures {
  /** Page fixture that waits for app initialization */
  appPage: Page;
  /** Page fixture with cleared localStorage and default time scale of 1x */
  cleanPage: Page;
}

export const test: TestType<CustomFixtures, object>;
export { expect } from "@playwright/test";

export const testCode: {
  simpleJS: string;
  syntaxErrorJS: string;
  runtimeErrorJS: string;
  simplePython: string;
  syntaxErrorPython: string;
  runtimeErrorPython: string;
  simpleJava: string;
  syntaxErrorJava: string;
  runtimeErrorJava: string;
  doNothingJS: string;
};
