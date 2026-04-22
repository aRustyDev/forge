// === jobs.hx ===

QUERY AddSummaries(id?: String, title?: String, role?: String, description?: String, is_template?: Boolean, industry_id?: String, role_type_id?: String, notes?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<Summaries>({id: id, title: title, role: role, description: description, is_template: is_template, industry_id: industry_id, role_type_id: role_type_id, notes: notes, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetSummaries(id: String) =>
    node <- N<Summaries>({id: id})::FIRST
    RETURN node

QUERY UpdateSummaries(id: String, title?: String, role?: String, description?: String, is_template?: Boolean, industry_id?: String, role_type_id?: String, notes?: String, created_at?: String, updated_at?: String) =>
    node <- N<Summaries>({id: id})::FIRST
    node <- node::UPDATE({title: title, role: role, description: description, is_template: is_template, industry_id: industry_id, role_type_id: role_type_id, notes: notes, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteSummaries(id: String) =>
    node <- N<Summaries>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListSummaries(offset: U32, limit: U32) =>
    nodes <- N<Summaries>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSummaries() =>
    nodes <- N<Summaries>
    RETURN nodes

QUERY CountSummaries() =>
    count <- N<Summaries>::COUNT
    RETURN count

QUERY AddJobDescriptions(id?: String, organization_id?: String, title?: String, url?: String, raw_text?: String, status?: String, salary_range?: String, salary_min?: I64, salary_max?: I64, location?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<JobDescriptions>({id: id, organization_id: organization_id, title: title, url: url, raw_text: raw_text, status: status, salary_range: salary_range, salary_min: salary_min, salary_max: salary_max, location: location, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetJobDescriptions(id: String) =>
    node <- N<JobDescriptions>({id: id})::FIRST
    RETURN node

QUERY UpdateJobDescriptions(id: String, organization_id?: String, title?: String, url?: String, raw_text?: String, status?: String, salary_range?: String, salary_min?: I64, salary_max?: I64, location?: String, created_at?: String, updated_at?: String) =>
    node <- N<JobDescriptions>({id: id})::FIRST
    node <- node::UPDATE({organization_id: organization_id, title: title, url: url, raw_text: raw_text, status: status, salary_range: salary_range, salary_min: salary_min, salary_max: salary_max, location: location, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteJobDescriptions(id: String) =>
    node <- N<JobDescriptions>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListJobDescriptions(offset: U32, limit: U32) =>
    nodes <- N<JobDescriptions>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllJobDescriptions() =>
    nodes <- N<JobDescriptions>
    RETURN nodes

QUERY CountJobDescriptions() =>
    count <- N<JobDescriptions>::COUNT
    RETURN count
