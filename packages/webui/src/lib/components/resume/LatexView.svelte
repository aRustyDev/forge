<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { EditorView } from '@codemirror/view'
  import { EditorState, Compartment } from '@codemirror/state'
  import { basicSetup } from 'codemirror'
  import { StreamLanguage } from '@codemirror/language'
  import { stex } from '@codemirror/legacy-modes/mode/stex'
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import OverrideBanner from './OverrideBanner.svelte'
  import type { ResumeDocument } from '@forge/sdk'

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

  let isOverride = $derived(override !== null)
  let isStale = $derived(
    isOverride && overrideUpdatedAt !== null && resumeUpdatedAt > overrideUpdatedAt
  )

  // Content: override if it exists, else a placeholder since we don't have a
  // client-side LaTeX compiler (it requires the template from core).
  // We show a sensible message directing users to compile via the API.
  let displayContent = $derived(override ?? generateLatexPlaceholder(ir))

  function generateLatexPlaceholder(doc: ResumeDocument): string {
    // Generate a basic LaTeX skeleton from the IR so there's something to see
    const lines: string[] = []
    lines.push('% Auto-generated LaTeX preview from resume IR')
    lines.push('% Enable editing and save to create an override')
    lines.push('\\documentclass[letterpaper,11pt]{article}')
    lines.push('\\begin{document}')
    lines.push('')
    lines.push(`\\section*{${escLatex(doc.header.name)}}`)
    if (doc.header.tagline) lines.push(`\\textit{${escLatex(doc.header.tagline)}}`)
    const contact: string[] = []
    if (doc.header.location) contact.push(escLatex(doc.header.location))
    if (doc.header.email) contact.push(escLatex(doc.header.email))
    if (doc.header.phone) contact.push(escLatex(doc.header.phone))
    if (contact.length > 0) lines.push(contact.join(' $\\cdot$ '))
    lines.push('')

    for (const section of doc.sections) {
      lines.push(`\\section{${escLatex(section.title)}}`)
      for (const item of section.items) {
        if (item.kind === 'experience_group') {
          lines.push('\\resumeSubHeadingListStart')
          for (const sub of item.subheadings) {
            lines.push(`\\resumeSubheading{${escLatex(item.organization)}}{}{${escLatex(sub.title)}}{${escLatex(sub.date_range)}}`)
            lines.push('\\resumeItemListStart')
            for (const b of sub.bullets) {
              lines.push(`\\resumeItem{${escLatex(b.content)}}`)
            }
            lines.push('\\resumeItemListEnd')
          }
          lines.push('\\resumeSubHeadingListEnd')
        } else if (item.kind === 'summary') {
          lines.push(escLatex(item.content))
        } else if (item.kind === 'skill_group') {
          for (const cat of item.categories) {
            lines.push(`\\textbf{${escLatex(cat.label)}}: ${cat.skills.map(s => escLatex(s)).join(', ')}`)
          }
        } else if (item.kind === 'education') {
          lines.push(`\\resumeSubheading{${escLatex(item.institution)}}{}{${escLatex(item.degree)}}{${escLatex(item.date)}}`)
        } else if (item.kind === 'project') {
          lines.push(`\\resumeProjectHeading{${escLatex(item.name)}}{${item.date ? escLatex(item.date) : ''}}`)
          if (item.bullets.length > 0) {
            lines.push('\\resumeItemListStart')
            for (const b of item.bullets) {
              lines.push(`\\resumeItem{${escLatex(b.content)}}`)
            }
            lines.push('\\resumeItemListEnd')
          }
        } else if (item.kind === 'certification_group') {
          for (const cat of item.categories) {
            lines.push(`\\textbf{${escLatex(cat.label)}}: ${cat.certs.map(c => escLatex(c.name)).join(', ')}`)
          }
        } else if (item.kind === 'clearance') {
          lines.push(escLatex(item.content))
        } else if (item.kind === 'presentation') {
          lines.push(`\\resumeProjectHeading{${escLatex(item.title)}}{${item.date ? escLatex(item.date) : ''}}`)
          if (item.bullets.length > 0) {
            lines.push('\\resumeItemListStart')
            for (const b of item.bullets) {
              lines.push(`\\resumeItem{${escLatex(b.content)}}`)
            }
            lines.push('\\resumeItemListEnd')
          }
        }
      }
      lines.push('')
    }

    lines.push('\\end{document}')
    return lines.join('\n')
  }

  function escLatex(s: string): string {
    return s
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[&%$#_{}~^]/g, m => '\\' + m)
  }

  // --- LaTeX preview renderer ---

  function renderLatexToHtml(latex: string): string {
    const lines = latex.split('\n')
    const output: string[] = []
    let inDocument = false
    let inItemList = false

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed === '\\begin{document}') { inDocument = true; continue }
      if (trimmed === '\\end{document}') { inDocument = false; continue }
      if (!inDocument) continue

      // Section headers
      const sectionMatch = trimmed.match(/^\\section\*?\{(.+?)\}/)
      if (sectionMatch) {
        if (inItemList) { output.push('</ul>'); inItemList = false }
        output.push(`<h2 class="latex-section">${esc(sectionMatch[1])}</h2>`)
        continue
      }

      // Subheading: \resumeSubheading{org}{}{role}{dates}
      const subMatch = trimmed.match(/^\\resumeSubheading\{(.+?)\}\{(.*?)\}\{(.+?)\}\{(.+?)\}/)
      if (subMatch) {
        output.push(`<div class="latex-subheading">`)
        output.push(`  <div class="latex-sub-row"><strong>${esc(subMatch[1])}</strong><span>${esc(subMatch[4])}</span></div>`)
        output.push(`  <div class="latex-sub-row"><em>${esc(subMatch[3])}</em><span>${esc(subMatch[2])}</span></div>`)
        output.push(`</div>`)
        continue
      }

      // Sub-sub heading: \resumeSubSubheading{role}{dates}
      const subsubMatch = trimmed.match(/^\\resumeSubSubheading\{(.+?)\}\{(.+?)\}/)
      if (subsubMatch) {
        output.push(`<div class="latex-subsubheading">`)
        output.push(`  <em>${esc(subsubMatch[1])}</em><span>${esc(subsubMatch[2])}</span>`)
        output.push(`</div>`)
        continue
      }

      // Project heading
      const projMatch = trimmed.match(/^\\resumeProjectHeading\{(.+?)\}\{(.*?)\}/)
      if (projMatch) {
        output.push(`<div class="latex-project"><strong>${esc(projMatch[1])}</strong><span>${esc(projMatch[2])}</span></div>`)
        continue
      }

      // Item list markers
      if (trimmed === '\\resumeItemListStart') { output.push('<ul class="latex-items">'); inItemList = true; continue }
      if (trimmed === '\\resumeItemListEnd') { output.push('</ul>'); inItemList = false; continue }
      if (trimmed === '\\resumeSubHeadingListStart' || trimmed === '\\resumeSubHeadingListEnd') { continue }

      // Items: \resumeItem{text}
      const itemMatch = trimmed.match(/^\\resumeItem\{(.+)\}/)
      if (itemMatch) {
        output.push(`<li>${esc(itemMatch[1])}</li>`)
        continue
      }

      // \textbf{label}: content
      const boldMatch = trimmed.match(/^\\textbf\{(.+?)\}:?\s*(.*)/)
      if (boldMatch) {
        output.push(`<p><strong>${esc(boldMatch[1])}:</strong> ${esc(boldMatch[2])}</p>`)
        continue
      }

      // \textit{text}
      const italicMatch = trimmed.match(/^\\textit\{(.+?)\}/)
      if (italicMatch) {
        output.push(`<p><em>${esc(italicMatch[1])}</em></p>`)
        continue
      }

      // Skip empty, comments, and unknown commands
      if (trimmed && !trimmed.startsWith('%') && !trimmed.startsWith('\\')) {
        output.push(`<p>${esc(trimmed)}</p>`)
      }
    }

    if (inItemList) output.push('</ul>')
    return output.join('\n')
  }

  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  // --- LaTeX linter ---

  interface LintResult {
    valid: boolean
    errors: string[]
  }

  function lintLatex(content: string): LintResult {
    const errors: string[] = []

    if (!content.includes('\\begin{document}')) {
      errors.push('Missing \\begin{document}')
    }
    if (!content.includes('\\end{document}')) {
      errors.push('Missing \\end{document}')
    }

    const itemStarts = (content.match(/\\resumeItemListStart/g) || []).length
    const itemEnds = (content.match(/\\resumeItemListEnd/g) || []).length
    if (itemStarts !== itemEnds) {
      errors.push(`Unmatched \\resumeItemListStart (${itemStarts}) / \\resumeItemListEnd (${itemEnds})`)
    }

    const subStarts = (content.match(/\\resumeSubHeadingListStart/g) || []).length
    const subEnds = (content.match(/\\resumeSubHeadingListEnd/g) || []).length
    if (subStarts !== subEnds) {
      errors.push(`Unmatched \\resumeSubHeadingListStart (${subStarts}) / \\resumeSubHeadingListEnd (${subEnds})`)
    }

    if (/\\write18/.test(content)) {
      errors.push('SECURITY: \\write18 is forbidden (enables shell escape)')
    }
    if (/\\input\{/.test(content)) {
      errors.push('SECURITY: \\input is forbidden (enables file inclusion)')
    }

    return { valid: errors.length === 0, errors }
  }

  // --- CodeMirror ---

  // Set preview HTML immediately (regardless of active tab)
  onMount(() => {
    editable = override !== null
    previewHtml = renderLatexToHtml(displayContent)
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
        StreamLanguage.define(stex),
        editableCompartment.of(EditorView.editable.of(true)),
        readOnlyCompartment.of(EditorState.readOnly.of(false)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            previewHtml = renderLatexToHtml(update.state.doc.toString())
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
      previewHtml = renderLatexToHtml(displayContent)
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

    const lint = lintLatex(content)
    if (!lint.valid) {
      addToast({ message: `Lint errors: ${lint.errors.join('; ')}`, type: 'error', duration: 6000 })
      return
    }

    saving = true
    try {
      const result = await forge.resumes.updateLatexOverride(resumeId, content)
      if (result.ok) {
        addToast({ message: 'LaTeX override saved', type: 'success' })
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
      const freshContent = generateLatexPlaceholder(ir)
      const result = await forge.resumes.updateLatexOverride(resumeId, freshContent)
      if (result.ok) {
        addToast({ message: 'LaTeX regenerated from IR', type: 'success' })
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
      const result = await forge.resumes.updateLatexOverride(resumeId, null)
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

<div class="latex-view">
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
  .latex-view {
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
    border-bottom: 1px solid #d1d5db;
    background: #f6f8fa;
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
    color: #57606a;
    cursor: pointer;
    margin-bottom: -1px;
    font-family: inherit;
  }

  .tab:hover {
    color: #1a1a2e;
  }

  .tab.active {
    background: #fff;
    border-color: #d1d5db;
    color: #1a1a2e;
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
    background: #fff;
  }

  .preview-pane :global(.latex-section) {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid #1a1a2e;
    padding-bottom: 0.15rem;
    margin-top: 0.75rem;
    margin-bottom: 0.35rem;
    color: #1a1a2e;
  }

  .preview-pane :global(.latex-subheading) {
    margin-bottom: 0.25rem;
  }

  .preview-pane :global(.latex-sub-row) {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 0.85rem;
  }

  .preview-pane :global(.latex-subsubheading) {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 0.825rem;
    margin-bottom: 0.15rem;
  }

  .preview-pane :global(.latex-project) {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 0.85rem;
    margin-bottom: 0.15rem;
  }

  .preview-pane :global(.latex-items) {
    margin: 0.15rem 0 0.35rem 1rem;
    padding: 0;
    list-style: disc;
  }

  .preview-pane :global(.latex-items li) {
    font-size: 0.8rem;
    margin-bottom: 0.1rem;
  }

  .preview-pane :global(p) {
    font-size: 0.825rem;
    margin-bottom: 0.15rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-primary { background: #6c63ff; color: #fff; }
  .btn-primary:hover:not(:disabled) { background: #5a52e0; }
  .btn-secondary { background: #e5e7eb; color: #374151; }
  .btn-secondary:hover:not(:disabled) { background: #d1d5db; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
</style>
