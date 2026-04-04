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
    it('has 5 top-level entries', () => {
      expect(navigation).toHaveLength(5)
    })

    it('starts with Dashboard as a plain link', () => {
      expect(isNavGroup(navigation[0])).toBe(false)
      expect((navigation[0] as NavItem).href).toBe('/')
      expect((navigation[0] as NavItem).label).toBe('Dashboard')
    })

    it('has Data group with 4 children', () => {
      const data = navigation[1]
      expect(isNavGroup(data)).toBe(true)
      expect((data as NavGroup).label).toBe('Data')
      expect((data as NavGroup).children).toHaveLength(4)
    })

    it('has Opportunities group with 2 children', () => {
      const opp = navigation[2]
      expect(isNavGroup(opp)).toBe(true)
      expect((opp as NavGroup).label).toBe('Opportunities')
      expect((opp as NavGroup).children).toHaveLength(2)
    })

    it('has Resumes as a plain link', () => {
      expect(isNavGroup(navigation[3])).toBe(false)
      expect((navigation[3] as NavItem).href).toBe('/resumes')
    })

    it('has Config group with 4 children', () => {
      const config = navigation[4]
      expect(isNavGroup(config)).toBe(true)
      expect((config as NavGroup).label).toBe('Config')
      expect((config as NavGroup).children).toHaveLength(4)
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
