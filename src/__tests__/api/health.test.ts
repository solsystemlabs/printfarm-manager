import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Health Check Endpoint Logging", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("GET /api/health", () => {
    it("should log structured health_check event", async () => {
      // Dynamic import to ensure logger is properly mocked
      const { Route } = await import("../../routes/api/health");

      const mockRequest = new Request("http://localhost:3000/api/health", {
        method: "GET",
      });

      // Execute the handler
      await Route.options.server!.handlers!.GET!({
        request: mockRequest,
      });

      // Verify logging occurred
      expect(consoleLogSpy).toHaveBeenCalled();

      // Find the health_check log entry
      const healthCheckLog = consoleLogSpy.mock.calls.find((call) => {
        try {
          const logData = JSON.parse(call[0] as string);
          return logData.event === "health_check";
        } catch {
          return false;
        }
      });

      expect(healthCheckLog).toBeDefined();

      const logData = JSON.parse(healthCheckLog![0] as string);

      // Verify log structure
      expect(logData).toHaveProperty("timestamp");
      expect(logData.event).toBe("health_check");
      expect(logData.environment).toBe("development");
      expect(logData.method).toBe("GET");
      expect(logData.path).toBe("/api/health");
      expect(logData.status).toBe(200);
      expect(logData).toHaveProperty("durationMs");
      expect(typeof logData.durationMs).toBe("number");
      expect(logData.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should include database configuration status in logs", async () => {
      const { Route } = await import("../../routes/api/health");

      const mockRequest = new Request("http://localhost:3000/api/health", {
        method: "GET",
      });

      await Route.options.server!.handlers!.GET!({ request: mockRequest });

      const healthCheckLog = consoleLogSpy.mock.calls.find((call) => {
        try {
          const logData = JSON.parse(call[0] as string);
          return logData.event === "health_check";
        } catch {
          return false;
        }
      });

      const logData = JSON.parse(healthCheckLog![0] as string);
      expect(logData).toHaveProperty("databaseConfigured");
      expect(typeof logData.databaseConfigured).toBe("boolean");
    });

    it("should return healthy status response", async () => {
      const { Route } = await import("../../routes/api/health");

      const mockRequest = new Request("http://localhost:3000/api/health", {
        method: "GET",
      });

      const response = await Route.options.server!.handlers!.GET!({
        request: mockRequest,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("status", "healthy");
      expect(data).toHaveProperty("environment");
      expect(data).toHaveProperty("timestamp");
    });
  });
});
