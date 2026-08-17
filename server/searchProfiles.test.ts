import { describe, expect, it } from "vitest";
import { buildSearchProfileValues } from "./db";
import { authorizedSourceSchema } from "./routers";

const baseProfile = {
  name: "Clínicas de Lima",
  country: "Perú",
  city: "Lima",
  primaryCategory: "clínicas",
  radiusMeters: 3000,
  maxResults: 15,
  minReviewCount: 0,
  minOpportunityScore: 0,
  websiteMode: "both" as const,
  provider: "csv_import" as const,
};

describe("perfiles de fuentes autorizadas", () => {
  it("valida exclusivamente las fuentes autorizadas", () => {
    expect(authorizedSourceSchema.parse("csv_import")).toBe("csv_import");
    expect(authorizedSourceSchema.safeParse("directorio_no_autorizado").success).toBe(false);
  });

  it("prepara para persistencia la fuente elegida junto con el resto del perfil", () => {
    expect(buildSearchProfileValues(7, { ...baseProfile, provider: "manual_entry" })).toMatchObject({ ownerId: 7, name: "Clínicas de Lima", provider: "manual_entry" });
  });
});
