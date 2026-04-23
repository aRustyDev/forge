//! Skill repository — data access layer for skills and the `skill_domains`
//! junction table.

use forge_core::{Domain, ForgeError, Skill, SkillCategory, SkillWithDomains};

/// Data access for the `skills` and `skill_domains` tables.
///
/// Skills have a `UNIQUE(name)` constraint (case-insensitive at the app layer)
/// and a `category` column that is an FK to `skill_categories.slug`.
pub struct SkillRepository;

impl SkillRepository {
    /// Create a new repository instance.
    pub fn new() -> Self {
        todo!()
    }

    // ── Skill CRUD ──────────────────────────────────────────────────

    /// Insert a new skill row. The `name` is capitalized on the first
    /// character (preserving the rest, e.g. "SAFe" stays "SAFe").
    /// Returns `CONFLICT` if a skill with the same name already exists.
    pub fn create(&self, name: &str, category: Option<SkillCategory>) -> Result<Skill, ForgeError> {
        todo!()
    }

    /// Fetch a single skill by ID.
    pub fn get(&self, id: &str) -> Result<Option<Skill>, ForgeError> {
        todo!()
    }

    /// Fetch a skill with its linked domains populated.
    pub fn get_with_domains(&self, id: &str) -> Result<Option<SkillWithDomains>, ForgeError> {
        todo!()
    }

    /// List all skills, optionally filtered by category and/or domain_id.
    /// When `domain_id` is provided, walks the `skill_domains` junction.
    /// Supports text search (case-insensitive substring on `name`).
    /// Results are sorted by `name ASC`.
    pub fn list(
        &self,
        category: Option<SkillCategory>,
        domain_id: Option<&str>,
        search: Option<&str>,
    ) -> Result<Vec<Skill>, ForgeError> {
        todo!()
    }

    /// Partially update a skill's `name` and/or `category`.
    pub fn update(
        &self,
        id: &str,
        name: Option<&str>,
        category: Option<SkillCategory>,
    ) -> Result<Skill, ForgeError> {
        todo!()
    }

    /// Delete a skill by ID. This cascades through all junction tables:
    /// `bullet_skills`, `resume_skills`, `certification_skills`,
    /// `job_description_skills`, `perspective_skills`, `source_skills`,
    /// `skill_domains`, `summary_skills`.
    pub fn delete(&self, id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    // ── Case-insensitive lookup ─────────────────────────────────────

    /// Find a skill by exact name match (case-insensitive). Returns `None`
    /// if no match exists.
    pub fn find_by_name(&self, name: &str) -> Result<Option<Skill>, ForgeError> {
        todo!()
    }

    // ── Skill <-> Domain junction ───────────────────────────────────

    /// Link a skill to a domain. Idempotent — if the pair already exists,
    /// returns `Ok(())` without error. Returns `NOT_FOUND` if the skill
    /// or domain does not exist.
    pub fn add_domain(&self, skill_id: &str, domain_id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    /// Unlink a skill from a domain. Silent if the pair does not exist.
    pub fn remove_domain(&self, skill_id: &str, domain_id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    /// Get all domains linked to a skill. Returns `NOT_FOUND` if the
    /// skill does not exist.
    pub fn get_domains(&self, skill_id: &str) -> Result<Vec<Domain>, ForgeError> {
        todo!()
    }

    // ── Merge ───────────────────────────────────────────────────────

    /// Atomically merge `source_id` into `target_id`: re-point all junction
    /// rows from the source skill to the target, handle UNIQUE constraint
    /// conflicts by deleting the conflicting source rows, then delete the
    /// source skill.
    ///
    /// Junction tables migrated: `bullet_skills`, `resume_skills`,
    /// `certification_skills`, `job_description_skills`, `perspective_skills`,
    /// `source_skills`, `skill_domains`, `summary_skills`.
    ///
    /// Returns the surviving target skill after merge.
    pub fn merge(&self, source_id: &str, target_id: &str) -> Result<Skill, ForgeError> {
        todo!()
    }
}
