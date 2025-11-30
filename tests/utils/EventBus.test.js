import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../../src/utils/EventBus.js";

describe("EventBus", () => {
  describe("emit and on", () => {
    it("should call handler when event is emitted", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();

      eventBus.on("test:event", handler);
      eventBus.emit("test:event");

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should pass detail to handler", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();
      const detail = { foo: "bar", count: 42 };

      eventBus.on("test:event", handler);
      eventBus.emit("test:event", detail);

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0];
      expect(event.detail).toEqual(detail);
    });

    it("should pass null detail when not provided", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();

      eventBus.on("test:event", handler);
      eventBus.emit("test:event");

      const event = handler.mock.calls[0][0];
      // CustomEvent defaults detail to null when undefined
      expect(event.detail).toBeNull();
    });

    it("should support multiple handlers for same event", () => {
      const eventBus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.on("test:event", handler1);
      eventBus.on("test:event", handler2);
      eventBus.on("test:event", handler3);
      eventBus.emit("test:event", "data");

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it("should not call handler for different event names", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();

      eventBus.on("test:one", handler);
      eventBus.emit("test:two");

      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle namespaced events correctly", () => {
      const eventBus = new EventBus();
      const simulationHandler = vi.fn();
      const gameHandler = vi.fn();

      eventBus.on("simulation:state_changed", simulationHandler);
      eventBus.on("game:started", gameHandler);

      eventBus.emit("simulation:state_changed", { state: "running" });

      expect(simulationHandler).toHaveBeenCalledTimes(1);
      expect(gameHandler).not.toHaveBeenCalled();
    });

    it("should call handler multiple times for multiple emits", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();

      eventBus.on("test:event", handler);
      eventBus.emit("test:event", 1);
      eventBus.emit("test:event", 2);
      eventBus.emit("test:event", 3);

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler.mock.calls[0][0].detail).toBe(1);
      expect(handler.mock.calls[1][0].detail).toBe(2);
      expect(handler.mock.calls[2][0].detail).toBe(3);
    });
  });

  describe("off", () => {
    it("should remove handler so it is not called", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();

      eventBus.on("test:event", handler);
      eventBus.emit("test:event");
      expect(handler).toHaveBeenCalledTimes(1);

      eventBus.off("test:event", handler);
      eventBus.emit("test:event");
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it("should only remove the specific handler", () => {
      const eventBus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on("test:event", handler1);
      eventBus.on("test:event", handler2);
      eventBus.off("test:event", handler1);
      eventBus.emit("test:event");

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should handle removing non-existent handler gracefully", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();

      // Should not throw
      expect(() => eventBus.off("test:event", handler)).not.toThrow();
    });
  });

  describe("AbortSignal support", () => {
    it("should remove handler when signal is aborted", () => {
      const eventBus = new EventBus();
      const controller = new AbortController();
      const handler = vi.fn();

      eventBus.on("test:event", handler, { signal: controller.signal });
      eventBus.emit("test:event");
      expect(handler).toHaveBeenCalledTimes(1);

      controller.abort();
      eventBus.emit("test:event");
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, handler removed
    });

    it("should pass signal option to addEventListener", () => {
      const eventBus = new EventBus();
      const controller = new AbortController();
      const handler = vi.fn();

      // Verify signal is properly passed through to addEventListener
      const addEventListenerSpy = vi.spyOn(eventBus, "addEventListener");

      eventBus.on("test:event", handler, { signal: controller.signal });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "test:event",
        handler,
        { signal: controller.signal }
      );
    });

    it("should support multiple handlers with different abort controllers", () => {
      const eventBus = new EventBus();
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on("test:event", handler1, { signal: controller1.signal });
      eventBus.on("test:event", handler2, { signal: controller2.signal });

      eventBus.emit("test:event");
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      controller1.abort();
      eventBus.emit("test:event");
      expect(handler1).toHaveBeenCalledTimes(1); // Removed
      expect(handler2).toHaveBeenCalledTimes(2); // Still active
    });
  });

  describe("event object", () => {
    it("should emit CustomEvent instances", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();

      eventBus.on("test:event", handler);
      eventBus.emit("test:event", { data: "test" });

      const event = handler.mock.calls[0][0];
      expect(event).toBeInstanceOf(CustomEvent);
      expect(event.type).toBe("test:event");
    });

    it("should allow complex detail objects", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();
      const complexDetail = {
        nested: { deeply: { value: 123 } },
        array: [1, 2, 3],
        fn: () => "test",
      };

      eventBus.on("test:event", handler);
      eventBus.emit("test:event", complexDetail);

      const event = handler.mock.calls[0][0];
      expect(event.detail.nested.deeply.value).toBe(123);
      expect(event.detail.array).toEqual([1, 2, 3]);
      expect(event.detail.fn()).toBe("test");
    });
  });

  describe("inheritance from EventTarget", () => {
    it("should be an instance of EventTarget", () => {
      const eventBus = new EventBus();
      expect(eventBus).toBeInstanceOf(EventTarget);
    });

    it("should support addEventListener directly", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();

      eventBus.addEventListener("test:event", handler);
      eventBus.emit("test:event", "data");

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should support dispatchEvent directly", () => {
      const eventBus = new EventBus();
      const handler = vi.fn();

      eventBus.on("test:event", handler);
      eventBus.dispatchEvent(new CustomEvent("test:event", { detail: "direct" }));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail).toBe("direct");
    });
  });
});
