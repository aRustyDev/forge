//! Export service — resume format export, data bundle export, and database dump.
//!
//! Resume export methods delegate to the compiler service for IR compilation,
//! then render to Markdown or LaTeX. Supports override fields: if a resume
//! has a `markdown_override` or `latex_override`, those take precedence over
//! compiled output.
//!
//! Data export collects entity data into a `DataExportBundle` for backup
//! or migration purposes.
//!
//! Database dump shells out to `sqlite3 <dbPath> .dump` for a full SQL dump.
//!
//! TS source: `packages/core/src/services/export-service.ts`

use forge_core::{DataExportBundle, ForgeError, ResumeDocument};

/// Export operations: resume rendering (JSON/Markdown/LaTeX), entity data
/// export bundles, and raw database dumps.
pub struct ExportService {
    // database handle + ELM + db_path will be injected here
}

impl ExportService {
    /// Create a new ExportService instance.
    pub fn new() -> Self {
        todo!()
    }

    // ── Resume Export ───────────────────────────────────────────────

    /// Compile a resume to its JSON intermediate representation.
    ///
    /// Returns the full `ResumeDocument` IR tree. Returns a `NOT_FOUND`
    /// error if the resume does not exist.
    pub fn get_json(&self, resume_id: &str) -> Result<ResumeDocument, ForgeError> {
        todo!()
    }

    /// Export a resume as Markdown.
    ///
    /// If the resume has a `markdown_override`, returns that directly.
    /// Otherwise compiles the resume IR and renders to Markdown.
    ///
    /// Returns a `NOT_FOUND` error if the resume does not exist.
    pub fn get_markdown(&self, resume_id: &str) -> Result<String, ForgeError> {
        todo!()
    }

    /// Export a resume as LaTeX source.
    ///
    /// If the resume has a `latex_override`, returns that directly.
    /// Otherwise compiles the resume IR and renders to LaTeX using the
    /// sb2nov template.
    ///
    /// Returns a `NOT_FOUND` error if the resume does not exist.
    pub fn get_latex(&self, resume_id: &str) -> Result<String, ForgeError> {
        todo!()
    }

    // ── Data Export ─────────────────────────────────────────────────

    /// Export data for the specified entity types into a bundle.
    ///
    /// Supported entity names: `"sources"`, `"bullets"`, `"perspectives"`,
    /// `"skills"`, `"organizations"`, `"summaries"`, `"job_descriptions"`.
    ///
    /// Unknown entity names are silently ignored. Each recognized entity
    /// type is fetched with a large limit and included in the bundle.
    pub fn export_data(&self, entities: &[String]) -> Result<DataExportBundle, ForgeError> {
        todo!()
    }

    // ── Database Dump ───────────────────────────────────────────────

    /// Produce a full SQL dump of the SQLite database.
    ///
    /// Shells out to `sqlite3 <db_path> .dump` and returns the SQL text.
    ///
    /// Returns a `DUMP_FAILED` error if `sqlite3` is not on PATH or the
    /// dump command exits with a non-zero status.
    pub fn dump_database(&self) -> Result<String, ForgeError> {
        todo!()
    }
}
