import type { AlignmentReport, RequestFn, RequirementMatchReport, Result } from '../types'

export class AlignmentResource {
  constructor(private request: RequestFn) {}

  /** Compute an alignment score between a JD and a resume. */
  async score(
    jdId: string,
    resumeId: string,
    opts?: { strong_threshold?: number; adjacent_threshold?: number },
  ): Promise<Result<AlignmentReport>> {
    const params = new URLSearchParams({ jd_id: jdId, resume_id: resumeId })
    if (opts?.strong_threshold !== undefined) params.set('strong_threshold', String(opts.strong_threshold))
    if (opts?.adjacent_threshold !== undefined) params.set('adjacent_threshold', String(opts.adjacent_threshold))
    return this.request<AlignmentReport>('GET', `/api/alignment/score?${params}`)
  }

  /** Match JD requirements against bullet or perspective entities. */
  async matchRequirements(
    jdId: string,
    entityType: 'bullet' | 'perspective',
    opts?: { threshold?: number; limit?: number },
  ): Promise<Result<RequirementMatchReport>> {
    const params = new URLSearchParams({ jd_id: jdId, entity_type: entityType })
    if (opts?.threshold !== undefined) params.set('threshold', String(opts.threshold))
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
    return this.request<RequirementMatchReport>('GET', `/api/alignment/match?${params}`)
  }
}
