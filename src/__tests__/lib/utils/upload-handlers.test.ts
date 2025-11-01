import { describe, it, expect } from "vitest";
import { getFileExtension } from "../../../lib/utils/file-validation";

describe("upload-handlers", () => {
  describe("getFileExtension", () => {
    const sliceExtensions = [".gcode.3mf", ".gcode"];
    const modelExtensions = [".stl", ".3mf"];

    describe("multi-dot extension handling (.gcode.3mf)", () => {
      it("should detect .gcode.3mf correctly (not just .3mf)", () => {
        expect(getFileExtension("baby-whale.gcode.3mf", sliceExtensions)).toBe(
          ".gcode.3mf",
        );
      });

      it("should detect .gcode.3mf case-insensitively", () => {
        expect(getFileExtension("test.GCODE.3MF", sliceExtensions)).toBe(
          ".gcode.3mf",
        );
        expect(getFileExtension("test.Gcode.3Mf", sliceExtensions)).toBe(
          ".gcode.3mf",
        );
      });

      it("should match .3mf extension for test.gcode.3mf with model extensions", () => {
        // test.gcode.3mf ends with .3mf which IS in model extensions [".stl", ".3mf"]
        expect(getFileExtension("test.gcode.3mf", modelExtensions)).toBe(
          ".3mf",
        );
      });

      it("should always match the full extension .gcode.3mf regardless of order", () => {
        // With correct order [".gcode.3mf", ".gcode"]
        expect(getFileExtension("test.gcode.3mf", sliceExtensions)).toBe(
          ".gcode.3mf",
        );

        // Even with [".gcode", ".gcode.3mf"], endsWith() matches the full extension
        // because "test.gcode.3mf" does NOT end with ".gcode" (it ends with ".3mf")
        expect(
          getFileExtension("test.gcode.3mf", [".gcode", ".gcode.3mf"]),
        ).toBe(".gcode.3mf");
      });

      it("should handle complex filenames with multiple dots", () => {
        expect(
          getFileExtension("my.slice.v2.1.final.gcode.3mf", sliceExtensions),
        ).toBe(".gcode.3mf");
      });
    });

    describe("single-dot extension handling", () => {
      it("should detect .gcode", () => {
        expect(getFileExtension("baby-whale.gcode", sliceExtensions)).toBe(
          ".gcode",
        );
      });

      it("should detect .stl", () => {
        expect(getFileExtension("model.stl", modelExtensions)).toBe(".stl");
      });

      it("should detect .3mf for models", () => {
        expect(getFileExtension("model.3mf", modelExtensions)).toBe(".3mf");
      });

      it("should be case-insensitive", () => {
        expect(getFileExtension("model.STL", modelExtensions)).toBe(".stl");
        expect(getFileExtension("model.3MF", modelExtensions)).toBe(".3mf");
        expect(getFileExtension("slice.GCODE", sliceExtensions)).toBe(".gcode");
      });
    });

    describe("rejection cases", () => {
      it("should reject files with no extension", () => {
        expect(getFileExtension("no-extension", sliceExtensions)).toBe("");
      });

      it("should reject wrong file types", () => {
        expect(getFileExtension("model.stl", sliceExtensions)).toBe("");
        expect(getFileExtension("slice.gcode", modelExtensions)).toBe("");
        expect(getFileExtension("document.txt", sliceExtensions)).toBe("");
        expect(getFileExtension("archive.zip", sliceExtensions)).toBe("");
      });

      it("should reject .3mf without .gcode prefix for slices", () => {
        expect(getFileExtension("model.3mf", sliceExtensions)).toBe("");
      });
    });
  });
});
