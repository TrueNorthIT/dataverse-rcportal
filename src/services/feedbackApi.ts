import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Feedback, NewFeedback } from '../types/feedback'

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
