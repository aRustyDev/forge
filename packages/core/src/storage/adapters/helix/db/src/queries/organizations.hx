// === organizations.hx ===

QUERY AddOrganizations(id?: String, name?: String, org_type?: String, industry?: String, size?: String, worked?: Boolean, employment_type?: String, website?: String, linkedin_url?: String, glassdoor_url?: String, glassdoor_rating?: F64, status?: String, created_at?: String, updated_at?: String, industry_id?: String) =>
    node <- AddN<Organizations>({id: id, name: name, org_type: org_type, industry: industry, size: size, worked: worked, employment_type: employment_type, website: website, linkedin_url: linkedin_url, glassdoor_url: glassdoor_url, glassdoor_rating: glassdoor_rating, status: status, created_at: created_at, updated_at: updated_at, industry_id: industry_id})
    RETURN node

QUERY GetOrganizations(id: String) =>
    node <- N<Organizations>({id: id})::FIRST
    RETURN node

QUERY UpdateOrganizations(id: String, name?: String, org_type?: String, industry?: String, size?: String, worked?: Boolean, employment_type?: String, website?: String, linkedin_url?: String, glassdoor_url?: String, glassdoor_rating?: F64, status?: String, created_at?: String, updated_at?: String, industry_id?: String) =>
    node <- N<Organizations>({id: id})::FIRST
    node <- node::UPDATE({name: name, org_type: org_type, industry: industry, size: size, worked: worked, employment_type: employment_type, website: website, linkedin_url: linkedin_url, glassdoor_url: glassdoor_url, glassdoor_rating: glassdoor_rating, status: status, created_at: created_at, updated_at: updated_at, industry_id: industry_id})
    RETURN node

QUERY DeleteOrganizations(id: String) =>
    node <- N<Organizations>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListOrganizations(offset: U32, limit: U32) =>
    nodes <- N<Organizations>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllOrganizations() =>
    nodes <- N<Organizations>
    RETURN nodes

QUERY CountOrganizations() =>
    count <- N<Organizations>::COUNT
    RETURN count

QUERY AddOrgCampuses(id?: String, organization_id?: String, name?: String, modality?: String, address?: String, city?: String, state?: String, country?: String, created_at?: String, zipcode?: String, is_headquarters?: Boolean) =>
    node <- AddN<OrgCampuses>({id: id, organization_id: organization_id, name: name, modality: modality, address: address, city: city, state: state, country: country, created_at: created_at, zipcode: zipcode, is_headquarters: is_headquarters})
    RETURN node

QUERY GetOrgCampuses(id: String) =>
    node <- N<OrgCampuses>({id: id})::FIRST
    RETURN node

QUERY UpdateOrgCampuses(id: String, organization_id?: String, name?: String, modality?: String, address?: String, city?: String, state?: String, country?: String, created_at?: String, zipcode?: String, is_headquarters?: Boolean) =>
    node <- N<OrgCampuses>({id: id})::FIRST
    node <- node::UPDATE({organization_id: organization_id, name: name, modality: modality, address: address, city: city, state: state, country: country, created_at: created_at, zipcode: zipcode, is_headquarters: is_headquarters})
    RETURN node

QUERY DeleteOrgCampuses(id: String) =>
    node <- N<OrgCampuses>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListOrgCampuses(offset: U32, limit: U32) =>
    nodes <- N<OrgCampuses>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllOrgCampuses() =>
    nodes <- N<OrgCampuses>
    RETURN nodes

QUERY CountOrgCampuses() =>
    count <- N<OrgCampuses>::COUNT
    RETURN count

QUERY AddOrgTags(organization_id?: String, tag?: String) =>
    node <- AddN<OrgTags>({organization_id: organization_id, tag: tag})
    RETURN node

QUERY ListOrgTags(offset: U32, limit: U32) =>
    nodes <- N<OrgTags>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllOrgTags() =>
    nodes <- N<OrgTags>
    RETURN nodes

QUERY CountOrgTags() =>
    count <- N<OrgTags>::COUNT
    RETURN count

QUERY AddOrgAliases(id?: String, organization_id?: String, alias?: String) =>
    node <- AddN<OrgAliases>({id: id, organization_id: organization_id, alias: alias})
    RETURN node

QUERY GetOrgAliases(id: String) =>
    node <- N<OrgAliases>({id: id})::FIRST
    RETURN node

QUERY UpdateOrgAliases(id: String, organization_id?: String, alias?: String) =>
    node <- N<OrgAliases>({id: id})::FIRST
    node <- node::UPDATE({organization_id: organization_id, alias: alias})
    RETURN node

QUERY DeleteOrgAliases(id: String) =>
    node <- N<OrgAliases>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListOrgAliases(offset: U32, limit: U32) =>
    nodes <- N<OrgAliases>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllOrgAliases() =>
    nodes <- N<OrgAliases>
    RETURN nodes

QUERY CountOrgAliases() =>
    count <- N<OrgAliases>::COUNT
    RETURN count
