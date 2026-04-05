import { describe, it, expect, afterAll } from 'bun:test'
import { computeEmbedding, resetPipeline, EMBEDDING_DIM } from '../model-loader'

const SKIP_MODEL_TESTS = process.env.CI && process.env.SKIP_MODEL_TESTS

afterAll(() => {
  resetPipeline()
})

describe('model-loader', () => {
  if (SKIP_MODEL_TESTS) {
    it.skip('skipped: SKIP_MODEL_TESTS is set in CI', () => {})
    return
  }

  it('produces a 384-dimensional Float32Array', async () => {
    const vec = await computeEmbedding('test string for embedding')
    expect(vec).toBeInstanceOf(Float32Array)
    expect(vec.length).toBe(EMBEDDING_DIM)
  }, 120_000)

  it('produces normalized vectors (L2 norm ~1.0)', async () => {
    const vec = await computeEmbedding('another test string')
    let sumSq = 0
    for (let i = 0; i < vec.length; i++) sumSq += vec[i] * vec[i]
    const norm = Math.sqrt(sumSq)
    expect(norm).toBeCloseTo(1.0, 2)
  }, 120_000)

  it('produces different vectors for different inputs', async () => {
    const v1 = await computeEmbedding('Designed and deployed Kubernetes clusters')
    const v2 = await computeEmbedding('Baked chocolate chip cookies')
    let dot = 0
    for (let i = 0; i < v1.length; i++) dot += v1[i] * v2[i]
    expect(dot).toBeLessThan(0.5)
  }, 120_000)

  it('produces similar vectors for semantically related inputs', async () => {
    const v1 = await computeEmbedding('Deploy Kubernetes clusters on AWS using Terraform and Helm')
    const v2 = await computeEmbedding('Set up Kubernetes infrastructure on Amazon Web Services with Terraform and Helm charts')
    let dot = 0
    for (let i = 0; i < v1.length; i++) dot += v1[i] * v2[i]
    expect(dot).toBeGreaterThan(0.4)
  }, 120_000)
})
