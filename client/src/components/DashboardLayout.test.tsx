import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Operador", email: "operador@nexo.local", role: "user" },
    loading: false,
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock("@/const", () => ({ startLogin: vi.fn() }));

import DashboardLayout from "./DashboardLayout";

afterEach(() => cleanup());

describe("DashboardLayout", () => {
  it("expone la guía y el recorrido desde la navegación privada", () => {
    render(<DashboardLayout><p>Contenido operativo</p></DashboardLayout>);

    const guide = screen.getByRole("link", { name: /Guía y recorrido/i });
    expect(guide.getAttribute("href")).toBe("/app/guia");
    expect(screen.getByText("Contenido operativo")).toBeTruthy();
  });
});
