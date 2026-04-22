// === named.hx ===
// Hand-written graph traversal queries that exploit HelixDB's native
// capabilities. These correspond to the named queries in
// packages/core/src/storage/named-queries.ts.

// traceChain: perspective → bullet → sources
QUERY TraceChain(perspectiveId: String) =>
    perspective <- N<Perspectives>({id: perspectiveId})::FIRST
    bullet <- N<Bullets>({id: perspective::{bullet_id}})::FIRST
    sources <- bullet::In<BulletSources>
    RETURN {perspective: perspective, bullet: bullet, sources: sources}

// listDriftedBullets: bullets where snapshot != primary source description
// Returns all bullets — drift comparison (snapshot vs current) is done in
// TypeScript since HQL doesn't support string inequality across traversals.
QUERY ListDriftedBullets() =>
    bullets <- N<Bullets>
    RETURN bullets

// listDriftedPerspectives: perspectives where snapshot != bullet content
// Returns all perspectives — drift comparison done in TypeScript.
QUERY ListDriftedPerspectives() =>
    perspectives <- N<Perspectives>
    RETURN perspectives
