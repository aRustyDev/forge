<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { EditorView } from '@codemirror/view'
  import { EditorState, Compartment } from '@codemirror/state'
  import { basicSetup } from 'codemirror'
  import { StreamLanguage } from '@codemirror/language'
  import { stex } from '@codemirror/legacy-modes/mode/stex'
  import { markdown } from '@codemirror/lang-markdown'
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import OverrideBanner from './OverrideBanner.svelte'
  import type { ResumeDocument } from '@forge/sdk'

  type SourceFormat = 'latex' | 'markdown'
  type SourceMode = 'view' | 'edit'

  let {
    ir,
    resumeId,
    latexOverride,
    latexOverrideUpdatedAt,
    markdownOverride,
    markdownOverrideUpdatedAt,
    resumeUpdatedAt,
    onOverrideChange,
  }: {
    ir: ResumeDocument
    resumeId: string
    latexOverride: string | null
    latexOverrideUpdatedAt: string | null
    markdownOverride: string | null
    markdownOverrideUpdatedAt: string | null
    resumeUpdatedAt: string
    onOverrideChange: () => Promise<void>
  } = $props()

  let sourceFormat = $state<SourceFormat>('latex')
  let sourceMode = $state<SourceMode>('view')
  let saving = $state(false)

  let editorContainer: HTMLDivElement | undefined = $state()
  let editorView: EditorView | undefined = $state()

  // Compartments for dynamic reconfiguration
  const languageCompartment = new Compartment()
  const editableCompartment = new Compartment()
  const readOnlyCompartment = new Compartment()

  // Derived: current override and timestamps based on format
  let currentOverride = $derived(
    sourceFormat === 'latex' ? latexOverride : markdownOverride
  )
  let currentOverrideUpdatedAt = $derived(
    sourceFormat === 'latex' ? latexOverrideUpdatedAt : markdownOverrideUpdatedAt
  )
  let isOverride = $derived(currentOverride !== null)
  let isStale = $derived(
    isOverride && currentOverrideUpdatedAt !== null && resumeUpdatedAt > currentOverrideUpdatedAt
  )

  // Content for display
  let displayContent = $derived(
    currentOverride ?? (sourceFormat === 'latex' ? generateLatexPlaceholder(ir) : generateMarkdown(ir))
  )

  let isEditable = $derived(sourceMode === 'edit')

  function getLanguageExtension(format: SourceFormat) {
    return format === 'latex'
      ? StreamLanguage.define(stex)
      : markdown()
  }

  function createEditor() {
    if (!editorContainer) return

    const startState = EditorState.create({
      doc: displayContent,
      extensions: [
        basicSetup,
        languageCompartment.of(getLanguageExtension(sourceFormat)),
        editableCompartment.of(EditorView.editable.of(isEditable)),
        readOnlyCompartment.of(EditorState.readOnly.of(!isEditable)),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { fontSize: '0.82rem' },
          '.cm-content': { fontFamily: 'var(--font-mono)' },
          '.cm-gutters': { background: 'var(--color-surface-raised)', borderRight: '1px solid var(--color-border)' },
        }),
      ],
    })

    editorView = new EditorView({
      state: startState,
      parent: editorContainer,
    })
  }

  function destroyEditor() {
    editorView?.destroy()
    editorView = undefined
  }

  // Swap language and content when format changes
  $effect(() => {
    if (!editorView) return
    const _format = sourceFormat  // track reactivity
    const lang = getLanguageExtension(_format)
    const content = currentOverride ?? (_format === 'latex' ? generateLatexPlaceholder(ir) : generateMarkdown(ir))
    editorView.dispatch({
      effects: languageCompartment.reconfigure(lang),
    })
    // Replace document content
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: content,
      },
    })
  })

  // Update editability when mode changes
  $effect(() => {
    if (!editorView) return
    const _editable = isEditable  // track reactivity
    editorView.dispatch({
      effects: [
        editableCompartment.reconfigure(EditorView.editable.of(_editable)),
        readOnlyCompartment.reconfigure(EditorState.readOnly.of(!_editable)),
      ],
    })
  })

  onMount(() => {
    createEditor()
  })

  onDestroy(() => {
    destroyEditor()
  })

  // ---- Actions ----

  async function handleSave() {
    if (!editorView) return
    saving = true
    try {
      const content = editorView.state.doc.toString()
      const result = sourceFormat === 'latex'
        ? await forge.resumes.updateLatexOverride(resumeId, content)
        : await forge.resumes.updateMarkdownOverride(resumeId, content)
      if (result.ok) {
        addToast({ message: 'Saved', type: 'success' })
        await onOverrideChange()
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } catch {
      addToast({ message: 'Failed to save', type: 'error' })
    } finally {
      saving = false
    }
  }

  async function handleRegenerate() {
    if (!editorView) return
    saving = true
    try {
      const generated = sourceFormat === 'latex'
        ? generateLatexPlaceholder(ir)
        : generateMarkdown(ir)
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: generated,
        },
      })
      addToast({ message: 'Regenerated from IR', type: 'success' })
    } finally {
      saving = false
    }
  }

  async function handleReset() {
    saving = true
    try {
      const result = sourceFormat === 'latex'
        ? await forge.resumes.updateLatexOverride(resumeId, null)
        : await forge.resumes.updateMarkdownOverride(resumeId, null)
      if (result.ok) {
        addToast({ message: 'Override cleared', type: 'success' })
        await onOverrideChange()
        // Update editor content to generated
        if (editorView) {
          const generated = sourceFormat === 'latex'
            ? generateLatexPlaceholder(ir)
            : generateMarkdown(ir)
          editorView.dispatch({
            changes: {
              from: 0,
              to: editorView.state.doc.length,
              insert: generated,
            },
          })
        }
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } catch {
      addToast({ message: 'Failed to reset', type: 'error' })
    } finally {
      saving = false
    }
  }

  // ---- Content generators (reused from existing LatexView/MarkdownView) ----

  function escLatex(text: string): string {
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[&%$#_{}~^]/g, (c) => `\\${c}`)
  }

  function generateLatexPlaceholder(doc: ResumeDocument): string {
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
        } else if (item.kind === 'education') {
          lines.push(`\\resumeSubheading{${escLatex(item.institution)}}{${escLatex(item.location ?? '')}}{${escLatex(item.degree)}}{${escLatex(item.date)}}`)
        } else if (item.kind === 'skill_group') {
          for (const cat of item.categories) {
            lines.push(`\\textbf{${escLatex(cat.label)}:} ${cat.skills.map(escLatex).join(', ')}`)
          }
        } else if (item.kind === 'project') {
          lines.push(`\\resumeProjectHeading{${escLatex(item.name)}}{${escLatex(item.date ?? '')}}`)
          if (item.bullets.length > 0) {
            lines.push('\\resumeItemListStart')
            for (const b of item.bullets) {
              lines.push(`\\resumeItem{${escLatex(b.content)}}`)
            }
            lines.push('\\resumeItemListEnd')
          }
        } else if (item.kind === 'clearance') {
          lines.push(escLatex(item.content))
        } else if (item.kind === 'certification_group') {
          for (const cat of item.categories) {
            lines.push(`\\textbf{${escLatex(cat.label)}:} ${cat.certs.map(c => escLatex(c.name)).join(', ')}`)
          }
        } else if (item.kind === 'presentation') {
          lines.push(`\\resumeProjectHeading{${escLatex(item.title)}}{${escLatex(item.date ?? '')}}`)
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

  function generateMarkdown(doc: ResumeDocument): string {
    const lines: string[] = []
    lines.push(`# ${doc.header.name}`)
    if (doc.header.tagline) lines.push(`*${doc.header.tagline}*`)
    const contact: string[] = []
    if (doc.header.location) contact.push(doc.header.location)
    if (doc.header.email) contact.push(doc.header.email)
    if (doc.header.phone) contact.push(doc.header.phone)
    if (doc.header.linkedin) contact.push(`[LinkedIn](${doc.header.linkedin})`)
    if (doc.header.github) contact.push(`[GitHub](${doc.header.github})`)
    if (doc.header.website) contact.push(`[Website](${doc.header.website})`)
    if (contact.length > 0) lines.push(contact.join(' | '))
    lines.push('')

    for (const section of doc.sections) {
      lines.push(`## ${section.title}`)
      lines.push('')
      for (const item of section.items) {
        if (item.kind === 'experience_group') {
          lines.push(`### ${item.organization}`)
          for (const sub of item.subheadings) {
            lines.push(`**${sub.title}** | ${sub.date_range}`)
            lines.push('')
            for (const b of sub.bullets) {
              lines.push(`- ${b.content}`)
            }
            lines.push('')
          }
        } else if (item.kind === 'summary') {
          lines.push(item.content)
          lines.push('')
        } else if (item.kind === 'education') {
          lines.push(`**${item.institution}**${item.location ? ` | ${item.location}` : ''}`)
          lines.push(`${item.degree} | ${item.date}`)
          lines.push('')
        } else if (item.kind === 'skill_group') {
          for (const cat of item.categories) {
            lines.push(`**${cat.label}:** ${cat.skills.join(', ')}`)
          }
          lines.push('')
        } else if (item.kind === 'project') {
          lines.push(`**${item.name}**${item.date ? ` | ${item.date}` : ''}`)
          for (const b of item.bullets) {
            lines.push(`- ${b.content}`)
          }
          lines.push('')
        } else if (item.kind === 'clearance') {
          lines.push(`- ${item.content}`)
        } else if (item.kind === 'certification_group') {
          for (const cat of item.categories) {
            lines.push(`**${cat.label}:** ${cat.certs.map(c => c.name).join(', ')}`)
          }
          lines.push('')
        } else if (item.kind === 'presentation') {
          lines.push(`**${item.title}**${item.date ? ` | ${item.date}` : ''}`)
          for (const b of item.bullets) {
            lines.push(`- ${b.content}`)
          }
          lines.push('')
        }
      }
    }

    return lines.join('\n')
  }
</script>

<div class="source-view">
  <!-- Override banner -->
  <OverrideBanner
    {isStale}
    hasOverride={isOverride}
    onRegenerate={handleRegenerate}
    onReset={handleReset}
  />

  <!-- Sub-bar: format toggle + mode toggle + actions -->
  <div class="source-toolbar">
    <div class="toggle-group">
      <span class="toggle-label">Format:</span>
      <button
        class="toggle-btn"
        class:active={sourceFormat === 'latex'}
        onclick={() => sourceFormat = 'latex'}
      >LaTeX</button>
      <button
        class="toggle-btn"
        class:active={sourceFormat === 'markdown'}
        onclick={() => sourceFormat = 'markdown'}
      >Markdown</button>
    </div>

    <div class="toggle-group">
      <span class="toggle-label">Mode:</span>
      <button
        class="toggle-btn"
        class:active={sourceMode === 'view'}
        onclick={() => sourceMode = 'view'}
      >View</button>
      <button
        class="toggle-btn"
        class:active={sourceMode === 'edit'}
        onclick={() => sourceMode = 'edit'}
      >Edit</button>
    </div>

    {#if sourceMode === 'edit'}
      <div class="action-group">
        <button class="action-btn save" onclick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button class="action-btn" onclick={handleRegenerate} disabled={saving}>
          Regenerate
        </button>
        {#if isOverride}
          <button class="action-btn danger" onclick={handleReset} disabled={saving}>
            Reset
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- CodeMirror editor -->
  <div class="editor-wrapper" bind:this={editorContainer}></div>
</div>

<style>
  .source-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .source-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-raised);
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
  }

  .toggle-group {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .toggle-label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-right: 0.15rem;
  }

  .toggle-btn {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all 0.12s;
    font-family: inherit;
  }

  .toggle-btn:hover {
    background: var(--color-surface-sunken);
  }

  .toggle-btn.active {
    background: var(--color-primary);
    color: var(--text-inverse);
    border-color: var(--color-primary);
  }

  .action-group {
    display: flex;
    gap: 0.35rem;
    margin-left: auto;
  }

  .action-btn {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    cursor: pointer;
    transition: all 0.12s;
    font-family: inherit;
  }

  .action-btn:hover {
    background: var(--color-surface-sunken);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.save {
    background: var(--color-primary);
    color: var(--text-inverse);
    border-color: var(--color-primary);
  }

  .action-btn.save:hover {
    background: var(--color-primary-hover);
  }

  .action-btn.danger {
    color: var(--color-danger-text);
    border-color: var(--color-danger-subtle);
  }

  .action-btn.danger:hover {
    background: var(--color-danger-subtle);
  }

  .editor-wrapper {
    flex: 1;
    overflow: auto;
  }

  .editor-wrapper :global(.cm-editor) {
    height: 100%;
  }
</style>
