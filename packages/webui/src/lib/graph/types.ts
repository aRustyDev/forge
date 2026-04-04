export interface ChainNode {
  id: string
  label: string
  type: 'source' | 'bullet' | 'perspective' | 'resume_entry'
  content: string
  status: string
  sourceType?: string // for source nodes: 'role' | 'project' | 'education' | 'clearance' | 'general'
  archetype?: string // for perspective nodes
  domain?: string // for perspective/bullet nodes
}

export interface ChainEdge {
  source: string
  target: string
  drifted: boolean // true if snapshot does not match current content
  isPrimary: boolean // true if this is the primary source link
}

export const NODE_COLORS: Record<ChainNode['type'], string> = {
  source: '#6c63ff', // purple
  bullet: '#3b82f6', // blue
  perspective: '#10b981', // green
  resume_entry: '#f59e0b', // amber
}
