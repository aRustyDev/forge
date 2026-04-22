// === taxonomy.hx ===

QUERY AddSkills(id?: String, name?: String, category?: String, created_at?: String) =>
    node <- AddN<Skills>({id: id, name: name, category: category, created_at: created_at})
    RETURN node

QUERY GetSkills(id: String) =>
    node <- N<Skills>({id: id})::FIRST
    RETURN node

QUERY GetSkillsByName(name: String) =>
    nodes <- N<Skills>({name: name})
    RETURN nodes

QUERY UpdateSkills(id: String, name?: String, category?: String, created_at?: String) =>
    node <- N<Skills>({id: id})::FIRST
    node <- node::UPDATE({name: name, category: category, created_at: created_at})
    RETURN node

QUERY DeleteSkills(id: String) =>
    node <- N<Skills>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListSkills(offset: U32, limit: U32) =>
    nodes <- N<Skills>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSkills() =>
    nodes <- N<Skills>
    RETURN nodes

QUERY CountSkills() =>
    count <- N<Skills>::COUNT
    RETURN count

QUERY AddSkillCategories(id?: String, slug?: String, display_name?: String, position?: I64) =>
    node <- AddN<SkillCategories>({id: id, slug: slug, display_name: display_name, position: position})
    RETURN node

QUERY GetSkillCategories(id: String) =>
    node <- N<SkillCategories>({id: id})::FIRST
    RETURN node

QUERY GetSkillCategoriesBySlug(slug: String) =>
    nodes <- N<SkillCategories>({slug: slug})
    RETURN nodes

QUERY UpdateSkillCategories(id: String, slug?: String, display_name?: String, position?: I64) =>
    node <- N<SkillCategories>({id: id})::FIRST
    node <- node::UPDATE({slug: slug, display_name: display_name, position: position})
    RETURN node

QUERY DeleteSkillCategories(id: String) =>
    node <- N<SkillCategories>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListSkillCategories(offset: U32, limit: U32) =>
    nodes <- N<SkillCategories>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSkillCategories() =>
    nodes <- N<SkillCategories>
    RETURN nodes

QUERY CountSkillCategories() =>
    count <- N<SkillCategories>::COUNT
    RETURN count

QUERY AddDomains(id?: String, name?: String, description?: String, created_at?: String) =>
    node <- AddN<Domains>({id: id, name: name, description: description, created_at: created_at})
    RETURN node

QUERY GetDomains(id: String) =>
    node <- N<Domains>({id: id})::FIRST
    RETURN node

QUERY GetDomainsByName(name: String) =>
    nodes <- N<Domains>({name: name})
    RETURN nodes

QUERY UpdateDomains(id: String, name?: String, description?: String, created_at?: String) =>
    node <- N<Domains>({id: id})::FIRST
    node <- node::UPDATE({name: name, description: description, created_at: created_at})
    RETURN node

QUERY DeleteDomains(id: String) =>
    node <- N<Domains>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListDomains(offset: U32, limit: U32) =>
    nodes <- N<Domains>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllDomains() =>
    nodes <- N<Domains>
    RETURN nodes

QUERY CountDomains() =>
    count <- N<Domains>::COUNT
    RETURN count

QUERY AddArchetypes(id?: String, name?: String, description?: String, created_at?: String) =>
    node <- AddN<Archetypes>({id: id, name: name, description: description, created_at: created_at})
    RETURN node

QUERY GetArchetypes(id: String) =>
    node <- N<Archetypes>({id: id})::FIRST
    RETURN node

QUERY GetArchetypesByName(name: String) =>
    nodes <- N<Archetypes>({name: name})
    RETURN nodes

QUERY UpdateArchetypes(id: String, name?: String, description?: String, created_at?: String) =>
    node <- N<Archetypes>({id: id})::FIRST
    node <- node::UPDATE({name: name, description: description, created_at: created_at})
    RETURN node

QUERY DeleteArchetypes(id: String) =>
    node <- N<Archetypes>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListArchetypes(offset: U32, limit: U32) =>
    nodes <- N<Archetypes>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllArchetypes() =>
    nodes <- N<Archetypes>
    RETURN nodes

QUERY CountArchetypes() =>
    count <- N<Archetypes>::COUNT
    RETURN count

QUERY AddIndustries(id?: String, name?: String, description?: String, created_at?: String) =>
    node <- AddN<Industries>({id: id, name: name, description: description, created_at: created_at})
    RETURN node

QUERY GetIndustries(id: String) =>
    node <- N<Industries>({id: id})::FIRST
    RETURN node

QUERY GetIndustriesByName(name: String) =>
    nodes <- N<Industries>({name: name})
    RETURN nodes

QUERY UpdateIndustries(id: String, name?: String, description?: String, created_at?: String) =>
    node <- N<Industries>({id: id})::FIRST
    node <- node::UPDATE({name: name, description: description, created_at: created_at})
    RETURN node

QUERY DeleteIndustries(id: String) =>
    node <- N<Industries>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListIndustries(offset: U32, limit: U32) =>
    nodes <- N<Industries>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllIndustries() =>
    nodes <- N<Industries>
    RETURN nodes

QUERY CountIndustries() =>
    count <- N<Industries>::COUNT
    RETURN count

QUERY AddRoleTypes(id?: String, name?: String, description?: String, created_at?: String) =>
    node <- AddN<RoleTypes>({id: id, name: name, description: description, created_at: created_at})
    RETURN node

QUERY GetRoleTypes(id: String) =>
    node <- N<RoleTypes>({id: id})::FIRST
    RETURN node

QUERY GetRoleTypesByName(name: String) =>
    nodes <- N<RoleTypes>({name: name})
    RETURN nodes

QUERY UpdateRoleTypes(id: String, name?: String, description?: String, created_at?: String) =>
    node <- N<RoleTypes>({id: id})::FIRST
    node <- node::UPDATE({name: name, description: description, created_at: created_at})
    RETURN node

QUERY DeleteRoleTypes(id: String) =>
    node <- N<RoleTypes>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListRoleTypes(offset: U32, limit: U32) =>
    nodes <- N<RoleTypes>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllRoleTypes() =>
    nodes <- N<RoleTypes>
    RETURN nodes

QUERY CountRoleTypes() =>
    count <- N<RoleTypes>::COUNT
    RETURN count
