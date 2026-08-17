import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const invalidate = vi.fn();
const mutation = { mutate: vi.fn(), isPending: false };

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/ScannerUI", () => ({
  PageHeader: ({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) => <header><h1>{title}</h1><p>{description}</p>{actions}</header>,
  EmptyState: ({ title, description, action }: { title: string; description: string; action: string }) => <div><h3>{title}</h3><p>{description}</p><span>{action}</span></div>,
  PriorityPill: () => <span>Prioridad</span>,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ handoffs: { policy: { invalidate }, list: { invalidate } }, prospects: { list: { invalidate } } }),
    handoffs: {
      policy: { useQuery: () => ({ data: { minimumOpportunityScore: 70, destinationLabel: "SaaS de auditoría web", requireNextAction: 1, requireDigitalEvidence: 1 } }) },
      connectorStatus: { useQuery: () => ({ data: { state: "placeholder_inactivo" } }) },
      list: { useQuery: () => ({ data: [] }) },
      updatePolicy: { useMutation: () => mutation },
      queue: { useMutation: () => mutation },
      approve: { useMutation: () => mutation },
      dossier: { useMutation: () => mutation },
    },
    prospects: { list: { useQuery: () => ({ data: [] }) } },
  },
}));

import Handoffs from "./Handoffs";

afterEach(() => cleanup());

describe("Handoffs", () => {
  it("muestra la tarjeta del expediente 2.0 y enlaces visibles a la guía", () => {
    render(<Handoffs />);

    expect(screen.getByText("Expediente de auditoría 2.0")).toBeTruthy();
    expect(screen.getByText("Una base concreta para crear o mejorar un sitio web")).toBeTruthy();
    const guideLinks = screen.getAllByRole("link", { name: /Guía de operación|Ver recorrido/i });
    expect(guideLinks.every(link => link.getAttribute("href") === "/app/guia")).toBe(true);
  });
});
