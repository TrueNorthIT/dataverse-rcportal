/**
 * Shape of a Dataverse `incident` (support case) record as this portal uses it.
 * Route name is `case`; the Dataverse table is `incident`.
 *
 * PROVISIONAL — regenerate from the published schema once the `rcportal` scope
 * has the case table:
 *   contact-admin tables get case --scope rcportal --json
 *
 * Choice fields (prioritycode/statuscode/statecode) come back with a
 * `<field>_label` companion string — prefer that for display.
 */
export interface Case {
  incidentid: string
  title?: string
  description?: string
  ticketnumber?: string
  prioritycode?: number
  prioritycode_label?: string
  statecode?: number
  statecode_label?: string
  statuscode?: number
  statuscode_label?: string
  createdon?: string
  modifiedon?: string
}

/** Fields a customer supplies when raising a case (`client.me.create`). */
export interface NewCase {
  title: string
  description?: string
  prioritycode?: number
}
