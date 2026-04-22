// === content.hx ===

N::Sources {
    UNIQUE INDEX id: String,
    title: String,
    description: String,
    source_type: String DEFAULT "general",
    start_date: String,
    end_date: String,
    status: String DEFAULT "draft",
    updated_by: String DEFAULT "human",
    last_derived_at: String,
    created_at: String,
    updated_at: String
}

N::SourceRoles {
    source_id: String,
    organization_id: String,
    start_date: String,
    end_date: String,
    is_current: Boolean DEFAULT false,
    work_arrangement: String,
    base_salary: I64,
    total_comp_notes: String
}

N::SourceProjects {
    source_id: String,
    organization_id: String,
    is_personal: Boolean DEFAULT false,
    url: String,
    start_date: String,
    end_date: String,
    open_source: Boolean DEFAULT false
}

N::SourceEducation {
    source_id: String,
    education_type: String,
    organization_id: String,
    campus_id: String,
    field: String,
    start_date: String,
    end_date: String,
    is_in_progress: Boolean DEFAULT false,
    credential_id: String,
    expiration_date: String,
    url: String,
    degree_level: String,
    degree_type: String,
    certificate_subtype: String,
    gpa: String,
    location: String,
    edu_description: String
}

N::SourcePresentations {
    source_id: String,
    venue: String,
    presentation_type: String DEFAULT "conference_talk",
    url: String,
    coauthors: String
}

N::Bullets {
    UNIQUE INDEX id: String,
    content: String,
    source_content_snapshot: String,
    metrics: String,
    status: String DEFAULT "in_review",
    rejection_reason: String,
    prompt_log_id: String,
    approved_at: String,
    approved_by: String,
    domain: String,
    created_at: String
}

N::Perspectives {
    UNIQUE INDEX id: String,
    bullet_id: String,
    content: String,
    bullet_content_snapshot: String,
    target_archetype: String,
    domain: String,
    framing: String,
    status: String DEFAULT "in_review",
    rejection_reason: String,
    prompt_log_id: String,
    approved_at: String,
    approved_by: String,
    created_at: String
}
