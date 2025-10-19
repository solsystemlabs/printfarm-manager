import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route } from "../../../routes/admin/storage";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("Storage Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockStorageData = {
    totalBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    totalFiles: 150,
    breakdown: {
      models: { count: 100, bytes: 3 * 1024 * 1024 * 1024 },
      slices: { count: 50, bytes: 2 * 1024 * 1024 * 1024 },
      images: { count: 0, bytes: 0 },
    },
    percentOfLimit: 50,
    lastCalculated: new Date("2025-01-15T10:30:00Z").toISOString(),
    source: "hybrid" as const,
  };

  it("renders storage dashboard with data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStorageData,
    } as Response);

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("Storage Usage Dashboard")).toBeInTheDocument();
    });

    // Check total storage display
    expect(screen.getByText("5.00 GB")).toBeInTheDocument();
    expect(screen.getByText("150 files stored")).toBeInTheDocument();

    // Check percentage display
    expect(screen.getByText(/50.00% of 10GB free tier/)).toBeInTheDocument();
  });

  it("displays breakdown cards for each file type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStorageData,
    } as Response);

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("3D Models")).toBeInTheDocument();
    });

    expect(screen.getByText("Sliced Files")).toBeInTheDocument();
    expect(screen.getByText("Images")).toBeInTheDocument();

    // Check file type subtitles
    expect(screen.getByText(".stl, .3mf")).toBeInTheDocument();
    expect(screen.getByText(".gcode.3mf, .gcode")).toBeInTheDocument();
    expect(screen.getByText(".png, .jpg")).toBeInTheDocument();

    // Check counts
    expect(screen.getByText("100 files")).toBeInTheDocument();
    expect(screen.getByText("50 files")).toBeInTheDocument();
  });

  it("displays warning when storage exceeds 80%", async () => {
    const warningData = {
      ...mockStorageData,
      totalBytes: 8.5 * 1024 * 1024 * 1024, // 8.5 GB
      percentOfLimit: 85,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => warningData,
    });

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("Storage Limit Warning")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/You're using 85.0% of your 10GB free tier limit/),
    ).toBeInTheDocument();
  });

  it("does not display warning when storage below 80%", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStorageData, // 50%
    });

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("Storage Usage Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Storage Limit Warning")).not.toBeInTheDocument();
  });

  it("displays correct data source badge for hybrid mode", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockStorageData, source: "hybrid" }),
    });

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(
        screen.getByText(/Hybrid \(R2 totals \+ Database breakdown\)/),
      ).toBeInTheDocument();
    });
  });

  it("displays correct data source badge for database mode", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockStorageData, source: "database" }),
    });

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText(/Database Only/)).toBeInTheDocument();
    });
  });

  it("handles refresh button click", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStorageData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockStorageData,
          totalBytes: 6 * 1024 * 1024 * 1024, // 6 GB after refresh
        }),
      });

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("5.00 GB")).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole("button", { name: /Refresh/ });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText("6.00 GB")).toBeInTheDocument();
    });
  });

  it("disables refresh button while fetching", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStorageData,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockStorageData,
                }),
              100,
            ),
          ),
      );

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("Storage Usage Dashboard")).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole("button", { name: /Refresh/ });
    await user.click(refreshButton);

    // Button should be disabled while fetching
    expect(refreshButton).toBeDisabled();
    expect(screen.getByText("Refreshing...")).toBeInTheDocument();

    // Wait for fetch to complete
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });
  });

  it("displays Cloudflare Dashboard link", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStorageData,
    } as Response);

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("Need More Details?")).toBeInTheDocument();
    });

    const link = screen.getByRole("link", {
      name: /Open Cloudflare Dashboard/,
    });
    expect(link).toHaveAttribute("href", "https://dash.cloudflare.com/r2");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("displays last calculated timestamp", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStorageData,
    } as Response);

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText(/Last calculated:/)).toBeInTheDocument();
    });

    // Check that timestamp is formatted (exact format depends on locale)
    expect(screen.getByText(/Last calculated:/).textContent).toContain("2025");
  });

  it("handles empty storage (0 bytes, 0 files)", async () => {
    const emptyData = {
      totalBytes: 0,
      totalFiles: 0,
      breakdown: {
        models: { count: 0, bytes: 0 },
        slices: { count: 0, bytes: 0 },
        images: { count: 0, bytes: 0 },
      },
      percentOfLimit: 0,
      lastCalculated: new Date().toISOString(),
      source: "database" as const,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => emptyData,
    });

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("Storage Usage Dashboard")).toBeInTheDocument();
    });

    // Check for "0 Bytes" in the total storage card (using getAllByText since it appears multiple times)
    const zeroByteElements = screen.getAllByText("0 Bytes");
    expect(zeroByteElements.length).toBeGreaterThan(0);

    expect(screen.getByText("0 files stored")).toBeInTheDocument();
    expect(screen.getByText(/0.00% of 10GB free tier/)).toBeInTheDocument();
  });

  it('formats singular "file" correctly', async () => {
    const singleFileData = {
      ...mockStorageData,
      totalFiles: 1,
      breakdown: {
        models: { count: 1, bytes: 1024 * 1024 },
        slices: { count: 0, bytes: 0 },
        images: { count: 0, bytes: 0 },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => singleFileData,
    });

    renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("1 file stored")).toBeInTheDocument();
    });

    expect(screen.getByText("1 file")).toBeInTheDocument();
  });

  it("uses green progress bar when under 80%", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStorageData, // 50%
    });

    const { container } = renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("Storage Usage Dashboard")).toBeInTheDocument();
    });

    const progressBar = container.querySelector(".bg-green-500");
    expect(progressBar).toBeInTheDocument();
  });

  it("uses red progress bar when at or above 80%", async () => {
    const warningData = {
      ...mockStorageData,
      percentOfLimit: 85,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => warningData,
    });

    const { container } = renderWithQueryClient(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("Storage Usage Dashboard")).toBeInTheDocument();
    });

    const progressBar = container.querySelector(".bg-red-500");
    expect(progressBar).toBeInTheDocument();
  });
});
