import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ScannerTour from "./ScannerTour";

const updateProgress = vi.fn();

vi.mock("@/lib/trpc", () => {
  const progressResult = { data: { completedSteps: [] }, isSuccess: true };
  return {
    trpc: {
      guide: {
        progress: { useQuery: () => progressResult },
        updateProgress: { useMutation: () => ({ mutate: updateProgress, isPending: false }) },
      },
    },
  };
});

afterEach(() => {
  cleanup();
  updateProgress.mockClear();
});

describe("ScannerTour", () => {
  it("muestra los pasos, actualiza el porcentaje y persiste el avance en la cuenta", async () => {
    render(<ScannerTour />);

    expect(screen.getByRole("heading", { name: "Opera Nexo Local paso a paso" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Abrir prospección/i }).getAttribute("href")).toBe("/app/nueva-prospeccion");

    await waitFor(() => expect(screen.getByText("0%")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Marcar completado: 1\. Incorpora una fuente autorizada/i }));

    await waitFor(() => expect(screen.getByText("20%")).toBeTruthy());
    expect(updateProgress).toHaveBeenCalledWith({ completedSteps: [0] });

    fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));
    await waitFor(() => expect(screen.getByText("0%")).toBeTruthy());
    expect(updateProgress).toHaveBeenLastCalledWith({ completedSteps: [] });
  });
});
