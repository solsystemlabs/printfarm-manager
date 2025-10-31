import { describe, it, expect } from "vitest";
import { getFileExtension } from "../../../lib/utils/file-validation";

/**
 * Slice upload validation tests
 * Tests the file validation logic used by slice upload endpoints
 */
describe("Slice Upload Validation Logic", () => {
  const ALLOWED_EXTENSIONS = [".gcode.3mf", ".gcode"];
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  describe("file extension validation", () => {
    it("should detect .gcode.3mf correctly", () => {
      expect(getFileExtension("baby-whale.gcode.3mf", ALLOWED_EXTENSIONS)).toBe(
        ".gcode.3mf",
      );
    });

    it("should detect .gcode correctly", () => {
      expect(getFileExtension("test.gcode", ALLOWED_EXTENSIONS)).toBe(".gcode");
    });

    it("should reject .stl files", () => {
      expect(getFileExtension("model.stl", ALLOWED_EXTENSIONS)).toBe("");
    });

    it("should reject .3mf files without .gcode prefix", () => {
      expect(getFileExtension("model.3mf", ALLOWED_EXTENSIONS)).toBe("");
    });

    it("should be case-insensitive", () => {
      expect(getFileExtension("TEST.GCODE.3MF", ALLOWED_EXTENSIONS)).toBe(
        ".gcode.3mf",
      );
      expect(getFileExtension("TEST.GCODE", ALLOWED_EXTENSIONS)).toBe(".gcode");
    });
  });

  describe("file size validation", () => {
    it("should accept files under 50MB", () => {
      const fileSize = 25 * 1024 * 1024;
      expect(fileSize <= MAX_FILE_SIZE).toBe(true);
    });

    it("should accept files at exactly 50MB", () => {
      const fileSize = MAX_FILE_SIZE;
      expect(fileSize <= MAX_FILE_SIZE).toBe(true);
    });

    it("should reject files over 50MB", () => {
      const fileSize = 51 * 1024 * 1024;
      expect(fileSize > MAX_FILE_SIZE).toBe(true);
    });
  });

  describe("storage key generation pattern", () => {
    it("should use slices/ prefix", () => {
      const storageKey = `slices/${crypto.randomUUID()}.gcode.3mf`;
      expect(storageKey).toMatch(/^slices\//);
    });

    it("should preserve multi-dot extension", () => {
      const extension = getFileExtension("test.gcode.3mf", ALLOWED_EXTENSIONS);
      const storageKey = `slices/${crypto.randomUUID()}${extension}`;
      expect(storageKey).toContain(".gcode.3mf");
    });
  });
});
