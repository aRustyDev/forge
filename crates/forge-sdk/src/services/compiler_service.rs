//! Resume IR compiler service — transforms resume data into `ResumeDocument`.
//!
//! Reads resume sections from the database and dispatches to section-type
//! builders. Each builder queries entries via `section_id` and assembles
//! the appropriate IR items (experience groups, skill groups, education
//! items, etc.).
//!
//! The compiled `ResumeDocument` is the intermediate representation used
//! by all rendering backends (Markdown, LaTeX, JSON).
//!
//! TS source: `packages/core/src/services/resume-compiler.ts`

use forge_core::{ForgeError, ResumeDocument};

/// Resume IR compiler that assembles a `ResumeDocument` from database state.
///
/// The compiler reads resume metadata, user profile, resume sections, and
/// their entries, then dispatches to section-type builders (experience,
/// skills, education, projects, certifications, clearance, presentations)
/// to produce the final IR tree.
pub struct CompilerService {
    // database / ELM handle will be injected here
}

impl CompilerService {
    /// Create a new CompilerService instance.
    pub fn new() -> Self {
        todo!()
    }

    /// Compile a resume into the intermediate representation.
    ///
    /// Reads the resume row, user profile (for header contact fields),
    /// resume sections, and all entries. Returns `None` if the resume
    /// does not exist.
    ///
    /// The compiled document includes:
    /// - Header with contact info, tagline, and optional clearance line
    /// - Summary (from summary_id or summary_override)
    /// - Sections dispatched by entry_type (experience, skills, education,
    ///   projects, certifications, clearance, presentations, freeform)
    pub fn compile(&self, resume_id: &str) -> Result<Option<ResumeDocument>, ForgeError> {
        todo!()
    }

    /// Render a compiled `ResumeDocument` to LaTeX source using the
    /// sb2nov template.
    ///
    /// The LaTeX output is a complete document ready for `pdflatex`
    /// compilation.
    pub fn render_latex(&self, doc: &ResumeDocument) -> Result<String, ForgeError> {
        todo!()
    }

    /// Render a compiled `ResumeDocument` to Markdown.
    ///
    /// The Markdown output uses standard heading levels and bullet lists,
    /// suitable for preview or plain-text export.
    pub fn render_markdown(&self, doc: &ResumeDocument) -> Result<String, ForgeError> {
        todo!()
    }
}
