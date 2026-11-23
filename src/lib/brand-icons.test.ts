import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { brandFor } from "./brand-icons.ts";

describe("logotipos por nombre", () => {
  test("reconoce el servicio dentro del nombre de la suscripción", () => {
    assert.equal(brandFor("Spotify Premium Familiar")?.key, "spotify");
    assert.equal(brandFor("netflix")?.key, "netflix");
    assert.equal(brandFor("Movistar Plus+ Plan Libre")?.key, "movistar");
    assert.equal(brandFor("PlayStation Plus Essential 12 meses")?.key, "playstation");
  });

  test("el más específico gana y no confunde palabras parecidas", () => {
    assert.equal(brandFor("YouTube Music Familiar")?.key, "youtube-music");
    assert.equal(brandFor("YouTube Premium")?.key, "youtube");
    assert.equal(brandFor("Apple Music Individual")?.key, "apple-music");
    assert.equal(brandFor("Spotifyy")?.key, undefined);
    assert.equal(brandFor("Mi gimnasio"), null);
  });
});
