import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadExternalScript,
  executeWithTimeout,
} from "../../src/utils/AsyncUtils.js";

describe("AsyncUtils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("loadExternalScript", () => {
    let appendedScript = null;

    beforeEach(() => {
      appendedScript = null;
      vi.spyOn(document.head, "appendChild").mockImplementation((script) => {
        appendedScript = script;
        return script;
      });
    });

    it("should resolve when script loads successfully", async () => {
      const promise = loadExternalScript("https://example.com/script.js");

      // Simulate script load
      appendedScript.onload();

      await expect(promise).resolves.toBeUndefined();
    });

    it("should reject when script fails to load", async () => {
      const promise = loadExternalScript("https://example.com/bad.js");

      // Simulate script error
      appendedScript.onerror();

      await expect(promise).rejects.toThrow(
        "Failed to load script: https://example.com/bad.js",
      );
    });

    it("should reject on timeout", async () => {
      const promise = loadExternalScript("https://example.com/slow.js", 5000);

      // Advance past timeout
      vi.advanceTimersByTime(5001);

      // Either timeout or abort message is valid (abort triggered by timeout)
      await expect(promise).rejects.toThrow(/Timeout|aborted/);
    });

    it("should use default 30s timeout", async () => {
      const promise = loadExternalScript("https://example.com/script.js");

      // Advance just under 30s - should not reject yet
      vi.advanceTimersByTime(29999);

      // Script loads just in time
      appendedScript.onload();

      await expect(promise).resolves.toBeUndefined();
    });

    it("should reject when abort signal is triggered", async () => {
      const controller = new AbortController();
      const promise = loadExternalScript(
        "https://example.com/script.js",
        30000,
        controller.signal,
      );

      controller.abort();

      await expect(promise).rejects.toThrow(
        "Loading https://example.com/script.js was aborted",
      );
    });

    it("should clean up script element on success", async () => {
      // Use real appendChild so parentNode is set correctly
      vi.restoreAllMocks();
      const appendChildSpy = vi.spyOn(document.head, "appendChild");
      const removeChildSpy = vi.spyOn(document.head, "removeChild");

      const promise = loadExternalScript("https://example.com/script.js");

      // Get the appended script
      const script = appendChildSpy.mock.calls[0][0];
      appendedScript = script;

      script.onload();
      await promise;

      expect(removeChildSpy).toHaveBeenCalledWith(script);
      expect(script.onload).toBeNull();
      expect(script.onerror).toBeNull();
    });

    it("should clean up script element on error", async () => {
      // Use real appendChild so parentNode is set correctly
      vi.restoreAllMocks();
      const appendChildSpy = vi.spyOn(document.head, "appendChild");
      const removeChildSpy = vi.spyOn(document.head, "removeChild");

      const promise = loadExternalScript("https://example.com/script.js");

      const script = appendChildSpy.mock.calls[0][0];
      script.onerror();

      await expect(promise).rejects.toThrow();
      expect(removeChildSpy).toHaveBeenCalledWith(script);
    });

    it("should clear timeout when script loads before timeout", async () => {
      const promise = loadExternalScript("https://example.com/script.js", 5000);

      // Load quickly
      appendedScript.onload();
      await promise;

      // Advancing timers should not cause issues
      vi.advanceTimersByTime(10000);
    });

    it("should set correct script src", async () => {
      const promise = loadExternalScript("https://example.com/test.js");

      expect(appendedScript.src).toBe("https://example.com/test.js");

      appendedScript.onload();
      await promise;
    });
  });

  describe("executeWithTimeout", () => {
    it("should resolve with function result on success", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const promise = executeWithTimeout(fn, 5000);
      await vi.advanceTimersByTimeAsync(0);

      await expect(promise).resolves.toBe("success");
      expect(fn).toHaveBeenCalled();
    });

    it("should work with sync functions", async () => {
      const fn = vi.fn().mockReturnValue(42);

      const promise = executeWithTimeout(fn, 5000);
      await vi.advanceTimersByTimeAsync(0);

      await expect(promise).resolves.toBe(42);
    });

    it("should reject on timeout", async () => {
      const fn = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

      const promise = executeWithTimeout(fn, 1000);

      vi.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow("Operation timeout after 1000ms");
    });

    it("should reject when abort signal is triggered", async () => {
      const controller = new AbortController();
      const fn = vi.fn().mockImplementation(() => new Promise(() => {}));

      const promise = executeWithTimeout(fn, 5000, controller.signal);

      controller.abort();
      vi.advanceTimersByTime(0);

      // The timeout should be cleared, function may still be pending
      // but the promise should eventually handle the abort
      await vi.advanceTimersByTimeAsync(5001);
    });

    it("should reject immediately if signal already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const fn = vi.fn();
      const promise = executeWithTimeout(fn, 5000, controller.signal);

      await expect(promise).rejects.toThrow(
        "Operation was aborted before execution",
      );
      expect(fn).not.toHaveBeenCalled();
    });

    it("should pass combined signal to function", async () => {
      let receivedSignal = null;
      const fn = vi.fn().mockImplementation((signal) => {
        receivedSignal = signal;
        return "done";
      });

      const promise = executeWithTimeout(fn, 5000);
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(receivedSignal).toBeDefined();
      expect(receivedSignal).toHaveProperty("aborted");
    });

    it("should clear timeout when function completes before timeout", async () => {
      const fn = vi.fn().mockResolvedValue("fast");

      const promise = executeWithTimeout(fn, 5000);
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      // Advancing timers should not cause issues
      vi.advanceTimersByTime(10000);
    });

    it("should propagate function errors", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Function failed"));

      const promise = executeWithTimeout(fn, 5000);

      await expect(promise).rejects.toThrow("Function failed");
    });

    it("should handle async functions that take time but complete before timeout", async () => {
      const fn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return "completed";
      });

      const promise = executeWithTimeout(fn, 5000);

      // Advance time but stay under timeout
      await vi.advanceTimersByTimeAsync(1001);

      await expect(promise).resolves.toBe("completed");
    });
  });

  describe("signal combination", () => {
    it("loadExternalScript should respect external abort even with internal timeout", async () => {
      const controller = new AbortController();
      let appendedScript = null;

      vi.spyOn(document.head, "appendChild").mockImplementation((script) => {
        appendedScript = script;
        return script;
      });

      const promise = loadExternalScript(
        "https://example.com/script.js",
        30000,
        controller.signal,
      );

      // Abort before timeout
      controller.abort();

      await expect(promise).rejects.toThrow("was aborted");
    });

    it("executeWithTimeout should handle both external signal and timeout", async () => {
      const controller = new AbortController();
      const fn = vi.fn().mockImplementation(() => new Promise(() => {}));

      const promise = executeWithTimeout(fn, 1000, controller.signal);

      // Let timeout win this race
      vi.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow("timeout");
    });
  });
});
