/** Icono por estado de la cola de remisión (compartido por FiscalStatus e Incidencias). */
export const ESTADO_ICON: Record<string, string> = {
  PERSISTED: '📝', QUEUED: '⏳', SENDING: '📤', ACCEPTED: '✅',
  ACCEPTED_WITH_ERRORS: '⚠️', REJECTED: '❌', RETRY_PENDING: '🔁',
};
