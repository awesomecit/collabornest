/**
 * Surgery Management Tab IDs (Sub-Resource IDs for Socket API)
 * 
 * These tab IDs are used as `subResourceId` parameter in socket lock/unlock events.
 * They correspond to the different sections/tabs in the Surgery Management interface.
 * 
 * Source: src/surgery-management/surgery-management.service.ts (TABSNAME constant)
 * 
 * @example
 * ```typescript
 * // Lock a specific tab
 * socket.emit('surgery:subresource_lock', {
 *   uuid: 'surgery-uuid',
 *   subResourceId: 'data-tab'
 * });
 * 
 * // Or with generic API
 * socket.emit('resource:subresource_lock', {
 *   resourceType: 'surgery-management',
 *   resourceUuid: 'surgery-uuid',
 *   subResourceId: 'data-tab'
 * });
 * ```
 */
export const SURGERY_MANAGEMENT_TAB_IDS = [
  'data-tab',
  'detail-tab',
  'technical-data-tab',
  'operators-tab',
  'diagnosis-tab',
  'exams-tab',
  'infusions-tab',
  'procedures-tab',
  'chirurgicalact-tab',
  'materials-tab',
  'implantables-tab',
  'path-tab',
  'anesthesis-folder-tab',
  'nursing-folder-tab',
  'anesthesis-tab',
  'anesthesis-path-tab',
  'patient-path-tab',
  'validation-tab'
] as const;

/**
 * Surgery Management Tab ID Type
 * 
 * Union type of all valid tab IDs for Surgery Management resource.
 * Use this type for type-safe subResourceId parameters.
 */
export type SurgeryManagementTabId = typeof SURGERY_MANAGEMENT_TAB_IDS[number];

/**
 * Tab ID to Database Field Mapping
 * 
 * Maps tab IDs (used in UI/socket) to database field names (used in backend logic).
 * Useful for understanding the relationship between UI tabs and data model.
 */
export const SURGERY_MANAGEMENT_TAB_TO_DB_FIELD = {
  'data-tab': 'baseData',
  'detail-tab': 'detailData',
  'technical-data-tab': 'technicalData',
  'operators-tab': 'operator',
  'diagnosis-tab': 'diagnosis',
  'exams-tab': 'exam',
  'infusions-tab': 'infusions',
  'procedures-tab': 'procedure',
  'chirurgicalact-tab': 'chirurgicalAct',
  'materials-tab': 'materials',
  'implantables-tab': 'implantables',
  'path-tab': 'po',
  'anesthesis-folder-tab': 'ca',
  'nursing-folder-tab': 'ci',
  'anesthesis-tab': 'anesthesis',
  'anesthesis-path-tab': 'anesthesisPath',
  'patient-path-tab': 'patientPath',
  'validation-tab': 'validation'
} as const;

/**
 * Human-readable tab names (Italian)
 * 
 * For display purposes in UI or test clients.
 */
export const SURGERY_MANAGEMENT_TAB_LABELS: Record<SurgeryManagementTabId, string> = {
  'data-tab': 'Dati Intervento',
  'detail-tab': 'Dettagli',
  'technical-data-tab': 'Dati Tecnici',
  'operators-tab': 'Operatori',
  'diagnosis-tab': 'Diagnosi',
  'exams-tab': 'Esami',
  'infusions-tab': 'Infusioni',
  'procedures-tab': 'Procedure',
  'chirurgicalact-tab': 'Atti Chirurgici',
  'materials-tab': 'Materiali',
  'implantables-tab': 'Impiantabili',
  'path-tab': 'Percorso Operatorio',
  'anesthesis-folder-tab': 'Cartella Anestesiologica',
  'nursing-folder-tab': 'Cartella Infermieristica',
  'anesthesis-tab': 'Anestesia',
  'anesthesis-path-tab': 'Percorso Anestesiologico',
  'patient-path-tab': 'Percorso Paziente',
  'validation-tab': 'Validazione'
};

/**
 * Validates if a string is a valid Surgery Management Tab ID
 * 
 * @param tabId - The tab ID to validate
 * @returns True if valid, false otherwise
 * 
 * @example
 * ```typescript
 * if (isValidSurgeryTabId(subResourceId)) {
 *   // subResourceId is SurgeryManagementTabId
 * }
 * ```
 */
export function isValidSurgeryTabId(tabId: string): tabId is SurgeryManagementTabId {
  return SURGERY_MANAGEMENT_TAB_IDS.includes(tabId as SurgeryManagementTabId);
}
