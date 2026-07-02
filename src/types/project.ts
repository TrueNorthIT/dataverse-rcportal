/**
 * Shape of a Dataverse `msdyn_project` record as this portal uses it.
 *
 * PROVISIONAL — Project Operations columns are prefixed `msdyn_`. Regenerate
 * from the published schema once the `rcportal` scope is provisioned:
 *   contact-admin tables get project --scope rcportal --json
 * (the `rcportal` route name is `project`; the Dataverse table is msdyn_project).
 */
export interface Project {
  msdyn_projectid: string
  /** Display name of the project. */
  msdyn_subject?: string
  /** Scope/summary text (carries the demo marker — clean before display). */
  msdyn_description?: string
  msdyn_scheduledstart?: string
  /** Scheduled finish — the real field is `msdyn_finish` (not scheduledfinish). */
  msdyn_finish?: string
  statecode?: number
  statecode_label?: string
  statuscode?: number
  statuscode_label?: string
  /** Lookup → account (the customer the project is for). */
  _msdyn_customer_value?: string
  createdon?: string
  modifiedon?: string
}
