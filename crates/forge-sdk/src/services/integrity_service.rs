//! Integrity service — content drift detection for snapshot-based derivation chain.
//!
//! Scans all bullets and perspectives for stale content snapshots.
//! A "drifted" entity is one where the snapshot stored at derivation time
//! no longer matches the current content of its parent entity.
//!
//! Uses named queries for efficient cross-table comparison:
//! - `listDriftedBullets`: bullets whose `source_content_snapshot` differs
//!   from the primary source's current `description`.
//! - `listDriftedPerspectives`: perspectives whose `bullet_content_snapshot`
//!   differs from the bullet's current `content`.
//!
//! TS source: `packages/core/src/services/integrity-service.ts`

use forge_core::ForgeError;

/// Entity type discriminator for drift reports.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DriftedEntityType {
    /// A bullet whose `source_content_snapshot` is stale.
    Bullet,
    /// A perspective whose `bullet_content_snapshot` is stale.
    Perspective,
}

/// A single entity with a stale snapshot detected by drift scanning.
#[derive(Debug, Clone)]
pub struct DriftedEntity {
    /// Whether this is a bullet or perspective.
    pub entity_type: DriftedEntityType,
    /// The ID of the drifted entity.
    pub entity_id: String,
    /// The snapshot field name that has drifted.
    pub snapshot_field: String,
    /// The snapshot value stored at derivation time.
    pub snapshot_value: String,
    /// The current value of the parent entity's content.
    pub current_value: String,
}

/// Content drift detection across the entire derivation chain.
///
/// Scans all bullets and perspectives, comparing their stored
/// content snapshots against the current content of their parent
/// entities to find stale/drifted data.
pub struct IntegrityService {
    // ELM / repository handle will be injected here
}

impl IntegrityService {
    /// Create a new IntegrityService instance.
    pub fn new() -> Self {
        todo!()
    }

    /// Find all entities with stale snapshots across the entire database.
    ///
    /// Checks two drift categories:
    /// - **Bullets**: `source_content_snapshot` != primary source's `description`
    /// - **Perspectives**: `bullet_content_snapshot` != bullet's `content`
    ///
    /// Returns a flat list of all drifted entities, bullets first, then
    /// perspectives.
    pub fn get_drifted_entities(&self) -> Result<Vec<DriftedEntity>, ForgeError> {
        todo!()
    }
}
