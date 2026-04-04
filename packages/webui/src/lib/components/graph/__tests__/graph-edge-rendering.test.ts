import { describe, it, expect } from 'vitest'
import {
  edgeSizeFromWeight,
  MIN_EDGE_SIZE,
  MAX_EDGE_SIZE,
  DEFAULT_EDGE_SIZE,
} from '../graph.constants'

describe('edgeSizeFromWeight', () => {
  it('returns DEFAULT_EDGE_SIZE for undefined weight', () => {
    expect(edgeSizeFromWeight(undefined)).toBe(DEFAULT_EDGE_SIZE)
  })

  it('clamps to MIN_EDGE_SIZE for very small weights', () => {
    expect(edgeSizeFromWeight(0.1)).toBe(MIN_EDGE_SIZE)
  })

  it('clamps to MAX_EDGE_SIZE for very large weights', () => {
    expect(edgeSizeFromWeight(100)).toBe(MAX_EDGE_SIZE)
  })

  it('passes through weights within range', () => {
    expect(edgeSizeFromWeight(2)).toBe(2)
    expect(edgeSizeFromWeight(3.5)).toBe(3.5)
  })

  it('returns DEFAULT_EDGE_SIZE for NaN', () => {
    expect(edgeSizeFromWeight(NaN)).toBe(DEFAULT_EDGE_SIZE)
  })

  it('clamps zero to MIN_EDGE_SIZE', () => {
    expect(edgeSizeFromWeight(0)).toBe(MIN_EDGE_SIZE)
  })

  it('clamps negative values to MIN_EDGE_SIZE', () => {
    expect(edgeSizeFromWeight(-5)).toBe(MIN_EDGE_SIZE)
  })

  it('returns exact boundary values', () => {
    expect(edgeSizeFromWeight(MIN_EDGE_SIZE)).toBe(MIN_EDGE_SIZE)
    expect(edgeSizeFromWeight(MAX_EDGE_SIZE)).toBe(MAX_EDGE_SIZE)
  })
})

describe('edge size constants', () => {
  it('MIN_EDGE_SIZE is 0.5', () => {
    expect(MIN_EDGE_SIZE).toBe(0.5)
  })

  it('MAX_EDGE_SIZE is 5', () => {
    expect(MAX_EDGE_SIZE).toBe(5)
  })

  it('DEFAULT_EDGE_SIZE is 1', () => {
    expect(DEFAULT_EDGE_SIZE).toBe(1)
  })

  it('MIN < DEFAULT < MAX', () => {
    expect(MIN_EDGE_SIZE).toBeLessThan(DEFAULT_EDGE_SIZE)
    expect(DEFAULT_EDGE_SIZE).toBeLessThan(MAX_EDGE_SIZE)
  })
})
