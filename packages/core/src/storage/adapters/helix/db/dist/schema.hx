// === contacts.hx ===
N::Contacts {
    UNIQUE INDEX id: String,
    name: String,
    title: String,
    email: String,
    phone: String,
    linkedin: String,
    team: String,
    dept: String,
    notes: String,
    organization_id: String,
    created_at: String,
    updated_at: String
}

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
    notes: String,
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
    notes: String,
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
    notes: String,
    created_at: String
}

// === edges.hx ===
E::BulletSkills {
    From: Bullets,
    To: Skills
}

E::BulletSources {
    From: Bullets,
    To: Sources,
    Properties: {
        is_primary: Boolean DEFAULT false
    }
}

E::PerspectiveSkills {
    From: Perspectives,
    To: Skills
}

E::SourceSkills {
    From: Sources,
    To: Skills
}

E::SkillDomains {
    From: Skills,
    To: Domains,
    Properties: {
        created_at: String
    }
}

E::ArchetypeDomains {
    From: Archetypes,
    To: Domains,
    Properties: {
        created_at: String
    }
}

E::JobDescriptionSkills {
    From: JobDescriptions,
    To: Skills
}

E::JobDescriptionResumes {
    From: JobDescriptions,
    To: Resumes,
    Properties: {
        created_at: String
    }
}

E::SummarySkills {
    From: Summaries,
    To: Skills,
    Properties: {
        created_at: String
    }
}

E::CertificationSkills {
    From: Certifications,
    To: Skills,
    Properties: {
        created_at: String
    }
}

E::ContactOrganizations {
    From: Contacts,
    To: Organizations,
    Properties: {
        relationship: String
    }
}

E::ContactJobDescriptions {
    From: Contacts,
    To: JobDescriptions,
    Properties: {
        relationship: String
    }
}

E::ContactResumes {
    From: Contacts,
    To: Resumes,
    Properties: {
        relationship: String
    }
}

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
    notes: String,
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

// === organizations.hx ===
N::Organizations {
    UNIQUE INDEX id: String,
    name: String,
    org_type: String DEFAULT "company",
    industry: String,
    size: String,
    worked: Boolean DEFAULT false,
    employment_type: String,
    website: String,
    linkedin_url: String,
    glassdoor_url: String,
    glassdoor_rating: F64,
    reputation_notes: String,
    notes: String,
    status: String,
    created_at: String,
    updated_at: String,
    industry_id: String
}

N::OrgCampuses {
    UNIQUE INDEX id: String,
    organization_id: String,
    name: String,
    modality: String DEFAULT "in_person",
    address: String,
    city: String,
    state: String,
    country: String,
    created_at: String,
    zipcode: String,
    is_headquarters: Boolean DEFAULT false
}

N::OrgAliases {
    UNIQUE INDEX id: String,
    organization_id: String,
    alias: String
}

N::OrgTags {
    organization_id: String,
    tag: String
}

// === qualifications.hx ===
N::Credentials {
    UNIQUE INDEX id: String,
    credential_type: String,
    label: String,
    status: String DEFAULT "active",
    organization_id: String,
    details: String,
    issued_date: String,
    expiry_date: String,
    created_at: String,
    updated_at: String
}

N::Certifications {
    UNIQUE INDEX id: String,
    short_name: String,
    long_name: String,
    cert_id: String,
    issuer_id: String,
    date_earned: String,
    expiry_date: String,
    credential_id: String,
    credential_url: String,
    credly_url: String,
    in_progress: Boolean DEFAULT false,
    created_at: String,
    updated_at: String
}

// === resumes.hx ===
N::Resumes {
    UNIQUE INDEX id: String,
    name: String,
    target_role: String,
    target_employer: String,
    archetype: String,
    status: String DEFAULT "draft",
    notes: String,
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
    notes: String,
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

// === system.hx ===
N::PromptLogs {
    UNIQUE INDEX id: String,
    entity_type: String,
    entity_id: String,
    prompt_template: String,
    prompt_input: String,
    raw_response: String,
    created_at: String
}

N::Embeddings {
    UNIQUE INDEX id: String,
    entity_type: String,
    entity_id: String,
    content_hash: String,
    vector: String,
    created_at: String
}

N::PendingDerivations {
    UNIQUE INDEX id: String,
    entity_type: String,
    entity_id: String,
    client_id: String,
    prompt: String,
    snapshot: String,
    derivation_params: String,
    locked_at: String,
    expires_at: String,
    created_at: String
}

// === taxonomy.hx ===
N::Skills {
    UNIQUE INDEX id: String,
    UNIQUE INDEX name: String,
    category: String DEFAULT "other",
    notes: String,
    created_at: String
}

N::SkillCategories {
    UNIQUE INDEX id: String,
    UNIQUE INDEX slug: String,
    display_name: String,
    position: I64 DEFAULT 0
}

N::Domains {
    UNIQUE INDEX id: String,
    UNIQUE INDEX name: String,
    description: String,
    created_at: String
}

N::Archetypes {
    UNIQUE INDEX id: String,
    UNIQUE INDEX name: String,
    description: String,
    created_at: String
}

N::Industries {
    UNIQUE INDEX id: String,
    UNIQUE INDEX name: String,
    description: String,
    created_at: String
}

N::RoleTypes {
    UNIQUE INDEX id: String,
    UNIQUE INDEX name: String,
    description: String,
    created_at: String
}

// === user.hx ===
N::Addresses {
    UNIQUE INDEX id: String,
    name: String,
    street_1: String,
    street_2: String,
    city: String,
    state: String,
    zip: String,
    country_code: String DEFAULT "US",
    created_at: String,
    updated_at: String
}

N::ProfileUrls {
    UNIQUE INDEX id: String,
    profile_id: String,
    key: String,
    url: String,
    position: I64 DEFAULT 0,
    created_at: String
}

N::UserProfile {
    UNIQUE INDEX id: String,
    name: String,
    email: String,
    phone: String,
    address_id: String,
    salary_minimum: I64,
    salary_target: I64,
    salary_stretch: I64,
    created_at: String,
    updated_at: String
}

N::UserNotes {
    UNIQUE INDEX id: String,
    title: String,
    content: String,
    created_at: String,
    updated_at: String
}

N::NoteReferences {
    note_id: String,
    entity_type: String,
    entity_id: String
}

// === vectors.hx ===
V::BulletEmbedding {
    entity_id: String,
    content_hash: String,
    created_at: String
}

V::PerspectiveEmbedding {
    entity_id: String,
    content_hash: String,
    created_at: String
}

V::JdRequirementEmbedding {
    entity_id: String,
    content_hash: String,
    created_at: String
}

V::SourceEmbedding {
    entity_id: String,
    content_hash: String,
    created_at: String
}
