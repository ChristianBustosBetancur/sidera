/* Preferencias de confirmación de la Doble Titulación.

   Viven en su propia clave, separadas del progreso académico: son una
   comodidad de interfaz, no un registro curricular. Si se corrompen o no se
   pueden leer, el valor seguro es pedir confirmación, nunca saltársela. */
export const SYNC_PREFERENCES_KEY = "sidera:dual-sync-preferences:v1";

export type SyncPreferences = { skipSharedConfirmation: boolean };

export function defaultSyncPreferences(): SyncPreferences {
  return { skipSharedConfirmation: false };
}

export function loadSyncPreferences(): SyncPreferences {
  try {
    const raw = localStorage.getItem(SYNC_PREFERENCES_KEY);
    if (raw === null) return defaultSyncPreferences();
    const parsed: unknown = JSON.parse(raw);
    const skip = typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>).skipSharedConfirmation
      : undefined;
    return { skipSharedConfirmation: skip === true };
  } catch {
    return defaultSyncPreferences();
  }
}

export function saveSyncPreferences(preferences: SyncPreferences): boolean {
  try {
    localStorage.setItem(SYNC_PREFERENCES_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}
