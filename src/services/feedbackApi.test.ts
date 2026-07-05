import { describe, expect, it } from 'vitest'
import { makeClient, single } from '../test/dataverse'
import type { Feedback } from '../types/feedback'
import { createFeedback } from './feedbackApi'

describe('createFeedback', () => {
  it('creates portal feedback on the me tier and returns the new record', async () => {
    const client = makeClient()
    const created: Feedback = { new_portalfeedbackid: 'fb-1' } as Feedback
    client.me.create.mockResolvedValue(single(created))

    const result = await createFeedback(client, {
      new_name: 'Ada Lovelace',
      new_message: 'Great portal',
      new_rating: 5,
    })

    expect(result).toEqual(created)
    expect(client.me.create).toHaveBeenCalledWith('portalfeedback', {
      new_name: 'Ada Lovelace',
      new_message: 'Great portal',
      new_rating: 5,
    })
  })

  it('sends only the supplied content fields (rating optional)', async () => {
    const client = makeClient()
    client.me.create.mockResolvedValue(single<Feedback>({} as Feedback))

    await createFeedback(client, { new_name: 'Anon', new_message: 'Thanks' })

    expect(client.me.create).toHaveBeenCalledWith('portalfeedback', {
      new_name: 'Anon',
      new_message: 'Thanks',
    })
  })
})
