import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { zoomIn, zoomOut, fitToScreen, toggleFullscreen, isInputFocused } from '../graph.toolbar'

describe('zoomIn', () => {
  it('calls camera.animatedZoom with duration 200', () => {
    const camera = { animatedZoom: vi.fn() }
    const sigma = { getCamera: () => camera } as any
    zoomIn(sigma)
    expect(camera.animatedZoom).toHaveBeenCalledWith({ duration: 200 })
  })
})

describe('zoomOut', () => {
  it('calls camera.animatedUnzoom with duration 200', () => {
    const camera = { animatedUnzoom: vi.fn() }
    const sigma = { getCamera: () => camera } as any
    zoomOut(sigma)
    expect(camera.animatedUnzoom).toHaveBeenCalledWith({ duration: 200 })
  })
})

describe('fitToScreen', () => {
  it('calls camera.animatedReset with duration 300', () => {
    const camera = { animatedReset: vi.fn() }
    const sigma = { getCamera: () => camera } as any
    fitToScreen(sigma)
    expect(camera.animatedReset).toHaveBeenCalledWith({ duration: 300 })
  })
})

describe('toggleFullscreen', () => {
  let originalDocument: any

  beforeEach(() => {
    // Save original and set up mock document for environments without DOM
    originalDocument = globalThis.document
    if (!globalThis.document) {
      (globalThis as any).document = {}
    }
  })

  afterEach(() => {
    // Restore original document
    if (originalDocument === undefined) {
      delete (globalThis as any).document
    } else {
      (globalThis as any).document = originalDocument
    }
  })

  it('enters fullscreen when not active', () => {
    const container = { requestFullscreen: vi.fn() } as any
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, writable: true, configurable: true })
    Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true })
    toggleFullscreen(container)
    expect(container.requestFullscreen).toHaveBeenCalled()
  })

  it('exits fullscreen when active', () => {
    const exitFn = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, writable: true, configurable: true })
    Object.defineProperty(document, 'fullscreenElement', { value: {}, writable: true, configurable: true })
    Object.defineProperty(document, 'exitFullscreen', { value: exitFn, writable: true, configurable: true })
    toggleFullscreen({} as any)
    expect(exitFn).toHaveBeenCalled()
  })

  it('is a no-op when fullscreen API is unavailable', () => {
    const container = { requestFullscreen: vi.fn() } as any
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, writable: true, configurable: true })
    toggleFullscreen(container)
    expect(container.requestFullscreen).not.toHaveBeenCalled()
  })
})

describe('isInputFocused', () => {
  it('returns true for INPUT elements', () => {
    const event = { target: { tagName: 'INPUT' } } as any
    expect(isInputFocused(event)).toBe(true)
  })

  it('returns true for TEXTAREA elements', () => {
    const event = { target: { tagName: 'TEXTAREA' } } as any
    expect(isInputFocused(event)).toBe(true)
  })

  it('returns true for SELECT elements', () => {
    const event = { target: { tagName: 'SELECT' } } as any
    expect(isInputFocused(event)).toBe(true)
  })

  it('returns false for DIV elements', () => {
    const event = { target: { tagName: 'DIV' } } as any
    expect(isInputFocused(event)).toBe(false)
  })

  it('returns false for BUTTON elements', () => {
    const event = { target: { tagName: 'BUTTON' } } as any
    expect(isInputFocused(event)).toBe(false)
  })
})
