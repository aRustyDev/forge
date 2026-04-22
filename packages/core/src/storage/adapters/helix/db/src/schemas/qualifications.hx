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
