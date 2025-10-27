import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileSelectionGrid } from "../FileSelectionGrid";
import type { ExtractedFile } from "~/lib/zip/client-extractor";

describe("FileSelectionGrid", () => {
  // Mock URL.createObjectURL and revokeObjectURL (not available in Node.js)
  beforeAll(() => {
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });
  const mockFiles: ExtractedFile[] = [
    {
      path: "models/whale.stl",
      filename: "whale.stl",
      type: "model",
      size: 1024000,
      content: new Blob(["mock"], { type: "application/octet-stream" }),
    },
    {
      path: "images/preview.png",
      filename: "preview.png",
      type: "image",
      size: 512000,
      content: new Blob(["mock"], { type: "image/png" }),
    },
    {
      path: "models/dolphin.3mf",
      filename: "dolphin.3mf",
      type: "model",
      size: 2048000,
      content: new Blob(["mock"], { type: "application/octet-stream" }),
    },
  ];

  it("renders all files in a grid", () => {
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    expect(screen.getByText("whale.stl")).toBeInTheDocument();
    expect(screen.getByText("preview.png")).toBeInTheDocument();
    expect(screen.getByText("dolphin.3mf")).toBeInTheDocument();
  });

  it("selects all files by default", () => {
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Should show "3 files selected / 3 total"
    expect(screen.getByText(/3 files selected \/ 3 total/)).toBeInTheDocument();

    // All checkboxes should be checked
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeChecked();
    });
  });

  it("calls onSelectionChange with all files initially", () => {
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Should be called with all files (default selection)
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining(mockFiles),
    );
  });

  it("toggles individual file selection", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Find the checkbox for whale.stl (first checkbox)
    const checkboxes = screen.getAllByRole("checkbox");
    const whaleCheckbox = checkboxes[0];

    // Click to deselect
    await user.click(whaleCheckbox);

    // Should now show "2 files selected / 3 total"
    expect(screen.getByText(/2 files selected \/ 3 total/)).toBeInTheDocument();

    // onSelectionChange should be called with only 2 files
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([mockFiles[1], mockFiles[2]]),
    );
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.not.arrayContaining([mockFiles[0]]),
    );
  });

  it("deselects all files when Deselect All is clicked", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Click Deselect All button
    const deselectButton = screen.getByRole("button", {
      name: /deselect all/i,
    });
    await user.click(deselectButton);

    // Should show "0 files selected / 3 total"
    expect(screen.getByText(/0 files selected \/ 3 total/)).toBeInTheDocument();

    // onSelectionChange should be called with empty array
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it("selects all files when Select All is clicked after deselection", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    // First deselect all
    const buttons = screen.getAllByRole("button");
    const deselectButton = buttons.find((btn) =>
      btn.textContent?.includes("Deselect All"),
    )!;
    await user.click(deselectButton);

    // Then select all
    const selectButton = buttons.find((btn) =>
      btn.textContent?.includes("Select All"),
    )!;
    await user.click(selectButton);

    // Should show "3 files selected / 3 total"
    expect(screen.getByText(/3 files selected \/ 3 total/)).toBeInTheDocument();

    // onSelectionChange should be called with all files
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.arrayContaining(mockFiles),
    );
  });

  it("disables Select All button when all files are already selected", () => {
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const selectButton = buttons.find((btn) =>
      btn.textContent?.includes("Select All"),
    )!;
    expect(selectButton).toBeDisabled();
  });

  it("disables Deselect All button when no files are selected", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Deselect all files
    const deselectButton = screen.getByRole("button", {
      name: /deselect all/i,
    });
    await user.click(deselectButton);

    // Deselect All button should now be disabled
    expect(deselectButton).toBeDisabled();
  });

  it("displays file metadata correctly", () => {
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Check file sizes are displayed in human-readable format
    expect(screen.getByText("1000 KB")).toBeInTheDocument(); // whale.stl
    expect(screen.getByText("500 KB")).toBeInTheDocument(); // preview.png
    expect(screen.getByText("1.95 MB")).toBeInTheDocument(); // dolphin.3mf (2048000 bytes)

    // Check file type badges
    const modelBadges = screen.getAllByText("model");
    expect(modelBadges).toHaveLength(2); // whale.stl and dolphin.3mf

    const imageBadges = screen.getAllByText("image");
    expect(imageBadges).toHaveLength(1); // preview.png
  });

  it("shows empty state when no files are provided", () => {
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid files={[]} onSelectionChange={onSelectionChange} />,
    );

    expect(
      screen.getByText(/no files available for selection/i),
    ).toBeInTheDocument();
  });

  it("displays correct selection count summary", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Initially: "3 files selected / 3 total"
    expect(screen.getByText(/3 files selected \/ 3 total/)).toBeInTheDocument();

    // Deselect one file
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    // Should update to "2 files selected / 3 total"
    expect(screen.getByText(/2 files selected \/ 3 total/)).toBeInTheDocument();
  });

  it("uses singular 'file' when only one file is selected", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <FileSelectionGrid
        files={mockFiles}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Deselect all
    const deselectButton = screen.getByRole("button", {
      name: /deselect all/i,
    });
    await user.click(deselectButton);

    // Select one file
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    // Should show "1 file selected / 3 total" (singular)
    expect(screen.getByText(/1 file selected \/ 3 total/)).toBeInTheDocument();
  });
});
