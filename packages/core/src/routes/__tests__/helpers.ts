/**
 * Test helpers for route tests.
 * Creates a fully wired Hono app backed by an in-memory database.
 */

import { Database } from 'bun:sqlite'
import { createTestDb } from '../../db/__tests__/helpers'
import { createServices } from '../../services'
import { createApp } from '../server'
import type { Hono } from 'hono'

export interface TestContext {
  app: Hono
  db: Database
}

/** Create a test app with in-memory database, migrations applied. */
export function createTestApp(): TestContext {
  const db = createTestDb()
  const services = createServices(db, ':memory:')
  const app = createApp(services, db)
  return { app, db }
}

/** Helper to make JSON requests against the test app. */
export async function apiRequest(
  app: Hono,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const url = `http://localhost/api${path}`
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return app.request(url, init)
}
