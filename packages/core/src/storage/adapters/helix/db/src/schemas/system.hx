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
