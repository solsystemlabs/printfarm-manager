import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extractZipFile } from "../../../lib/zip/extractor";

/**
 * Helper function to create a test zip file with specified contents
 */
async function createTestZip(
  files: { path: string; content: string }[],
): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  return await zip.generateAsync({ type: "blob" });
}

/**
 * Helper function to create a corrupted zip blob
 */
function createCorruptedZip(): Blob {
  return new Blob(["This is not a valid zip file"], {
    type: "application/zip",
  });
}

describe("Zip Extractor", () => {
  describe("Valid Zip Extraction", () => {
    it("should extract valid .stl model files", async () => {
      const zipBlob = await createTestZip([
        { path: "model.stl", content: "STL content" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.models).toBe(1);
      expect(result.images).toBe(0);
      expect(result.files[0].filename).toBe("model.stl");
      expect(result.files[0].type).toBe("model");
    });

    it("should extract valid .3mf model files", async () => {
      const zipBlob = await createTestZip([
        { path: "model.3mf", content: "3MF content" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.models).toBe(1);
      expect(result.images).toBe(0);
      expect(result.files[0].filename).toBe("model.3mf");
      expect(result.files[0].type).toBe("model");
    });

    it("should extract valid .png image files", async () => {
      const zipBlob = await createTestZip([
        { path: "preview.png", content: "PNG content" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.models).toBe(0);
      expect(result.images).toBe(1);
      expect(result.files[0].filename).toBe("preview.png");
      expect(result.files[0].type).toBe("image");
    });

    it("should extract valid .jpg and .jpeg image files", async () => {
      const zipBlob = await createTestZip([
        { path: "photo1.jpg", content: "JPG content" },
        { path: "photo2.jpeg", content: "JPEG content" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(2);
      expect(result.models).toBe(0);
      expect(result.images).toBe(2);
    });

    it("should extract mixed model and image files", async () => {
      const zipBlob = await createTestZip([
        { path: "whale.stl", content: "STL content" },
        { path: "whale.3mf", content: "3MF content" },
        { path: "preview.png", content: "PNG content" },
        { path: "photo.jpg", content: "JPG content" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(4);
      expect(result.models).toBe(2);
      expect(result.images).toBe(2);
    });
  });

  describe("Nested Directory Scanning", () => {
    it("should extract files from nested directories", async () => {
      const zipBlob = await createTestZip([
        { path: "models/whale/baby-whale.stl", content: "STL content" },
        { path: "models/whale/images/preview.png", content: "PNG content" },
        { path: "images/gallery/photo1.jpg", content: "JPG content" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(3);
      expect(result.models).toBe(1);
      expect(result.images).toBe(2);

      // Verify paths are preserved
      const stlFile = result.files.find((f) => f.filename === "baby-whale.stl");
      expect(stlFile?.path).toBe("models/whale/baby-whale.stl");

      const pngFile = result.files.find((f) => f.filename === "preview.png");
      expect(pngFile?.path).toBe("models/whale/images/preview.png");
    });

    it("should handle deeply nested directory structures", async () => {
      const zipBlob = await createTestZip([
        {
          path: "level1/level2/level3/level4/deep-model.stl",
          content: "STL content",
        },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].path).toBe(
        "level1/level2/level3/level4/deep-model.stl",
      );
    });
  });

  describe("File Type Filtering", () => {
    it("should ignore non-whitelisted file types", async () => {
      const zipBlob = await createTestZip([
        { path: "model.stl", content: "STL content" },
        { path: "document.txt", content: "Text content" },
        { path: "script.js", content: "JavaScript content" },
        { path: "data.json", content: "JSON content" },
        { path: "readme.md", content: "Markdown content" },
      ]);

      const result = await extractZipFile(zipBlob);

      // Only the .stl file should be extracted
      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("model.stl");
    });

    it("should handle case-insensitive file extensions", async () => {
      const zipBlob = await createTestZip([
        { path: "model1.STL", content: "STL content" },
        { path: "model2.Stl", content: "STL content" },
        { path: "image.PNG", content: "PNG content" },
        { path: "photo.JPG", content: "JPG content" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(4);
      expect(result.models).toBe(2);
      expect(result.images).toBe(2);
    });
  });

  describe("Hidden File Exclusion", () => {
    it("should exclude .DS_Store files", async () => {
      const zipBlob = await createTestZip([
        { path: "model.stl", content: "STL content" },
        { path: ".DS_Store", content: "macOS metadata" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("model.stl");
    });

    it("should exclude __MACOSX directory files", async () => {
      const zipBlob = await createTestZip([
        { path: "model.stl", content: "STL content" },
        { path: "__MACOSX/._model.stl", content: "Resource fork" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("model.stl");
    });

    it("should exclude Thumbs.db files", async () => {
      const zipBlob = await createTestZip([
        { path: "image.png", content: "PNG content" },
        { path: "Thumbs.db", content: "Windows thumbnail cache" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("image.png");
    });

    it("should exclude hidden files starting with dot", async () => {
      const zipBlob = await createTestZip([
        { path: "model.stl", content: "STL content" },
        { path: ".gitignore", content: "Git ignore file" },
        { path: ".hidden.stl", content: "Hidden STL file" },
      ]);

      const result = await extractZipFile(zipBlob);

      // Only visible .stl file should be extracted (hidden .stl excluded)
      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("model.stl");
    });
  });

  describe("Empty Zip Handling", () => {
    it("should handle empty zip files", async () => {
      const zipBlob = await createTestZip([]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(0);
      expect(result.models).toBe(0);
      expect(result.images).toBe(0);
      expect(result.files).toEqual([]);
    });

    it("should handle zip with only directories (no files)", async () => {
      const zip = new JSZip();
      zip.folder("models");
      zip.folder("images");
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(0);
      expect(result.files).toEqual([]);
    });

    it("should handle zip with only non-whitelisted files", async () => {
      const zipBlob = await createTestZip([
        { path: "readme.txt", content: "Text content" },
        { path: "data.json", content: "JSON content" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(0);
      expect(result.files).toEqual([]);
    });
  });

  describe("Corrupted Zip Handling", () => {
    it("should throw error for corrupted zip files", async () => {
      const corruptedZip = createCorruptedZip();

      await expect(extractZipFile(corruptedZip)).rejects.toThrow();
    });

    it("should throw error for invalid zip data", async () => {
      const invalidZip = new Blob(["INVALID_ZIP_DATA"], {
        type: "application/zip",
      });

      await expect(extractZipFile(invalidZip)).rejects.toThrow();
    });
  });

  describe("File Metadata", () => {
    it("should include correct file metadata", async () => {
      const content = "This is STL file content";
      const zipBlob = await createTestZip([
        { path: "models/whale.stl", content },
      ]);

      const result = await extractZipFile(zipBlob);

      const file = result.files[0];
      expect(file.path).toBe("models/whale.stl");
      expect(file.filename).toBe("whale.stl");
      expect(file.type).toBe("model");
      expect(file.size).toBe(content.length);
      expect(file.content).toBeInstanceOf(Blob);
    });

    it("should preserve file content as Blob", async () => {
      const content = "STL file content";
      const zipBlob = await createTestZip([{ path: "model.stl", content }]);

      const result = await extractZipFile(zipBlob);

      // Verify it's a Blob and has the correct size
      expect(result.files[0].content).toBeInstanceOf(Blob);
      expect(result.files[0].content.size).toBeGreaterThan(0);
    });
  });

  describe("Large File Handling", () => {
    it("should handle files with multiple dots in filename", async () => {
      const zipBlob = await createTestZip([
        {
          path: "my.model.file.v2.final.stl",
          content: "STL content",
        },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("my.model.file.v2.final.stl");
      expect(result.files[0].type).toBe("model");
    });

    it("should handle filenames with spaces", async () => {
      const zipBlob = await createTestZip([
        { path: "my model file.stl", content: "STL content" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("my model file.stl");
    });

    it("should handle filenames with special characters", async () => {
      const zipBlob = await createTestZip([
        {
          path: "model_v2.1_final (copy).stl",
          content: "STL content",
        },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].filename).toBe("model_v2.1_final (copy).stl");
    });
  });

  describe("Statistics Calculation", () => {
    it("should correctly count models and images", async () => {
      const zipBlob = await createTestZip([
        { path: "model1.stl", content: "STL 1" },
        { path: "model2.stl", content: "STL 2" },
        { path: "model3.3mf", content: "3MF" },
        { path: "image1.png", content: "PNG 1" },
        { path: "image2.jpg", content: "JPG" },
        { path: "image3.jpeg", content: "JPEG" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(6);
      expect(result.models).toBe(3);
      expect(result.images).toBe(3);
    });

    it("should return zero counts for empty results", async () => {
      const zipBlob = await createTestZip([
        { path: "readme.txt", content: "Text" },
      ]);

      const result = await extractZipFile(zipBlob);

      expect(result.totalFiles).toBe(0);
      expect(result.models).toBe(0);
      expect(result.images).toBe(0);
    });
  });

  describe("Security - Path Traversal Protection", () => {
    it("should handle path traversal attempts in zip entries", async () => {
      // Create a zip with malicious path traversal attempts
      // JSZip normalizes paths automatically, so we test that normalized paths are used
      const zipBlob = await createTestZip([
        { path: "../../etc/passwd.stl", content: "Malicious STL" },
        {
          path: "../../../root/.ssh/id_rsa.stl",
          content: "Another malicious STL",
        },
        { path: "normal/model.stl", content: "Normal STL" },
      ]);

      const result = await extractZipFile(zipBlob);

      // All files should be extracted (JSZip normalizes the paths)
      expect(result.totalFiles).toBe(3);
      expect(result.models).toBe(3);

      // Verify that paths are safe (JSZip removes leading ../)
      // JSZip normalizes "../.." to just the filename
      const paths = result.files.map((f) => f.path);

      // Paths should not contain ".."
      for (const path of paths) {
        expect(path).not.toContain("..");
      }

      // Normalized paths should be returned
      // JSZip removes dangerous path components
      expect(paths).toContain("etc/passwd.stl");
      expect(paths).toContain("root/.ssh/id_rsa.stl");
      expect(paths).toContain("normal/model.stl");
    });

    it("should handle absolute paths in zip entries", async () => {
      // Test that absolute paths are handled
      // Note: JSZip preserves absolute paths as-is, but they're still contained
      // within the extraction context and can't escape to the filesystem
      const zipBlob = await createTestZip([
        { path: "/absolute/path/model.stl", content: "STL with absolute path" },
        { path: "/etc/passwd.stl", content: "Another absolute path" },
      ]);

      const result = await extractZipFile(zipBlob);

      // Files should be extracted
      expect(result.totalFiles).toBe(2);
      expect(result.models).toBe(2);

      // Verify files are present (JSZip preserves the paths as-is)
      const paths = result.files.map((f) => f.path);
      expect(paths).toContain("/absolute/path/model.stl");
      expect(paths).toContain("/etc/passwd.stl");

      // The key security point: these paths are contained within in-memory extraction
      // and are never written to filesystem, so absolute paths don't pose a risk
    });

    it("should handle complex path traversal patterns", async () => {
      // Test various path traversal patterns
      const zipBlob = await createTestZip([
        { path: "foo/../../bar/model.stl", content: "Complex pattern 1" },
        { path: "./hidden/./../file.stl", content: "Complex pattern 2" },
        { path: "a/b/c/../../../d/model.stl", content: "Complex pattern 3" },
      ]);

      const result = await extractZipFile(zipBlob);

      // All should be extracted with normalized paths
      expect(result.totalFiles).toBe(3);

      // Verify no ".." remains in paths
      for (const file of result.files) {
        expect(file.path).not.toContain("..");
      }
    });
  });
});
