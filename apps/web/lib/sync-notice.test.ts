import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncNoticeText } from "./sync-notice";
import {
  SYNC_PREFERENCES_KEY,
  defaultSyncPreferences,
  loadSyncPreferences,
  saveSyncPreferences,
} from "./sync-preferences";

describe("aviso de sincronización", () => {
  it("no dice nada cuando no hubo nada que contar", () => {
    expect(syncNoticeText({ mirrored: [], retired: [], warned: [] })).toBeUndefined();
  });
  it("nombra el programa donde se reflejó el cambio", () => {
    expect(syncNoticeText({ mirrored: ["Matemáticas"], retired: [], warned: [] }))
      .toBe("Reflejado también en Matemáticas.");
  });
  it("detalla lo que la reconciliación arrastró consigo", () => {
    expect(syncNoticeText({ mirrored: ["Matemáticas"], retired: ["3010390 Fundamentos de matemáticas discretas"], warned: [] }))
      .toBe("Reflejado también en Matemáticas. Se retiró de «En curso»: 3010390 Fundamentos de matemáticas discretas.");
  });
  it("conserva los avisos ya redactados, sin enumerarlos", () => {
    const warning = "No cumple requisitos en Matemáticas: 3008082 Criptografía y seguridad. Te falta aprobar 3010394 Estadística.";
    expect(syncNoticeText({ mirrored: ["Matemáticas"], retired: [], warned: [warning] }))
      .toBe(`Reflejado también en Matemáticas. ${warning}`);
  });
});

describe("preferencias de confirmación", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
  });

  it("parte de pedir confirmación y no comparte clave con el progreso", () => {
    expect(loadSyncPreferences()).toEqual({ skipSharedConfirmation: false });
    expect(SYNC_PREFERENCES_KEY).not.toContain("academic-records");
  });
  it("persiste la elección y se puede revertir", () => {
    saveSyncPreferences({ skipSharedConfirmation: true });
    // Releer simula una recarga de la página.
    expect(loadSyncPreferences().skipSharedConfirmation).toBe(true);
    saveSyncPreferences({ skipSharedConfirmation: false });
    expect(loadSyncPreferences()).toEqual(defaultSyncPreferences());
  });
  it("ante un valor corrupto vuelve a pedir confirmación", () => {
    store.set(SYNC_PREFERENCES_KEY, "{no es json");
    expect(loadSyncPreferences().skipSharedConfirmation).toBe(false);
    store.set(SYNC_PREFERENCES_KEY, JSON.stringify({ skipSharedConfirmation: "sí" }));
    expect(loadSyncPreferences().skipSharedConfirmation).toBe(false);
  });
});
