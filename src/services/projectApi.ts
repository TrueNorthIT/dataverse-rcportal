/** Columns the portal reads for projects (Dataverse `msdyn_project`). */
export const PROJECT_SELECT = [
  'msdyn_projectid',
  'msdyn_subject',
  'msdyn_scheduledstart',
  'msdyn_scheduledfinish',
  'statecode',
  'statuscode',
  'createdon',
]

/** Default list ordering — soonest to start first. */
export const PROJECT_ORDER = { field: 'msdyn_scheduledstart', direction: 'asc' } as const
