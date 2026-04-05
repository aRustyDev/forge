<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { EditorView } from '@codemirror/view'
  import { EditorState, Compartment } from '@codemirror/state'
  import { basicSetup } from 'codemirror'
  import { markdown } from '@codemirror/lang-markdown'
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import OverrideBanner from './OverrideBanner.svelte'
  import type {
    ResumeDocument,
    IRSection,
    ResumeHeader,
    ExperienceGroup,
    SkillGroup,
    EducationItem,
    ProjectItem,
    CertificationGroup,
    ClearanceItem,
    PresentationItem,
    SummaryItem,
  } from '@forge/sdk'

  let {
    ir,
    override,
    overrideUpdatedAt,
    resumeUpdatedAt,
    resumeId,
    onOverrideChange,
  }: {
    ir: ResumeDocument
    override: string | null
    overrideUpdatedAt: string | null
    resumeUpdatedAt: string
    resumeId: string
    onOverrideChange: () => Promise<void>
  } = $props()

  let editorContainer: HTMLDivElement | undefined = $state()
  let editorView: EditorView | undefined = $state()
  let previewHtml = $state('')
  let editable = $state(false)
  let activeTab = $state<'edit' | 'preview'>('preview')
  let saving = $state(false)

  const editableCompartment = new Compartment()
  const readOnlyCompartment = new Compartment()

  // Compute whether we're showing an override or generated content
  let isOverride = $derived(override !== null)
  let isStale = $derived(
    isOverride && overrideUpdatedAt !== null && resumeUpdatedAt > overrideUpdatedAt
  )

  // Content to display: override if exists, else compile from IR
  let displayContent = $derived(override ?? compileMarkdown(ir))

  // --- Client-side markdown compiler (mirrors @forge/core markdown-compiler) ---

  function escMd(s: string): string {
    // Minimal escape: just pass through for display; the server handles real escaping
    return s
  }

  function compileMarkdown(doc: ResumeDocument): string {
    const lines: string[] = []
    lines.push(`# ${escMd(doc.header.name)}`)
    if (doc.header.tagline) lines.push(escMd(doc.header.tagline))
    const contact: string[] = []
    if (doc.header.location) contact.push(escMd(doc.header.location))
    if (doc.header.email) contact.push(escMd(doc.header.email))
    if (doc.header.phone) contact.push(escMd(doc.header.phone))
    if (doc.header.linkedin) contact.push(`[LinkedIn](${doc.header.linkedin})`)
    if (doc.header.github) contact.push(`[GitHub](${doc.header.github})`)
    if (doc.header.website) contact.push(`[Website](${doc.header.website})`)
    if (contact.length > 0) lines.push(contact.join(' | '))
    lines.push('')

    for (const section of doc.sections) {
      lines.push(...renderSection(section))
      lines.push('')
    }
    return lines.join('\n').trimEnd() + '\n'
  }

  function renderSection(section: IRSection): string[] {
    const lines: string[] = []
    lines.push(`## ${escMd(section.title)}`)
    lines.push('')
    switch (section.type) {
      case 'summary':
        for (const item of section.items) {
          if (item.kind === 'summary') lines.push(escMd((item as SummaryItem).content))
        }
        break
      case 'experience':
        for (const item of section.items) {
          if (item.kind === 'experience_group') {
            const g = item as ExperienceGroup
            lines.push(`### ${escMd(g.organization)}`)
            for (const sub of g.subheadings) {
              lines.push(`**${escMd(sub.title)}** | ${escMd(sub.date_range)}`)
              for (const b of sub.bullets) lines.push(`- ${escMd(b.content)}`)
              lines.push('')
            }
          }
        }
        break
      case 'skills':
        for (const item of section.items) {
          if (item.kind === 'skill_group') {
            for (const cat of (item as SkillGroup).categories) {
              lines.push(`**${escMd(cat.label)}**: ${cat.skills.map(s => escMd(s)).join(', ')}`)
            }
          }
        }
        break
      case 'education':
        for (const item of section.items) {
          if (item.kind === 'education') {
            const e = item as EducationItem
            lines.push(`**${escMd(e.institution)}**`)
            lines.push(`${escMd(e.degree)} | ${escMd(e.date)}`)
            lines.push('')
          }
        }
        break
      case 'projects':
        for (const item of section.items) {
          if (item.kind === 'project') {
            const p = item as ProjectItem
            const dateSuffix = p.date ? ` | ${escMd(p.date)}` : ''
            lines.push(`### ${escMd(p.name)}${dateSuffix}`)
            for (const b of p.bullets) lines.push(`- ${escMd(b.content)}`)
            lines.push('')
          }
        }
        break
      case 'certifications':
        for (const item of section.items) {
          if (item.kind === 'certification_group') {
            for (const cat of (item as CertificationGroup).categories) {
              lines.push(`**${escMd(cat.label)}**: ${cat.certs.map(c => escMd(c.name)).join(', ')}`)
            }
          }
        }
        break
      case 'clearance':
        for (const item of section.items) {
          if (item.kind === 'clearance') lines.push(escMd((item as ClearanceItem).content))
        }
        break
      case 'presentations':
        for (const item of section.items) {
          if (item.kind === 'presentation') {
            const pr = item as PresentationItem
            const venueDate = [pr.venue, pr.date].filter(Boolean).join(', ')
            lines.push(`### ${escMd(pr.title)}${venueDate ? ` | ${escMd(venueDate)}` : ''}`)
            for (const b of pr.bullets) lines.push(`- ${escMd(b.content)}`)
            lines.push('')
          }
        }
        break
      default:
        for (const item of section.items) {
          if ('content' in item && typeof (item as any).content === 'string') {
            lines.push(`- ${escMd((item as any).content)}`)
          }
        }
        break
    }
    return lines
  }

  // --- Markdown preview renderer ---

  function renderMarkdownToHtml(md: string): string {
    return md
      .split('\n')
      .map(line => {
        if (line.startsWith('# '))       return `<h1>${esc(line.slice(2))}</h1>`
        if (line.startsWith('## '))      return `<h2>${esc(line.slice(3))}</h2>`
        if (line.startsWith('### '))     return `<h3>${esc(line.slice(4))}</h3>`
        if (line.startsWith('- '))       return `<li>${boldify(esc(line.slice(2)))}</li>`
        if (line.startsWith('**') && line.includes(':**'))
          return `<p class="skill-line">${boldify(esc(line))}</p>`
        if (line.trim() === '')          return '<br>'
        return `<p>${boldify(esc(line))}</p>`
      })
      .join('\n')
  }

  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function boldify(s: string): string {
    return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  }

  // --- Markdown linter ---

  interface LintResult {
    valid: boolean
    errors: string[]
  }

  function lintMarkdown(content: string): LintResult {
    const errors: string[] = []
    const lines = content.split('\n')

    const firstNonBlank = lines.find(l => l.trim() !== '')
    if (!firstNonBlank || !firstNonBlank.startsWith('# ')) {
      errors.push('Document must begin with a level-1 heading (# Name)')
    }

    const headings = lines.filter(l => /^#{1,6}\s/.test(l))
    const badHeadings = headings.filter(l =>
      !l.startsWith('# ') && !l.startsWith('## ') && !l.startsWith('### ')
    )
    if (badHeadings.length > 0) {
      errors.push('Only H1 (#), H2 (##), and H3 (###) headings are allowed')
    }

    const badBullets = lines.filter(l => /^\s*[*+]\s/.test(l))
    if (badBullets.length > 0) {
      errors.push('Bullet items must start with "- " (not * or +)')
    }

    let consecutiveBlanks = 0
    for (const line of lines) {
      if (line.trim() === '') {
        consecutiveBlanks++
        if (consecutiveBlanks > 2) {
          errors.push('No more than 2 consecutive blank lines allowed')
          break
        }
      } else {
        consecutiveBlanks = 0
      }
    }

    let inSkills = false
    for (const line of lines) {
      if (line.startsWith('## ')) {
        inSkills = line.toLowerCase().includes('skill')
      } else if (inSkills && line.startsWith('- ')) {
        if (!/^- \*\*.+\*\*:/.test(line)) {
          errors.push('Skills section items must match "- **Label**: content" pattern')
          break
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }

  // --- CodeMirror ---

  // Set preview HTML immediately (regardless of active tab)
  onMount(() => {
    editable = override !== null
    previewHtml = renderMarkdownToHtml(displayContent)
  })

  onDestroy(() => {
    editorView?.destroy()
  })

  // Initialize CodeMirror when the editor container appears (Edit tab selected)
  $effect(() => {
    if (!editorContainer || editorView) return

    // Always editable when the Edit tab is shown
    editable = true

    const state = EditorState.create({
      doc: displayContent,
      extensions: [
        basicSetup,
        markdown(),
        editableCompartment.of(EditorView.editable.of(true)),
        readOnlyCompartment.of(EditorState.readOnly.of(false)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            previewHtml = renderMarkdownToHtml(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
        }),
      ],
    })

    editorView = new EditorView({
      state,
      parent: editorContainer,
    })
  })

  // React to prop changes
  $effect(() => {
    if (!editorView) return
    const currentDoc = editorView.state.doc.toString()
    if (currentDoc !== displayContent) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: displayContent,
        },
      })
      previewHtml = renderMarkdownToHtml(displayContent)
    }
  })

  function toggleEditable(enable: boolean) {
    editable = enable
    editorView?.dispatch({
      effects: [
        editableCompartment.reconfigure(EditorView.editable.of(enable)),
        readOnlyCompartment.reconfigure(EditorState.readOnly.of(!enable)),
      ],
    })
  }

  // --- Actions ---

  async function handleSave() {
    if (!editorView) return
    const content = editorView.state.doc.toString()

    const lint = lintMarkdown(content)
    if (!lint.valid) {
      addToast({ message: `Lint errors: ${lint.errors.join('; ')}`, type: 'error', duration: 6000 })
      return
    }

    saving = true
    try {
      const result = await forge.resumes.updateMarkdownOverride(resumeId, content)
      if (result.ok) {
        addToast({ message: 'Markdown override saved', type: 'success' })
        await onOverrideChange()
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } finally {
      saving = false
    }
  }

  async function handleRegenerate() {
    saving = true
    try {
      const freshContent = compileMarkdown(ir)
      const result = await forge.resumes.updateMarkdownOverride(resumeId, freshContent)
      if (result.ok) {
        addToast({ message: 'Markdown regenerated from IR', type: 'success' })
        await onOverrideChange()
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } finally {
      saving = false
    }
  }

  async function handleReset() {
    saving = true
    try {
      const result = await forge.resumes.updateMarkdownOverride(resumeId, null)
      if (result.ok) {
        addToast({ message: 'Override cleared, showing generated content', type: 'success' })
        toggleEditable(false)
        await onOverrideChange()
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } finally {
      saving = false
    }
  }
</script>

<div class="markdown-view">
  <!-- Override Banner -->
  <OverrideBanner
    {isStale}
    hasOverride={isOverride}
    onRegenerate={handleRegenerate}
    onReset={handleReset}
  />

  <!-- GitHub-style tab bar -->
  <div class="tab-bar">
    <div class="tab-group">
      <button
        class="tab"
        class:active={activeTab === 'edit'}
        onclick={() => { activeTab = 'edit'; if (!editable) toggleEditable(true) }}
      >
        Edit
      </button>
      <button
        class="tab"
        class:active={activeTab === 'preview'}
        onclick={() => activeTab = 'preview'}
      >
        Preview
      </button>
    </div>
    <div class="tab-actions">
      {#if isOverride || editable}
        <button class="btn btn-sm btn-primary" onclick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      {/if}
    </div>
  </div>

  <!-- Single pane: editor or preview -->
  <div class="content-pane">
    {#if activeTab === 'edit'}
      <div class="editor-pane" bind:this={editorContainer}></div>
    {:else}
      <div class="preview-pane">
        {@html previewHtml}
      </div>
    {/if}
  </div>
</div>

<style>
  .markdown-view {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 12rem);
    min-height: 500px;
  }

  .tab-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.75rem;
    border-bottom: 1px solid var(--color-border-strong);
    background: var(--color-surface-raised);
  }

  .tab-group {
    display: flex;
    gap: 0;
  }

  .tab {
    padding: 0.5rem 1rem;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    background: transparent;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    margin-bottom: -1px;
    font-family: inherit;
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.active {
    background: var(--color-surface);
    border-color: var(--color-border-strong);
    color: var(--text-primary);
  }

  .tab-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  .content-pane {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .editor-pane {
    height: 100%;
    overflow: auto;
  }

  .preview-pane {
    height: 100%;
    overflow-y: auto;
    padding: 2rem 3rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.9rem;
    line-height: 1.6;
    background: var(--color-surface);
  }

  .preview-pane :global(h1) {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
    color: var(--text-primary);
  }

  .preview-pane :global(h2) {
    font-size: 1rem;
    font-weight: 700;
    border-bottom: 1px solid var(--text-primary);
    padding-bottom: 0.15rem;
    margin-top: 0.75rem;
    margin-bottom: 0.35rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .preview-pane :global(h3) {
    font-size: 0.9rem;
    font-weight: 700;
    margin-top: 0.5rem;
    margin-bottom: 0.15rem;
    color: var(--text-primary);
  }

  .preview-pane :global(li) {
    margin-left: 1rem;
    margin-bottom: 0.15rem;
    font-size: 0.825rem;
  }

  .preview-pane :global(p) {
    margin-bottom: 0.15rem;
    font-size: 0.825rem;
  }

  .preview-pane :global(br) {
    display: block;
    content: '';
    margin-top: 0.25rem;
  }

</style>
