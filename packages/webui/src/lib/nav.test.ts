import { describe, it, expect } from 'vitest'
import { navigation, isNavGroup } from './nav'
import type { NavEntry, NavGroup, NavItem } from './nav'

describe('nav', () => {
  describe('isNavGroup', () => {
    it('returns true for entries with children', () => {
      const group: NavGroup = { label: 'Data', prefix: '/data', children: [{ href: '/data/x', label: 'X' }] }
      expect(isNavGroup(group)).toBe(true)
    })

    it('returns false for plain NavItem', () => {
      const item: NavItem = { href: '/', label: 'Dashboard' }
      expect(isNavGroup(item)).toBe(false)
    })
  })

  describe('navigation', () => {
    it('has 6 top-level entries', () => {
      // Dashboard + Experience + Qualifications + Data + Opportunities + Resumes
      expect(navigation).toHaveLength(6)
    })

    it('starts with Dashboard as a plain link', () => {
      expect(isNavGroup(navigation[0])).toBe(false)
      expect((navigation[0] as NavItem).href).toBe('/')
      expect((navigation[0] as NavItem).label).toBe('Dashboard')
    })

    it('has Experience group with 4 children (Clearances removed in Phase 84)', () => {
      const exp = navigation[1]
      expect(isNavGroup(exp)).toBe(true)
      expect((exp as NavGroup).label).toBe('Experience')
      expect((exp as NavGroup).children).toHaveLength(4)
    })

    it('has Qualifications group with 2 children (Phase 87)', () => {
      const qual = navigation[2]
      expect(isNavGroup(qual)).toBe(true)
      expect((qual as NavGroup).label).toBe('Qualifications')
      expect((qual as NavGroup).children).toHaveLength(2)
    })

    it('has Data group with 6 children', () => {
      const data = navigation[3]
      expect(isNavGroup(data)).toBe(true)
      expect((data as NavGroup).label).toBe('Data')
      expect((data as NavGroup).children).toHaveLength(6)
    })

    it('has Opportunities group with 2 children', () => {
      const opp = navigation[4]
      expect(isNavGroup(opp)).toBe(true)
      expect((opp as NavGroup).label).toBe('Opportunities')
      expect((opp as NavGroup).children).toHaveLength(2)
    })

    it('has Resumes group with 3 children', () => {
      const res = navigation[5]
      expect(isNavGroup(res)).toBe(true)
      expect((res as NavGroup).label).toBe('Resumes')
      expect((res as NavGroup).children).toHaveLength(3)
    })

    it('does not contain Config group', () => {
      const labels = navigation
        .filter(isNavGroup)
        .map((g: NavGroup) => g.label)
      expect(labels).not.toContain('Config')
    })

    it('all hrefs start with /', () => {
      for (const entry of navigation) {
        if (isNavGroup(entry)) {
          for (const child of entry.children) {
            expect(child.href).toMatch(/^\//)
          }
        } else {
          expect(entry.href).toMatch(/^\//)
        }
      }
    })

    it('does not contain Chain View', () => {
      const labels: string[] = []
      for (const entry of navigation) {
        if (isNavGroup(entry)) {
          for (const child of entry.children) labels.push(child.label)
        } else {
          labels.push(entry.label)
        }
      }
      expect(labels).not.toContain('Chain View')
    })
  })
})
