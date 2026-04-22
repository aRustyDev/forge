// === taxonomy.hx ===

N::Skills {
    UNIQUE INDEX id: String,
    UNIQUE INDEX name: String,
    category: String DEFAULT "other",
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
