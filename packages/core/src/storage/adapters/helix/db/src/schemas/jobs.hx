// === jobs.hx ===

N::JobDescriptions {
    UNIQUE INDEX id: String,
    organization_id: String,
    title: String,
    url: String,
    raw_text: String,
    status: String DEFAULT "discovered",
    salary_range: String,
    salary_min: I64,
    salary_max: I64,
    location: String,
    created_at: String,
    updated_at: String
}

N::Summaries {
    UNIQUE INDEX id: String,
    title: String,
    role: String,
    description: String,
    is_template: Boolean DEFAULT false,
    industry_id: String,
    role_type_id: String,
    notes: String,
    created_at: String,
    updated_at: String
}
