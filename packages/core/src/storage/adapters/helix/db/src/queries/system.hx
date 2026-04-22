// === system.hx ===

QUERY AddPromptLogs(id?: String, entity_type?: String, entity_id?: String, prompt_template?: String, prompt_input?: String, raw_response?: String, created_at?: String) =>
    node <- AddN<PromptLogs>({id: id, entity_type: entity_type, entity_id: entity_id, prompt_template: prompt_template, prompt_input: prompt_input, raw_response: raw_response, created_at: created_at})
    RETURN node

QUERY GetPromptLogs(id: String) =>
    node <- N<PromptLogs>({id: id})::FIRST
    RETURN node

QUERY UpdatePromptLogs(id: String, entity_type?: String, entity_id?: String, prompt_template?: String, prompt_input?: String, raw_response?: String, created_at?: String) =>
    node <- N<PromptLogs>({id: id})::FIRST
    node <- node::UPDATE({entity_type: entity_type, entity_id: entity_id, prompt_template: prompt_template, prompt_input: prompt_input, raw_response: raw_response, created_at: created_at})
    RETURN node

QUERY DeletePromptLogs(id: String) =>
    node <- N<PromptLogs>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListPromptLogs(offset: U32, limit: U32) =>
    nodes <- N<PromptLogs>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllPromptLogs() =>
    nodes <- N<PromptLogs>
    RETURN nodes

QUERY CountPromptLogs() =>
    count <- N<PromptLogs>::COUNT
    RETURN count

QUERY AddEmbeddings(id?: String, entity_type?: String, entity_id?: String, content_hash?: String, vector?: String, created_at?: String) =>
    node <- AddN<Embeddings>({id: id, entity_type: entity_type, entity_id: entity_id, content_hash: content_hash, vector: vector, created_at: created_at})
    RETURN node

QUERY GetEmbeddings(id: String) =>
    node <- N<Embeddings>({id: id})::FIRST
    RETURN node

QUERY UpdateEmbeddings(id: String, entity_type?: String, entity_id?: String, content_hash?: String, vector?: String, created_at?: String) =>
    node <- N<Embeddings>({id: id})::FIRST
    node <- node::UPDATE({entity_type: entity_type, entity_id: entity_id, content_hash: content_hash, vector: vector, created_at: created_at})
    RETURN node

QUERY DeleteEmbeddings(id: String) =>
    node <- N<Embeddings>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListEmbeddings(offset: U32, limit: U32) =>
    nodes <- N<Embeddings>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllEmbeddings() =>
    nodes <- N<Embeddings>
    RETURN nodes

QUERY CountEmbeddings() =>
    count <- N<Embeddings>::COUNT
    RETURN count

QUERY AddPendingDerivations(id?: String, entity_type?: String, entity_id?: String, client_id?: String, prompt?: String, snapshot?: String, derivation_params?: String, locked_at?: String, expires_at?: String, created_at?: String) =>
    node <- AddN<PendingDerivations>({id: id, entity_type: entity_type, entity_id: entity_id, client_id: client_id, prompt: prompt, snapshot: snapshot, derivation_params: derivation_params, locked_at: locked_at, expires_at: expires_at, created_at: created_at})
    RETURN node

QUERY GetPendingDerivations(id: String) =>
    node <- N<PendingDerivations>({id: id})::FIRST
    RETURN node

QUERY UpdatePendingDerivations(id: String, entity_type?: String, entity_id?: String, client_id?: String, prompt?: String, snapshot?: String, derivation_params?: String, locked_at?: String, expires_at?: String, created_at?: String) =>
    node <- N<PendingDerivations>({id: id})::FIRST
    node <- node::UPDATE({entity_type: entity_type, entity_id: entity_id, client_id: client_id, prompt: prompt, snapshot: snapshot, derivation_params: derivation_params, locked_at: locked_at, expires_at: expires_at, created_at: created_at})
    RETURN node

QUERY DeletePendingDerivations(id: String) =>
    node <- N<PendingDerivations>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListPendingDerivations(offset: U32, limit: U32) =>
    nodes <- N<PendingDerivations>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllPendingDerivations() =>
    nodes <- N<PendingDerivations>
    RETURN nodes

QUERY CountPendingDerivations() =>
    count <- N<PendingDerivations>::COUNT
    RETURN count
