export interface Section {
  heading: string | null
  text: string
  byteOffset: number
}

export type SectionCategory =
  | 'responsibilities'
  | 'requirements'
  | 'preferred'
  | 'description'
  | 'location'
  | 'compensation'
  | 'benefits'
  | 'about_company'
  | 'eeo'

export interface ClassifiedSection extends Section {
  category: SectionCategory
  confidence: number
}

export interface SalaryRange {
  min: number
  max: number
  period: 'annual' | 'hourly' | 'unknown'
}

export interface ParsedJobDescription {
  sections: ClassifiedSection[]
  salary: SalaryRange | null
  locations: string[]
  workPosture: 'remote' | 'hybrid' | 'on-site' | null
}
