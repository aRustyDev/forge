// === contacts.hx ===

QUERY AddContacts(id?: String, name?: String, title?: String, email?: String, phone?: String, linkedin?: String, team?: String, dept?: String, notes?: String, organization_id?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<Contacts>({id: id, name: name, title: title, email: email, phone: phone, linkedin: linkedin, team: team, dept: dept, notes: notes, organization_id: organization_id, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetContacts(id: String) =>
    node <- N<Contacts>({id: id})::FIRST
    RETURN node

QUERY UpdateContacts(id: String, name?: String, title?: String, email?: String, phone?: String, linkedin?: String, team?: String, dept?: String, notes?: String, organization_id?: String, created_at?: String, updated_at?: String) =>
    node <- N<Contacts>({id: id})::FIRST
    node <- node::UPDATE({name: name, title: title, email: email, phone: phone, linkedin: linkedin, team: team, dept: dept, notes: notes, organization_id: organization_id, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteContacts(id: String) =>
    node <- N<Contacts>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListContacts(offset: U32, limit: U32) =>
    nodes <- N<Contacts>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllContacts() =>
    nodes <- N<Contacts>
    RETURN nodes

QUERY CountContacts() =>
    count <- N<Contacts>::COUNT
    RETURN count
