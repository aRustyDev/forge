// === resumes.hx ===

N::Resumes {
    UNIQUE INDEX id: String,
    name: String,
    target_role: String,
    target_employer: String,
    archetype: String,
    status: String DEFAULT "draft",
    header: String,
    summary_id: String,
    markdown_override: String,
    markdown_override_updated_at: String,
    latex_override: String,
    latex_override_updated_at: String,
    created_at: String,
    updated_at: String,
    generated_tagline: String,
    tagline_override: String,
    summary_override: String,
    summary_override_updated_at: String,
    show_clearance_in_header: Boolean DEFAULT true
}

N::ResumeSections {
    UNIQUE INDEX id: String,
    resume_id: String,
    title: String,
    entry_type: String,
    position: I64 DEFAULT 0,
    created_at: String,
    updated_at: String
}

N::ResumeEntries {
    UNIQUE INDEX id: String,
    resume_id: String,
    section_id: String,
    perspective_id: String,
    content: String,
    perspective_content_snapshot: String,
    position: I64 DEFAULT 0,
    created_at: String,
    updated_at: String,
    source_id: String
}

N::ResumeSkills {
    UNIQUE INDEX id: String,
    section_id: String,
    skill_id: String,
    position: I64 DEFAULT 0,
    created_at: String
}

N::ResumeCertifications {
    UNIQUE INDEX id: String,
    resume_id: String,
    certification_id: String,
    section_id: String,
    position: I64 DEFAULT 0,
    created_at: String
}

N::ResumeTemplates {
    UNIQUE INDEX id: String,
    name: String,
    description: String,
    sections: String,
    is_builtin: Boolean DEFAULT false,
    created_at: String,
    updated_at: String
}
