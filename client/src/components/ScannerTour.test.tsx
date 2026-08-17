import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import ScannerTour from "./ScannerTour";

const storageKey = "nexo-local-operation-tour-v1";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ScannerTour", () => {
  it("muestra los pasos, persiste el avance local y permite reiniciarlo", async () => {
    render(<ScannerTour />);

    expect(screen.getByRole("heading", { name: "Opera Nexo Local paso a paso" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Abrir prospección/i }).getAttribute("href")).toBe("/app/nueva-prospeccion");

    await waitFor(() => expect(screen.getByText("0%")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Marcar completado: 1\. Incorpora una fuente autorizada/i }));

    await waitFor(() => expect(screen.getByText("20%")).toBeTruthy());
    expect(window.localStorage.getItem(storageKey)).toBe("[0]");

    fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));
    await waitFor(() => expect(screen.getByText("0%")).toBeTruthy());
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });
});
