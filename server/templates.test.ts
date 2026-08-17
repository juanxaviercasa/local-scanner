import { describe, expect, it } from "vitest";
import { renderTemplate } from "./routers";

describe("renderizado de plantillas comerciales", () => {
  it("sustituye solo las variables disponibles para generar un borrador local", () => {
    const draft = renderTemplate(
      "Hola {{business_name}}, detectamos {{opportunity_reasons}} en {{location}}.",
      {
        business_name: "Café Horizonte",
        opportunity_reasons: "una presencia web mejorable",
        location: "Miraflores, Perú",
      },
    );

    expect(draft).toBe("Hola Café Horizonte, detectamos una presencia web mejorable en Miraflores, Perú.");
  });

  it("conserva las variables no reconocidas y no transforma contenido ausente en un mensaje", () => {
    expect(renderTemplate("{{business_name}} {{unknown}}", { business_name: "Taller Norte" })).toBe("Taller Norte {{unknown}}");
    expect(renderTemplate(null, { business_name: "Taller Norte" })).toBeNull();
  });
});
