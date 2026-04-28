# Sync Protocol

> Status: Design (2026-04-27)
> Related: [deployment.md](deployment.md), [runtime.md](runtime.md)
> Epic: TBD (CRDT Sync Protocol)

## Overview

SaaS users need their browser-local data to sync with the server for multi-device access and backup. The sync protocol uses CRDTs (Conflict-free Replicated Data Types) to handle concurrent modifications from multiple devices.

## Architecture

```
Browser A                    Server (D1)                Browser B
┌──────────┐                ┌──────────┐                ┌──────────┐
│wa-sqlite │                │ D1 store │                │wa-sqlite │
│+ mutation│──push ops──→   │          │   ←──push ops──│+ mutation│
│  log     │                │  merge   │                │  log     │
│          │←──pull state── │          │ ──pull state──→│          │
└──────────┘                └──────────┘                └──────────┘
```

## Session Lifecycle (D1 + Turso pattern)

### Session Start
1. Browser checks sync state (last sync timestamp, version vector)
2. Pull: fetch operations from D1 since last sync → apply to local wa-sqlite
3. Turso embedded replica provides efficient diff (not full table scan)
4. Local state is now current

### During Session
1. All mutations happen locally (wa-sqlite) — no network calls
2. Each mutation is logged as a CRDT operation:
   ```
   { actor_id, timestamp, entity_type, entity_id, operation, payload }
   ```
3. Operations are append-only — never modify the log

### Session End (or periodic background sync)
1. Push: send mutation log to server since last sync
2. Server applies operations to D1, resolving conflicts via CRDT merge
3. Server responds with any operations from other devices
4. Browser applies remote operations to local state
5. Both sides update sync cursors

### Between Sessions
- D1 is the durable source of truth
- Browser's wa-sqlite may be stale (acceptable — next session syncs)
- Turso provides efficient diffing (not needed if CRDT log is the sync mechanism)

## CRDT Design

### Operation Types

```
CREATE { entity_type, entity_id, fields, timestamp, actor_id }
UPDATE { entity_type, entity_id, field_name, old_value, new_value, timestamp, actor_id }
DELETE { entity_type, entity_id, timestamp, actor_id }
```

### Conflict Resolution

**Last-Writer-Wins (LWW) per field:**
- Each field has a timestamp of its last update
- When two actors modify the same field, the later timestamp wins
- This is the simplest CRDT that works for most cases

**When LWW isn't enough:**
- Resume section ordering: use a fractional index (LSeq or similar) — insertions between items don't conflict
- Skill tags on bullets: use an Add-Wins OR-Set — adding a tag always wins over concurrent removal
- Notes/text: use a simple LWW on the full text field (not character-level CRDT — too complex for the value)

### Entity-Specific Strategies

| Entity | CRDT Type | Rationale |
|--------|-----------|-----------|
| Sources, Bullets, JDs, Orgs | LWW Register per field | Field-level updates rarely conflict |
| Perspectives, Summaries | LWW Register per field | Same |
| Resume Sections (ordering) | LSeq / Fractional Index | Ordering conflicts are common with DnD |
| Resume Entries (membership) | Add-Wins OR-Set | Adding entries should never be lost |
| Skill tags (junction tables) | Add-Wins OR-Set | Tag additions win over removals |
| Alignment results | LWW (overwrite) | Computed values — latest computation wins |
| Career Target snapshots | Append-only | Never conflict — each snapshot is immutable |
| Notes | LWW on full text | Character-level merging is overkill |

## Dedup Key for Market Stats Contributions

When users contribute anonymized skill extraction tuples for market stats:

```
Dedup key: hash(normalize(org_name) + normalize(role_title) + posting_quarter)
```

- `normalize()`: lowercase, strip whitespace, remove common suffixes ("Inc", "LLC")
- `posting_quarter`: coarsen to quarter to handle minor date differences
- Server maintains a set of seen dedup keys — duplicate contributions are dropped
- No user identity attached — contributions are anonymous skill tuples

## Sync State

Each device maintains:
```sql
sync_state (
  device_id TEXT PRIMARY KEY,
  last_sync_at TIMESTAMP,
  version_vector JSON,  -- { device_a: 42, device_b: 17 }
  pending_ops_count INT
)
```

Version vector tracks how far each device has synced. On pull, request only operations with vector entries beyond the local version vector.

## Offline Behavior

- Full functionality continues offline (browser-first)
- Mutations accumulate in the local operation log
- On reconnect: push accumulated ops, pull remote ops, merge
- Conflict resolution happens at merge time, not at mutation time

## Zero-Knowledge Compatibility

If/when zero-knowledge encryption is implemented:
- Operation payloads are encrypted client-side before push
- Server stores encrypted blobs — can route and order them but not read them
- Merge strategy must work on metadata (timestamps, actor IDs) without reading payloads
- LWW per field still works — server compares timestamps, keeps the later encrypted blob
- OR-Set operations need set membership checks — these use encrypted element IDs (deterministic encryption)
