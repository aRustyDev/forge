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
