export type {
  Section,
  SectionCategory,
  ClassifiedSection,
  SalaryRange,
  ParsedJobDescription,
} from './types'

import { splitSections } from './l1-splitter'
import { classifySections } from './l2-classifier'
import { extractSalary, extractLocations, extractWorkPosture } from './l3-extractors'
import type { ParsedJobDescription } from './types'

export function parseJobDescription(rawText: string): ParsedJobDescription {
  const sections = splitSections(rawText)
  const classified = classifySections(sections)
  const salary = extractSalary(classified)
  const locations = extractLocations(classified)
  const workPosture = extractWorkPosture(classified)
  return { sections: classified, salary, locations, workPosture }
}

export { splitSections } from './l1-splitter'
export { classifySections } from './l2-classifier'
export { extractSalary, extractLocations, extractWorkPosture } from './l3-extractors'
