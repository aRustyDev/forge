import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const COMPONENTS = join(import.meta.dir, '..', 'lib', 'components')
const STYLES = join(import.meta.dir, '..', 'lib', 'styles')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

function readComponent(name: string): string {
  return read(join(COMPONENTS, name))
}

function readCSS(name: string): string {
  return read(join(STYLES, name))
}

describe('Interactive Systems', () => {
  // AC #1: Modal Escape closes topmost only
  describe('Modal escape handling', () => {
    test('Modal has keydown escape handler', () => {
      const content = readComponent('Modal.svelte')
      expect(content).toContain("e.key === 'Escape'")
      expect(content).toContain('onClose')
    })

    test('BulletDetailModal checks for sub-dialogs before handling Escape', () => {
      const content = readComponent('BulletDetailModal.svelte')
      // The parent modal checks for open child dialogs
      expect(content).toContain('showDeriveDialog')
      expect(content).toContain('showDeleteConfirm')
      expect(content).toContain("e.key === 'Escape'")
    })
  })

  // AC #2: Kanban drag fires exactly one onDrop
  describe('Kanban intra-column guard', () => {
    test('GenericKanban has intra-column drop guard', () => {
      const content = readComponent('kanban/GenericKanban.svelte')
      // Checks if item is already in this column before calling onDrop
      expect(content).toContain('currentItems.some')
      expect(content).toContain('return')
    })

    test('GenericKanbanColumn detects cross-column moves only', () => {
      const content = readComponent('kanban/GenericKanbanColumn.svelte')
      // Only calls onDrop for items not originally in this column
      expect(content).toContain('originalIds')
      expect(content).toContain('newItems')
    })
  })

  // AC #3: Focus returns after modal close
  describe('Modal focus management', () => {
    test('Modal saves and restores focus', () => {
      const content = readComponent('Modal.svelte')
      expect(content).toContain('previouslyFocused')
      expect(content).toContain('document.activeElement')
      expect(content).toContain('.focus()')
    })
  })

  // AC #4: Drawer uses transform: translateX (not width)
  describe('Drawer animation', () => {
    test('Drawer uses transform translateX for animation', () => {
      const content = readComponent('Drawer.svelte')
      expect(content).toContain('translateX')
      expect(content).toContain('slide-in-right')
    })

    test('Drawer does not animate width', () => {
      const content = readComponent('Drawer.svelte')
      // Should not have transition on width property
      const styleBlock = content.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? ''
      expect(styleBlock).not.toMatch(/transition:\s*width/)
    })
  })

  // AC #5: All modals use role="dialog" and aria-modal="true"
  describe('Modal ARIA attributes', () => {
    test('Modal has role="dialog" and aria-modal="true"', () => {
      const content = readComponent('Modal.svelte')
      expect(content).toContain('role="dialog"')
      expect(content).toContain('aria-modal="true"')
    })

    test('ConfirmDialog has role="alertdialog" and aria-modal="true"', () => {
      const content = readComponent('ConfirmDialog.svelte')
      expect(content).toContain('role="alertdialog"')
      expect(content).toContain('aria-modal="true"')
    })

    test('BulletDetailModal has role="dialog" and aria-modal="true"', () => {
      const content = readComponent('BulletDetailModal.svelte')
      expect(content).toContain('role="dialog"')
      expect(content).toContain('aria-modal="true"')
    })
  })

  // AC #6: ConfirmDialog focuses cancel button
  describe('ConfirmDialog focus behavior', () => {
    test('ConfirmDialog focuses cancel button on open', () => {
      const content = readComponent('ConfirmDialog.svelte')
      expect(content).toContain('cancelBtn')
      expect(content).toContain('cancelBtn?.focus()')
    })
  })

  // AC #7: Kanban column collapse toggle on Enter/Space
  describe('Kanban column keyboard navigation', () => {
    test('Collapsed column has role="button" and tabindex="0"', () => {
      const content = readComponent('kanban/GenericKanbanColumn.svelte')
      expect(content).toContain('role="button"')
      expect(content).toContain('tabindex="0"')
    })

    test('Collapsed column responds to Enter key', () => {
      const content = readComponent('kanban/GenericKanbanColumn.svelte')
      expect(content).toContain("e.key === 'Enter'")
    })

    test('Column body has role="list"', () => {
      const content = readComponent('kanban/GenericKanbanColumn.svelte')
      expect(content).toContain('role="list"')
    })

    test('Card wrapper has role="listitem"', () => {
      const content = readComponent('kanban/GenericKanbanColumn.svelte')
      expect(content).toContain('role="listitem"')
    })
  })

  // AC #8: camelCase callback props
  describe('Callback naming conventions', () => {
    test('Modal uses camelCase onClose', () => {
      const content = readComponent('Modal.svelte')
      expect(content).toContain('onClose')
    })

    test('Drawer uses camelCase onClose', () => {
      const content = readComponent('Drawer.svelte')
      expect(content).toContain('onClose')
    })
  })

  // AC #9: BulletDetailModal z-index uses token
  describe('BulletDetailModal z-index', () => {
    test('BulletDetailModal uses var(--z-modal) not hardcoded z-index', () => {
      const content = readComponent('BulletDetailModal.svelte')
      expect(content).toContain('var(--z-modal)')
      expect(content).not.toContain('z-index: 1000')
    })
  })

  // AC #10: Reduced-motion media query
  describe('Reduced motion support', () => {
    test('base.css has prefers-reduced-motion media query', () => {
      const content = readCSS('base.css')
      expect(content).toContain('prefers-reduced-motion: reduce')
    })

    test('reduced motion disables modal animations', () => {
      const content = readCSS('base.css')
      expect(content).toContain('.modal-overlay')
      expect(content).toContain('.modal-dialog')
      expect(content).toContain('animation: none !important')
    })
  })

  // Z-index stacking order
  describe('Z-index token stacking order', () => {
    test('tokens.css defines z-index tokens in correct order', () => {
      const content = readCSS('tokens.css')
      const dropdownMatch = content.match(/--z-dropdown:\s*(\d+)/)
      const popoverMatch = content.match(/--z-popover:\s*(\d+)/)
      const sidebarMatch = content.match(/--z-sidebar:\s*(\d+)/)
      const modalMatch = content.match(/--z-modal:\s*(\d+)/)
      const toastMatch = content.match(/--z-toast:\s*(\d+)/)

      expect(dropdownMatch).toBeTruthy()
      expect(popoverMatch).toBeTruthy()
      expect(sidebarMatch).toBeTruthy()
      expect(modalMatch).toBeTruthy()
      expect(toastMatch).toBeTruthy()

      const dropdown = parseInt(dropdownMatch![1])
      const popover = parseInt(popoverMatch![1])
      const sidebar = parseInt(sidebarMatch![1])
      const modal = parseInt(modalMatch![1])
      const toast = parseInt(toastMatch![1])

      // Verify stacking order: dropdown < popover <= sidebar < modal < toast
      expect(dropdown).toBeLessThan(popover)
      expect(popover).toBeLessThanOrEqual(sidebar)
      expect(sidebar).toBeLessThan(modal)
      expect(modal).toBeLessThan(toast)
    })
  })

  // Drawer uses --z-sidebar token
  describe('Drawer z-index', () => {
    test('Drawer uses --z-sidebar token', () => {
      const content = readComponent('Drawer.svelte')
      expect(content).toContain('var(--z-sidebar)')
    })
  })

  // Modal overlay uses global classes
  describe('Modal overlay standardization', () => {
    test('base.css modal section is marked as canonical', () => {
      const content = readCSS('base.css')
      expect(content).toContain('canonical')
      expect(content).toContain('.modal-overlay')
    })

    test('base.css has modal size modifier classes', () => {
      const content = readCSS('base.css')
      expect(content).toContain('.modal-dialog--sm')
      expect(content).toContain('.modal-dialog--md')
      expect(content).toContain('.modal-dialog--lg')
      expect(content).toContain('.modal-dialog--xl')
      expect(content).toContain('.modal-dialog--full')
    })

    test('base.css has modal animation keyframes', () => {
      const content = readCSS('base.css')
      expect(content).toContain('@keyframes modal-fade-in')
      expect(content).toContain('@keyframes modal-slide-up')
    })
  })

  // Component barrel exports
  describe('Component exports', () => {
    test('index.ts exports Modal', () => {
      const content = read(join(COMPONENTS, 'index.ts'))
      expect(content).toContain("Modal")
      expect(content).toMatch(/from\s+'\.\/Modal\.svelte'/)
    })

    test('index.ts exports Drawer', () => {
      const content = read(join(COMPONENTS, 'index.ts'))
      expect(content).toContain("Drawer")
      expect(content).toMatch(/from\s+'\.\/Drawer\.svelte'/)
    })
  })
})
