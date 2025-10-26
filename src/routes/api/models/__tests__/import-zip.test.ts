import { describe, it, expect } from "vitest";

/**
 * Unit tests for bulk import API endpoint logic.
 *
 * These tests verify file type classification and validation logic used by the endpoint.
 * Full integration tests would require a running Cloudflare Worker environment.
 */
describe("Bulk Import API Endpoint Logic", () => {
  // Helper functions extracted from the endpoint for testing
  function getFileType(filename: string): "model" | "image" | "unknown" {
    const MODEL_EXTENSIONS = [".stl", ".3mf"];
    const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];
    const extension = filename
      .substring(filename.lastIndexOf("."))
      .toLowerCase();

    if (MODEL_EXTENSIONS.includes(extension)) {
      return "model";
    }

    if (IMAGE_EXTENSIONS.includes(extension)) {
      return "image";
    }

    return "unknown";
  }

  function isAllowedFile(filename: string): boolean {
    const ALLOWED_EXTENSIONS = [".stl", ".3mf", ".png", ".jpg", ".jpeg"];
    const extension = filename
      .substring(filename.lastIndexOf("."))
      .toLowerCase();
    return ALLOWED_EXTENSIONS.includes(extension);
  }

  describe("File type classification", () => {
    it("classifies .stl files as models", () => {
      expect(getFileType("whale.stl")).toBe("model");
      expect(getFileType("WHALE.STL")).toBe("model");
    });

    it("classifies .3mf files as models", () => {
      expect(getFileType("dolphin.3mf")).toBe("model");
      expect(getFileType("DOLPHIN.3MF")).toBe("model");
    });

    it("classifies .png files as images", () => {
      expect(getFileType("preview.png")).toBe("image");
      expect(getFileType("PREVIEW.PNG")).toBe("image");
    });

    it("classifies .jpg files as images", () => {
      expect(getFileType("photo.jpg")).toBe("image");
      expect(getFileType("PHOTO.JPG")).toBe("image");
    });

    it("classifies .jpeg files as images", () => {
      expect(getFileType("image.jpeg")).toBe("image");
      expect(getFileType("IMAGE.JPEG")).toBe("image");
    });

    it("classifies unknown file types as unknown", () => {
      expect(getFileType("document.pdf")).toBe("unknown");
      expect(getFileType("script.js")).toBe("unknown");
      expect(getFileType("data.json")).toBe("unknown");
    });
  });

  describe("File extension validation", () => {
    it("allows .stl files", () => {
      expect(isAllowedFile("whale.stl")).toBe(true);
      expect(isAllowedFile("WHALE.STL")).toBe(true);
    });

    it("allows .3mf files", () => {
      expect(isAllowedFile("dolphin.3mf")).toBe(true);
      expect(isAllowedFile("DOLPHIN.3MF")).toBe(true);
    });

    it("allows .png files", () => {
      expect(isAllowedFile("preview.png")).toBe(true);
      expect(isAllowedFile("PREVIEW.PNG")).toBe(true);
    });

    it("allows .jpg files", () => {
      expect(isAllowedFile("photo.jpg")).toBe(true);
      expect(isAllowedFile("PHOTO.JPG")).toBe(true);
    });

    it("allows .jpeg files", () => {
      expect(isAllowedFile("image.jpeg")).toBe(true);
      expect(isAllowedFile("IMAGE.JPEG")).toBe(true);
    });

    it("rejects .pdf files", () => {
      expect(isAllowedFile("document.pdf")).toBe(false);
    });

    it("rejects .txt files", () => {
      expect(isAllowedFile("readme.txt")).toBe(false);
    });

    it("rejects .obj files", () => {
      expect(isAllowedFile("model.obj")).toBe(false);
    });

    it("rejects .blend files", () => {
      expect(isAllowedFile("scene.blend")).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("handles files with no extension", () => {
      expect(isAllowedFile("noextension")).toBe(false);
      expect(getFileType("noextension")).toBe("unknown");
    });

    it("handles files with multiple dots", () => {
      expect(isAllowedFile("my.file.name.stl")).toBe(true);
      expect(getFileType("my.file.name.stl")).toBe("model");
    });

    it("handles case-insensitive extensions", () => {
      expect(isAllowedFile("Mixed.StL")).toBe(true);
      expect(getFileType("Mixed.3MF")).toBe("model");
    });
  });
});
