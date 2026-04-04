import type { RequestFn, Result, ReviewQueue } from '../types'

export class ReviewResource {
  constructor(private request: RequestFn) {}

  pending(): Promise<Result<ReviewQueue>> {
    return this.request<ReviewQueue>('GET', '/api/review/pending')
  }
}
