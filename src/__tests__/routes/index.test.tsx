import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "~/routeTree.gen";

describe("Home Route", () => {
  it("should render welcome message", async () => {
    const queryClient = new QueryClient();
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/"] }),
      context: { queryClient },
      defaultPendingMinMs: 0,
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByText("You're a dummy!!!")).toBeInTheDocument();
  });
});
