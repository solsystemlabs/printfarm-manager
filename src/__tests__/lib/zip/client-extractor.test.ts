import { describe, it, expect, vi } from "vitest";
import JSZip from "jszip";
import {
  extractZipFile,
  type ExtractionResult,
} from "../../../lib/zip/client-extractor";

/**
 * Test suite for client-side zip extraction
 *
 * This tests the browser-based zip extraction utility that replaced
 * the server-side extraction due to Cloudflare Workers memory limits.
 */

// Helper to create a test zip file with various file types
async function createTestZip(files: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();

  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }

  return await zip.generateAsync({ type: "blob" });
}

// Helper to create a corrupted zip file
function createCorruptedZip(): Blob {
  return new Blob(["This is not a valid zip file"], {
    type: "application/zip",
  });
}

describe("extractZipFile", () => {
  describe("Valid Zip Extraction", () => {
    it("should extract .stl model files", async () => {
      const zipBlob = await createTestZip({
        "model.stl": "STL model content",
      });

      const result: ExtractionResult = await extractZipFile(zipBlob);

      expect(result.files).toHaveLength(1);
      expect(result.totalFiles).toBe(1);
      expect(result.models).toBe(1);
      expect(result.images).toBe(0);
      expect(result.files[0].filename).toBe("model.stl");
      expect(result.files[0].type).toBe("model");
    });

    it("should extract .3mf model files", async () => {
      const zipBlob = await createTestZip({
        "model.3mf": "3MF model content",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.files).toHaveLength(1);
      expect(result.models).toBe(1);
      expect(result.files[0].type).toBe("model");
    });

    it("should extract .png image files", async () => {
      const zipBlob = await createTestZip({
        "image.png": "PNG image content",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.files).toHaveLength(1);
      expect(result.images).toBe(1);
      expect(result.files[0].type).toBe("image");
    });

    it("should extract .jpg and .jpeg image files", async () => {
      const zipBlob = await createTestZip({
        "photo.jpg": "JPG image content",
        "picture.jpeg": "JPEG image content",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.files).toHaveLength(2);
      expect(result.images).toBe(2);
    });

    it("should extract multiple files of different types", async () => {
      const zipBlob = await createTestZip({
        "model1.stl": "STL content",
        "model2.3mf": "3MF content",
        "image1.png": "PNG content",
        "image2.jpg": "JPG content",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(4);
      expect(result.models).toBe(2);
      expect(result.images).toBe(2);
    });
  });

  describe("Nested Directory Scanning", () => {
    it("should extract files from nested directories", async () => {
      const zipBlob = await createTestZip({
        "level1/model.stl": "Nested model",
        "level1/level2/image.png": "Deeply nested image",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(2);
      expect(result.files[0].path).toBe("level1/model.stl");
      expect(result.files[1].path).toBe("level1/level2/image.png");
    });

    it("should handle deeply nested directory structures", async () => {
      const zipBlob = await createTestZip({
        "a/b/c/d/model.stl": "Very deeply nested",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe("a/b/c/d/model.stl");
      expect(result.files[0].filename).toBe("model.stl");
    });
  });

  describe("File Type Filtering", () => {
    it("should ignore non-whitelisted file types", async () => {
      const zipBlob = await createTestZip({
        "model.stl": "Valid model",
        "readme.txt": "Should be ignored",
        "script.js": "Should be ignored",
        "data.json": "Should be ignored",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("model.stl");
    });

    it("should handle case-insensitive extensions", async () => {
      const zipBlob = await createTestZip({
        "MODEL.STL": "Uppercase extension",
        "Image.PNG": "Mixed case extension",
        "photo.JpG": "Weird case extension",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(3);
      expect(result.models).toBe(1);
      expect(result.images).toBe(2);
    });
  });

  describe("Hidden File Exclusion", () => {
    it("should exclude .DS_Store files", async () => {
      const zipBlob = await createTestZip({
        "model.stl": "Valid model",
        ".DS_Store": "macOS metadata",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("model.stl");
    });

    it("should exclude __MACOSX directory files", async () => {
      const zipBlob = await createTestZip({
        "model.stl": "Valid model",
        "__MACOSX/._model.stl": "macOS resource fork",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("model.stl");
    });

    it("should exclude Thumbs.db files", async () => {
      const zipBlob = await createTestZip({
        "model.stl": "Valid model",
        "Thumbs.db": "Windows thumbnail cache",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("model.stl");
    });

    it("should exclude hidden files (starting with dot)", async () => {
      const zipBlob = await createTestZip({
        "model.stl": "Valid model",
        ".hidden": "Hidden file",
        "folder/.gitignore": "Hidden in folder",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("model.stl");
    });
  });

  describe("Empty Zip Handling", () => {
    it("should handle empty zip files", async () => {
      const zipBlob = await createTestZip({});

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(0);
      expect(result.models).toBe(0);
      expect(result.images).toBe(0);
      expect(result.files).toEqual([]);
    });

    it("should handle zip with only directories", async () => {
      const zip = new JSZip();
      zip.folder("empty-folder");
      zip.folder("another-folder/nested");
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(0);
      expect(result.files).toEqual([]);
    });

    it("should handle zip with only non-whitelisted files", async () => {
      const zipBlob = await createTestZip({
        "readme.txt": "Text file",
        "script.js": "JavaScript file",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(0);
    });
  });

  describe("Corrupted Zip Handling", () => {
    it("should throw error for corrupted zip files", async () => {
      const corruptedBlob = createCorruptedZip();

      await expect(extractZipFile(corruptedBlob)).rejects.toThrow();
    });

    it("should throw error for non-zip data", async () => {
      const notAZip = new Blob(["Random data"], { type: "text/plain" });

      await expect(extractZipFile(notAZip)).rejects.toThrow();
    });
  });

  describe("File Metadata", () => {
    it("should include correct metadata for each file", async () => {
      const zipBlob = await createTestZip({
        "models/whale.stl": "Model content",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.files[0]).toEqual({
        path: "models/whale.stl",
        filename: "whale.stl",
        type: "model",
        size: expect.any(Number),
        content: expect.any(Blob),
      });
    });

    it("should preserve file content as Blob", async () => {
      const originalContent = "This is test content for a model file";
      const zipBlob = await createTestZip({
        "model.stl": originalContent,
      });

      const result = await extractZipFile(zipBlob);

      // Verify content is a Blob and has correct size
      expect(result.files[0].content).toBeInstanceOf(Blob);
      expect(result.files[0].content.size).toBe(originalContent.length);
    });
  });

  describe("Edge Cases", () => {
    it("should handle filenames with multiple dots", async () => {
      const zipBlob = await createTestZip({
        "my.model.file.stl": "Model with dots",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.files[0].filename).toBe("my.model.file.stl");
      expect(result.files[0].type).toBe("model");
    });

    it("should handle filenames with spaces", async () => {
      const zipBlob = await createTestZip({
        "my model file.stl": "Model with spaces",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.files[0].filename).toBe("my model file.stl");
    });

    it("should handle filenames with special characters", async () => {
      const zipBlob = await createTestZip({
        "model (1) [final].stl": "Model with special chars",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.files[0].filename).toBe("model (1) [final].stl");
    });
  });

  describe("Statistics Calculation", () => {
    it("should correctly count models and images", async () => {
      const zipBlob = await createTestZip({
        "model1.stl": "Model 1",
        "model2.3mf": "Model 2",
        "model3.stl": "Model 3",
        "image1.png": "Image 1",
        "image2.jpg": "Image 2",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(5);
      expect(result.models).toBe(3);
      expect(result.images).toBe(2);
    });

    it("should not count excluded files in statistics", async () => {
      const zipBlob = await createTestZip({
        "model.stl": "Valid model",
        ".DS_Store": "Excluded",
        "readme.txt": "Excluded",
        "__MACOSX/resource": "Excluded",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.models).toBe(1);
      expect(result.images).toBe(0);
    });
  });

  describe("Progress Callback", () => {
    it("should call progress callback during extraction", async () => {
      const zipBlob = await createTestZip({
        "model1.stl": "Model 1",
        "model2.stl": "Model 2",
        "model3.stl": "Model 3",
      });

      const progressValues: number[] = [];
      const onProgress = vi.fn((progress: number) => {
        progressValues.push(progress);
      });

      await extractZipFile(zipBlob, onProgress);

      expect(onProgress).toHaveBeenCalled();
      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });

    it("should work without progress callback", async () => {
      const zipBlob = await createTestZip({
        "model.stl": "Model content",
      });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
    });
  });
});
