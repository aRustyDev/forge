// packages/extension/src/background/handlers/answers.ts

import type { Response } from '../../lib/messaging'
import { extError, mapNetworkError } from '../../lib/errors'
import { getClient } from '../client'

export interface AnswersListPayload {
  answers: Record<string, string>
}

export async function handleAnswersList(): Promise<Response<AnswersListPayload>> {
  try {
    const client = await getClient()
    const result = await client.answerBank.list()
    if (!result.ok) {
      return {
        ok: false,
        error: extError('API_UNREACHABLE', 'Could not load answer bank', { layer: 'sdk' }),
      }
    }
    const answers: Record<string, string> = {}
    for (const entry of result.data) {
      answers[entry.field_kind] = entry.value
    }
    return { ok: true, data: { answers } }
  } catch (err) {
    return { ok: false, error: mapNetworkError(err, { url: '/api/profile/answers' }) }
  }
}
