/**
 * Slugify a string for use in filenames.
 *
 * Converts to lowercase, replaces non-alphanumeric runs with hyphens,
 * and strips leading/trailing hyphens.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
