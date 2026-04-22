/**
 * Resolve a company name to an organization ID.
 *
 * Strategy (SPEC §4 P5):
 * 1. Search existing orgs by name
 * 2. If exact name match (case-insensitive) → use that org
 * 3. If no results → create new org
 * 4. If partial matches but no exact → pick first (prototype; MVP disambiguates)
 *
 * Returns null if companyName is empty or if both search and create fail.
 */
export async function resolveOrganization(
  companyName: string | null,
  searchOrgs: (search: string) => Promise<{ ok: boolean; data?: { id: string; name: string }[] }>,
  createOrg: (name: string, opts?: { linkedin_url?: string }) => Promise<{ ok: boolean; data?: { id: string; name: string } }>,
  opts?: { linkedin_url?: string },
): Promise<string | null> {
  if (!companyName?.trim()) return null

  const searchResult = await searchOrgs(companyName)
  if (!searchResult.ok || !searchResult.data) return null

  // Exact match (case-insensitive)
  const exact = searchResult.data.find(
    (org) => org.name.toLowerCase() === companyName.toLowerCase(),
  )
  if (exact) return exact.id

  // No results → create
  if (searchResult.data.length === 0) {
    const createResult = await createOrg(companyName, { linkedin_url: opts?.linkedin_url })
    return createResult.ok && createResult.data ? createResult.data.id : null
  }

  // Partial matches → prototype picks first
  return searchResult.data[0].id
}
