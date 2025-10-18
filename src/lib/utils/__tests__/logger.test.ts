import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { log, logError, logPerformance } from "../logger";

describe("Logger Utility", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("log()", () => {
    it("should log structured JSON with timestamp, event, and environment", () => {
      log("test_event", { foo: "bar" });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

      expect(loggedData).toHaveProperty("timestamp");
      expect(loggedData.event).toBe("test_event");
      expect(loggedData.environment).toBe("development"); // Falls back to development in test env
      expect(loggedData.foo).toBe("bar");
    });

    it("should handle log events without additional data", () => {
      log("health_check");

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

      expect(loggedData).toHaveProperty("timestamp");
      expect(loggedData.event).toBe("health_check");
      expect(loggedData.environment).toBe("development");
    });

    it("should format timestamp as ISO 8601 string", () => {
      log("test_event");

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      const timestamp = new Date(loggedData.timestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(loggedData.timestamp);
    });
  });

  describe("logError()", () => {
    it("should log error with message and stack trace", () => {
      const error = new Error("Test error");
      logError("api_error", error, { operation: "test" });

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(loggedData.event).toBe("api_error");
      expect(loggedData.error).toBe("Test error");
      expect(loggedData.stack).toBeDefined();
      expect(loggedData.stack).toContain("Error: Test error");
      expect(loggedData.operation).toBe("test");
    });

    it("should handle string errors", () => {
      logError("api_error", "String error message");

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(loggedData.error).toBe("String error message");
      expect(loggedData.stack).toBeUndefined();
    });

    it("should include environment and timestamp", () => {
      logError("api_error", new Error("Test"));

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(loggedData).toHaveProperty("timestamp");
      expect(loggedData.environment).toBe("development");
    });
  });

  describe("logPerformance()", () => {
    it("should log performance metrics with duration", () => {
      logPerformance("file_upload_performance", 1250, {
        fileSize: 1024000,
        fileName: "test.pdf",
      });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

      expect(loggedData.event).toBe("file_upload_performance");
      expect(loggedData.durationMs).toBe(1250);
      expect(loggedData.fileSize).toBe(1024000);
      expect(loggedData.fileName).toBe("test.pdf");
    });

    it("should include timestamp and environment", () => {
      logPerformance("search_query_performance", 45);

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

      expect(loggedData).toHaveProperty("timestamp");
      expect(loggedData.environment).toBe("development");
      expect(loggedData.durationMs).toBe(45);
    });

    it("should handle performance logs without additional data", () => {
      logPerformance("operation_performance", 100);

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

      expect(loggedData.event).toBe("operation_performance");
      expect(loggedData.durationMs).toBe(100);
    });
  });

  describe("JSON output format", () => {
    it("should produce valid JSON for all log types", () => {
      log("test_log", { data: "value" });
      logError("test_error", new Error("Test"));
      logPerformance("test_perf", 100);

      expect(() =>
        JSON.parse(consoleLogSpy.mock.calls[0][0] as string),
      ).not.toThrow();
      expect(() =>
        JSON.parse(consoleErrorSpy.mock.calls[0][0] as string),
      ).not.toThrow();
      expect(() =>
        JSON.parse(consoleLogSpy.mock.calls[1][0] as string),
      ).not.toThrow();
    });
  });
});
