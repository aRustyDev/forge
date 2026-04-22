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
