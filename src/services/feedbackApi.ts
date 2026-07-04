import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Feedback, NewFeedback } from '../types/feedback'

/** Columns the portal reads for feedback. */
export const FEEDBACK_SELECT = [
  'new_portalfeedbackid',
  'new_name',
  'new_message',
  'new_category',
  'new_rating',
  'createdon',
]

/** Category choices — values match the `new_category` option set in Dataverse. */
export const FEEDBACK_CATEGORIES = [
  { value: 100000000, label: 'Bug' },
  { value: 100000001, label: 'Idea' },
  { value: 100000002, label: 'Praise' },
  { value: 100000003, label: 'Question' },
  { value: 100000004, label: 'Other' },
] as const

export const categoryLabel = (value?: number) =>
  FEEDBACK_CATEGORIES.find((c) => c.value === value)?.label

/**
 * Submit portal feedback. The `portalfeedback` route auto-binds the caller's
 * contact + account on create (createDefaults), so we only send content fields.
 */
export async function createFeedback(
  client: DataverseClient,
  input: NewFeedback,
): Promise<Feedback> {
  const res = await client.me.create<Feedback>(
    'portalfeedback',
    input as unknown as Record<string, unknown>,
  )
  return res.data
}
