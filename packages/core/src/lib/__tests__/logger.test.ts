import { describe, expect, it, beforeEach, afterEach, spyOn } from 'bun:test'
import { Logger } from '../logger'
import type { LogLevel } from '../logger'

describe('Logger', () => {
  let debugSpy: ReturnType<typeof spyOn>
  let logSpy: ReturnType<typeof spyOn>
  let warnSpy: ReturnType<typeof spyOn>
  let errorSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    debugSpy = spyOn(console, 'debug').mockImplementation(() => {})
    logSpy = spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    debugSpy.mockRestore()
    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('debug level enables all log methods', () => {
    const logger = new Logger('debug')
    logger.debug({ msg: 'test' })
    logger.info({ msg: 'test' })
    logger.warn({ msg: 'test' })
    logger.error({ msg: 'test' })
    expect(debugSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('info level suppresses debug', () => {
    const logger = new Logger('info')
    logger.debug({ msg: 'suppressed' })
    logger.info({ msg: 'visible' })
    logger.warn({ msg: 'visible' })
    logger.error({ msg: 'visible' })
    expect(debugSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('warn level suppresses debug and info', () => {
    const logger = new Logger('warn')
    logger.debug({ msg: 'suppressed' })
    logger.info({ msg: 'suppressed' })
    logger.warn({ msg: 'visible' })
    logger.error({ msg: 'visible' })
    expect(debugSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('error level suppresses everything except error', () => {
    const logger = new Logger('error')
    logger.debug({ msg: 'suppressed' })
    logger.info({ msg: 'suppressed' })
    logger.warn({ msg: 'suppressed' })
    logger.error({ msg: 'visible' })
    expect(debugSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('outputs structured JSON with level and ts fields', () => {
    const logger = new Logger('debug')
    logger.info({ method: 'GET', path: '/api/health', status: 200 })
    expect(logSpy).toHaveBeenCalledTimes(1)
    const output = logSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed.level).toBe('info')
    expect(parsed.ts).toBeDefined()
    expect(parsed.method).toBe('GET')
    expect(parsed.path).toBe('/api/health')
    expect(parsed.status).toBe(200)
  })

  it('defaults to info when given an invalid level', () => {
    const logger = new Logger('banana' as LogLevel)
    expect(logger.getLevel()).toBe('info')
    logger.debug({ msg: 'suppressed' })
    logger.info({ msg: 'visible' })
    expect(debugSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledTimes(1)
  })

  it('defaults to info when no level is provided', () => {
    const logger = new Logger()
    expect(logger.getLevel()).toBe('info')
  })

  it('uses console.debug for debug, console.log for info, console.warn for warn, console.error for error', () => {
    const logger = new Logger('debug')
    logger.debug({ msg: 'd' })
    logger.info({ msg: 'i' })
    logger.warn({ msg: 'w' })
    logger.error({ msg: 'e' })
    expect(debugSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})
