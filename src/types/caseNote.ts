/**
 * A note/update on a support case — Dataverse `annotation`, exposed by the
 * `casenotes` route (restricted to notes whose regarding record is an incident).
 * Read-only timeline in the portal.
 */
export interface CaseNote {
  annotationid: string
  subject?: string
  notetext?: string
  /** Regarding case id (polymorphic `objectid`, read as `_objectid_value`). */
  _objectid_value?: string
  objecttypecode?: string
  isdocument?: boolean
  createdon?: string
  modifiedon?: string
}
