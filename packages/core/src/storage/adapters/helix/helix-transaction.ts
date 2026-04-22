// packages/core/src/storage/adapters/helix/helix-transaction.ts
import type { Transaction } from '../../adapter'
import type { WhereClause } from '../../adapter-types'

interface BufferedOp {
  method: 'create' | 'update' | 'delete' | 'deleteWhere' | 'updateWhere'
  args: unknown[]
}

/**
 * Fake transaction for HelixDB. Buffers writes, executes reads immediately.
 *
 * HelixDB has no client-exposed transaction API (single-writer LMDB model).
 * This satisfies the Transaction interface contract:
 * - commit() flushes all buffered writes sequentially
 * - rollback() discards un-flushed writes
 * - Reads (get, count) execute immediately against the adapter
 */
export class HelixTransaction implements Transaction {
  private buffer: BufferedOp[] = []
  private committed = false
  private rolledBack = false

  constructor(
    private readonly adapter: {
      create(entityType: string, data: Record<string, unknown>): Promise<{ id: string }>
      get(entityType: string, id: string): Promise<Record<string, unknown> | null>
      update(entityType: string, id: string, data: Record<string, unknown>): Promise<void>
      delete(entityType: string, id: string): Promise<void>
      deleteWhere(entityType: string, where: WhereClause): Promise<number>
      updateWhere(entityType: string, where: WhereClause, data: Record<string, unknown>): Promise<number>
      count(entityType: string, where?: WhereClause): Promise<number>
    },
  ) {}

  async create(entityType: string, data: Record<string, unknown>): Promise<{ id: string }> {
    this.assertOpen()
    this.buffer.push({ method: 'create', args: [entityType, data] })
    return { id: typeof data.id === 'string' ? data.id : '' }
  }

  async get(entityType: string, id: string): Promise<Record<string, unknown> | null> {
    this.assertOpen()
    return this.adapter.get(entityType, id)
  }

  async update(entityType: string, id: string, data: Record<string, unknown>): Promise<void> {
    this.assertOpen()
    this.buffer.push({ method: 'update', args: [entityType, id, data] })
  }

  async delete(entityType: string, id: string): Promise<void> {
    this.assertOpen()
    this.buffer.push({ method: 'delete', args: [entityType, id] })
  }

  async deleteWhere(entityType: string, where: WhereClause): Promise<number> {
    this.assertOpen()
    this.buffer.push({ method: 'deleteWhere', args: [entityType, where] })
    return 0
  }

  async updateWhere(
    entityType: string,
    where: WhereClause,
    data: Record<string, unknown>,
  ): Promise<number> {
    this.assertOpen()
    this.buffer.push({ method: 'updateWhere', args: [entityType, where, data] })
    return 0
  }

  async count(entityType: string, where?: WhereClause): Promise<number> {
    this.assertOpen()
    return this.adapter.count(entityType, where)
  }

  async commit(): Promise<void> {
    this.assertOpen()
    for (const op of this.buffer) {
      await (this.adapter[op.method] as Function)(...op.args)
    }
    this.committed = true
    this.buffer = []
  }

  async rollback(): Promise<void> {
    if (this.committed) {
      console.warn('HelixTransaction.rollback: transaction already committed, cannot undo')
      return
    }
    this.buffer = []
    this.rolledBack = true
  }

  private assertOpen(): void {
    if (this.committed) throw new Error('Transaction already committed')
    if (this.rolledBack) throw new Error('Transaction already rolled back')
  }
}
