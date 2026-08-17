import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <main data-testid="dashboard-layout">{children}</main>,
}));

vi.mock("@/components/ScannerUI", () => ({
  PageHeader: ({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) => (
    <header><h1>{title}</h1><p>{description}</p>{actions}</header>
  ),
}));

import Guide from "./Guide";

afterEach(() => cleanup());

describe("Guide", () => {
  it("presenta la orientación operativa y enlaza la transición con el expediente 2.0", () => {
    render(<Guide />);

    expect(screen.getByTestId("dashboard-layout")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Guía de operación" })).toBeTruthy();
    expect(screen.getByText("Límites que protegen tu operación")).toBeTruthy();
    expect(screen.getByText(/El expediente 2\.0 reúne señales verificables/i)).toBeTruthy();

    const transitionLinks = screen.getAllByRole("link", { name: /transición|expedientes/i });
    expect(transitionLinks.some(link => link.getAttribute("href") === "/app/transiciones")).toBe(true);
  });
});
