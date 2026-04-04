/**
 * ModelLoader — lazy singleton for the all-MiniLM-L6-v2 sentence-transformer.
 *
 * Downloads and caches the model on first use (~80MB). Subsequent calls
 * return the cached pipeline. Thread-safe via promise deduplication.
 *
 * NOTE: resetPipeline() is for testing only. It clears the cached pipeline
 * so tests can start fresh. Do not call in production code.
 */

import { pipeline, type Pipeline } from '@huggingface/transformers'

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'
const EMBEDDING_DIM = 384

let pipelinePromise: Promise<Pipeline> | null = null

/**
 * Get (or lazily create) the feature-extraction pipeline.
 * First call triggers model download + ONNX runtime init (~2-5s).
 * Subsequent calls return the cached pipeline instantly.
 */
export async function getEmbeddingPipeline(): Promise<Pipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('feature-extraction', MODEL_NAME, {
      quantized: true,
    })
  }
  return pipelinePromise
}

/**
 * Compute a 384-dimensional embedding vector for the given text.
 * Returns a Float32Array of length 384.
 * Throws if the model fails to load or inference errors.
 */
export async function computeEmbedding(text: string): Promise<Float32Array> {
  const extractor = await getEmbeddingPipeline()
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  return new Float32Array(output.data)
}

/**
 * Reset the cached pipeline. Used in tests only.
 */
export function resetPipeline(): void {
  pipelinePromise = null
}

export { EMBEDDING_DIM, MODEL_NAME }
