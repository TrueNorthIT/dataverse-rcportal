/** Columns the portal reads for sites (Dataverse `customeraddress`). */
export const SITE_SELECT = [
  'customeraddressid',
  'name',
  'line1',
  'city',
  'postalcode',
  'addresstypecode',
  'createdon',
]

/** Default list ordering — alphabetical by site name. */
export const SITE_ORDER = { field: 'name', direction: 'asc' } as const
