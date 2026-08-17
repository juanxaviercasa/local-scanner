import { describe, expect, it } from "vitest";
import { assertNoDemoProspects } from "./routers";

describe("protección de registros de demostración", () => {
  it("impide que un registro sintético se use en una exportación o transición", () => {
    expect(() => assertNoDemoProspects([{ business: { isDemo: 1 } }])).toThrow("demostración");
  });

  it("permite que los registros operativos continúen por los flujos comerciales", () => {
    expect(() => assertNoDemoProspects([{ business: { isDemo: 0 } }])).not.toThrow();
  });
});
