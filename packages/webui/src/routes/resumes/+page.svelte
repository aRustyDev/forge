<script lang="ts">
  import { onMount } from 'svelte'
  import { forge, friendlyError } from '$lib/sdk'
  import { StatusBadge, LoadingSpinner, EmptyState, ConfirmDialog } from '$lib/components'
  import { addToast } from '$lib/stores/toast.svelte'
  import type { Resume, ResumeWithEntries, ResumeEntry, Perspective, GapAnalysis, ResumeDocument, Archetype, ResumeTemplate } from '@forge/sdk'
  import { debugState } from '$lib/debug.svelte'
  import DragNDropView from '$lib/components/resume/DragNDropView.svelte'
  import PdfView from '$lib/components/resume/PdfView.svelte'
  import SourceView from '$lib/components/resume/SourceView.svelte'
  import SkillsPicker from '$lib/components/resume/SkillsPicker.svelte'
  import SourcePicker from '$lib/components/resume/SourcePicker.svelte'
  import ResumeLinkedJDs from '$lib/components/resume/ResumeLinkedJDs.svelte'
  import SummaryPicker from '$lib/components/SummaryPicker.svelte'
  import ViewToggle from '$lib/components/ViewToggle.svelte'
  import GenericKanban from '$lib/components/kanban/GenericKanban.svelte'
  import ResumeKanbanCard from '$lib/components/kanban/ResumeKanbanCard.svelte'
  import ResumeFilterBar from '$lib/components/filters/ResumeFilterBar.svelte'
  import { getViewMode, setViewMode } from '$lib/stores/viewMode.svelte'

  type ViewTab = 'editor' | 'preview' | 'source'

  const VIEW_TABS: { value: ViewTab; label: string }[] = [
    { value: 'editor', label: 'Editor' },
    { value: 'preview', label: 'Preview' },
    { value: 'source', label: 'Source' },
  ]

  let archetypeNames = $state<string[]>([])
  // Load archetypes from API
  async function loadArchetypes() {
    const result = await forge.archetypes.list({ limit: 200 })
    if (result.ok) {
      archetypeNames = result.data.map((a: Archetype) => a.name)
    }
  }
  loadArchetypes()
  const SECTIONS = ['summary', 'experience', 'skills', 'education', 'projects', 'certifications', 'clearance', 'presentations', 'awards', 'custom']
  const SECTION_LABELS: Record<string, string> = {
    summary: 'Summary',
    experience: 'Experience',
    skills: 'Skills',
    education: 'Education',
    projects: 'Projects',
    certifications: 'Certifications',
    clearance: 'Clearance',
    presentations: 'Presentations',
    awards: 'Awards',
    custom: 'Custom',
  }

  // ---- State ----
  let resumes = $state<Resume[]>([])
  let selectedResumeId = $state<string | null>(null)
  let resumeDetail = $state<ResumeWithEntries | null>(null)
  let gapAnalysis = $state<GapAnalysis | null>(null)
  let loading = $state(true)
  let detailLoading = $state(false)
  let gapLoading = $state(false)

  // View mode: list or board
  let viewMode = $state<'list' | 'board'>(getViewMode('resumes'))

  function handleViewChange(mode: 'list' | 'board') {
    viewMode = mode
    setViewMode('resumes', mode)
  }

  const RESUME_COLUMNS = [
    { key: 'draft', label: 'Draft', statuses: ['draft'], accent: '#a5b4fc' },
    { key: 'in_review', label: 'In Review', statuses: ['in_review'], accent: '#fbbf24' },
    { key: 'approved', label: 'Approved', statuses: ['approved'], accent: '#22c55e' },
    { key: 'rejected', label: 'Rejected', statuses: ['rejected'], accent: '#ef4444' },
    { key: 'archived', label: 'Archived', statuses: ['archived'], accent: '#d1d5db' },
  ]

  let resumeBoardFilters = $state<{ archetype?: string; target_employer?: string; search?: string }>({})

  let boardFilteredResumes = $derived.by(() => {
    let result = resumes
    if (resumeBoardFilters.archetype) result = result.filter(r => r.archetype === resumeBoardFilters.archetype)
    if (resumeBoardFilters.target_employer) result = result.filter(r => r.target_employer === resumeBoardFilters.target_employer)
    if (resumeBoardFilters.search) {
      const q = resumeBoardFilters.search.toLowerCase()
      result = result.filter(r => r.name.toLowerCase().includes(q) || r.target_role.toLowerCase().includes(q))
    }
    return result
  })

  async function handleResumeBoardDrop(itemId: string, newStatus: string) {
    const result = await forge.resumes.update(itemId, { status: newStatus as any })
    if (!result.ok) {
      addToast({ type: 'error', message: friendlyError(result.error, 'Status update failed') })
      throw new Error('Status update failed')
    }
    resumes = resumes.map(r => r.id === itemId ? { ...r, status: newStatus as any } : r)
    addToast({ type: 'success', message: `Resume moved to ${newStatus.replace('_', ' ')}` })
  }

  // Create form
  let showCreateForm = $state(false)
  let createForm = $state({ name: '', target_role: '', target_employer: '', archetype: '' })
  let creating = $state(false)
  let selectedTemplateId = $state<string | null>(null)
  let availableTemplates = $state<ResumeTemplate[]>([])
  let templatesLoaded = $state(false)

  // Summary picker (shown after create)
  let showSummaryPicker = $state(false)
  let pendingResumeId = $state<string | null>(null)

  // Save as template modal
  let showSaveAsTemplate = $state(false)
  let saveTemplateName = $state('')
  let saveTemplateDesc = $state('')
  let savingTemplate = $state(false)

  // Edit form
  let showEditForm = $state(false)
  let editForm = $state({ name: '', target_role: '', target_employer: '', archetype: '' })
  let saving = $state(false)

  // Entry editing (copy-on-write)
  let editingEntryId = $state<string | null>(null)
  let entryEditContent = $state('')
  let entryEditSaving = $state(false)

  // Picker modal
  let pickerModal = $state({ open: false, sectionId: '', entryType: '', sourceId: null as string | null, sourceLabel: null as string | null })
  let availablePerspectives = $state<Perspective[]>([])
  let pickerLoading = $state(false)
  let pickerArchetypeFilter = $state('')
  let pickerDomainFilter = $state('')
  let skillsPickerSectionId = $state<string | null>(null)
  let sourcePickerState = $state<{ sectionId: string; sourceType: string } | null>(null)
  let freeformInput = $state('')
  let freeformSaving = $state(false)

  // Delete confirmation
  let deleteConfirm = $state(false)
  let deleting = $state(false)

  // Collapsible sections
  let collapsedSections = $state<Record<string, boolean>>({})

  // View tabs / IR
  let activeViewTab = $state<ViewTab>('editor')
  let ir = $state<ResumeDocument | null>(null)
  let irLoading = $state(false)
  let irError = $state<string | null>(null)

  // Debug: trace all key state transitions to browser console
  debugState('resumes', () => ({
    loading,
    detailLoading,
    selectedResumeId,
    hasDetail: !!resumeDetail,
    resumeCount: resumes.length,
  }))

  // ---- Derived ----
  let filteredPickerPerspectives = $derived.by(() => {
    let result = availablePerspectives
    if (pickerArchetypeFilter) {
      result = result.filter(p => p.target_archetype === pickerArchetypeFilter)
    }
    if (pickerDomainFilter) {
      result = result.filter(p => p.domain?.toLowerCase().includes(pickerDomainFilter.toLowerCase()))
    }
    // Exclude perspectives already in this resume
    if (resumeDetail) {
      const existingPerspectiveIds = new Set(
        resumeDetail.sections
          .flatMap(s => s.entries)
          .filter(e => e.perspective_id)
          .map(e => e.perspective_id)
      )
      result = result.filter(p => !existingPerspectiveIds.has(p.id))
    }
    return result
  })

  let availableDomains = $derived.by(() => {
    const domains = new Set(availablePerspectives.map(p => p.domain).filter(Boolean))
    return [...domains].sort()
  })

  // ---- Load data ----
  onMount(async () => {
    // Load resume list first
    await loadResumes()

    // Restore selection from URL
    const urlId = new URLSearchParams(window.location.search).get('id')
    if (urlId) {
      selectedResumeId = urlId
      await Promise.all([
        loadResumeDetail(urlId),
        loadGapAnalysis(urlId),
        loadIR(urlId),
      ])
    }
  })

  async function loadResumes() {
    loading = true
    try {
      const result = await forge.resumes.list()
      if (result.ok) {
        resumes = result.data
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } catch (e) {
      addToast({ message: 'Failed to load resumes', type: 'error' })
    } finally {
      loading = false
    }
  }

  async function loadTemplates() {
    if (templatesLoaded) return
    const result = await forge.templates.list()
    if (result.ok) {
      availableTemplates = result.data
    }
    templatesLoaded = true
  }

  async function loadResumeDetail(id: string) {
    detailLoading = true
    try {
      const result = await forge.resumes.get(id)
      if (result.ok) {
        resumeDetail = result.data
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } catch (e) {
      addToast({ message: 'Failed to load resume details', type: 'error' })
    } finally {
      detailLoading = false
    }
  }

  async function loadGapAnalysis(id: string) {
    gapLoading = true
    gapAnalysis = null
    try {
      const result = await forge.resumes.gaps(id)
      if (result.ok) {
        gapAnalysis = result.data
      }
    } catch {
      // Gap analysis may not be available, silently skip
    } finally {
      gapLoading = false
    }
  }

  async function loadIR(id: string) {
    irLoading = true
    irError = null
    try {
      const result = await forge.resumes.ir(id)
      if (result.ok) {
        ir = result.data
      } else {
        irError = friendlyError(result.error, 'Failed to load IR')
      }
    } catch (e) {
      irError = 'Failed to load resume IR'
    } finally {
      irLoading = false
    }
  }

  async function handleIRUpdate() {
    if (selectedResumeId) {
      await Promise.all([
        loadIR(selectedResumeId),
        loadResumeDetail(selectedResumeId),
      ])
    }
  }

  // ---- Download Dropdown ----
  let openDropdown: string | null = $state(null)

  function toggleDropdown(id: string, event: MouseEvent) {
    event.stopPropagation()
    openDropdown = openDropdown === id ? null : id
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function downloadResumeAs(id: string, fmt: 'pdf' | 'markdown' | 'latex' | 'json', event: MouseEvent) {
    event.stopPropagation()
    openDropdown = null

    if (fmt === 'json') {
      const result = await forge.export.resumeAsJson(id)
      if (!result.ok) {
        addToast({ type: 'error', message: result.error.message })
        return
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
      triggerDownload(blob, `resume-${new Date().toISOString().slice(0, 10)}.json`)
    } else {
      const result = await forge.export.downloadResume(id, fmt)
      if (!result.ok) {
        addToast({ type: 'error', message: result.error.message })
        return
      }
      const ext = fmt === 'pdf' ? 'pdf' : fmt === 'markdown' ? 'md' : 'tex'
      triggerDownload(result.data, `resume-${new Date().toISOString().slice(0, 10)}.${ext}`)
    }
  }

  // ---- Actions ----
  function selectResume(id: string) {
    selectedResumeId = id
    showCreateForm = false
    showEditForm = false
    editingEntryId = null
    // Persist in URL for CMD+R
    const url = new URL(window.location.href)
    url.searchParams.set('id', id)
    history.replaceState(history.state, '', url.toString())
    // Load data directly — no $effect dependency
    loadResumeDetail(id)
    loadGapAnalysis(id)
    loadIR(id)
  }

  function deselectResume() {
    selectedResumeId = null
    resumeDetail = null
    gapAnalysis = null
    ir = null
    irError = null
    activeViewTab = 'editor'
    showEditForm = false
    editingEntryId = null
  }

  async function handleCreate() {
    if (!createForm.name || !createForm.target_role || !createForm.target_employer || !createForm.archetype) {
      addToast({ message: 'All fields are required', type: 'error' })
      return
    }
    creating = true
    try {
      const body: Record<string, string> = { ...createForm }
      if (selectedTemplateId) {
        body.template_id = selectedTemplateId
      }
      const result = await forge.resumes.create(body as any)
      if (result.ok) {
        pendingResumeId = result.data.id
        showSummaryPicker = true
        showCreateForm = false
        createForm = { name: '', target_role: '', target_employer: '', archetype: '' }
        selectedTemplateId = null
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } catch (e) {
      addToast({ message: 'Failed to create resume', type: 'error' })
    } finally {
      creating = false
    }
  }

  async function handleSummaryPick(summaryId: string | null) {
    showSummaryPicker = false
    if (pendingResumeId && summaryId) {
      // Link the picked/cloned summary to the new resume
      const result = await forge.resumes.update(pendingResumeId, { summary_id: summaryId })
      if (!result.ok) {
        addToast({ message: friendlyError(result.error, 'Failed to link summary'), type: 'error' })
      }
    }
    // Refresh the resume list and navigate to the new resume
    await loadResumes()
    if (pendingResumeId) {
      selectResume(pendingResumeId)
    }
    pendingResumeId = null
    addToast({ message: 'Resume created', type: 'success' })
  }

  function handleSummaryCancel() {
    // User cancelled the picker — resume was already created, just close
    showSummaryPicker = false
    loadResumes()
    if (pendingResumeId) {
      selectResume(pendingResumeId)
    }
    pendingResumeId = null
    addToast({ message: 'Resume created (no summary linked)', type: 'success' })
  }

  async function handleSaveAsTemplate() {
    if (!selectedResumeId || !saveTemplateName.trim()) {
      addToast({ message: 'Template name is required', type: 'error' })
      return
    }
    savingTemplate = true
    try {
      const result = await forge.resumes.saveAsTemplate(selectedResumeId, {
        name: saveTemplateName.trim(),
        description: saveTemplateDesc.trim() || undefined,
      })
      if (result.ok) {
        addToast({ message: `Template "${result.data.name}" saved`, type: 'success' })
        showSaveAsTemplate = false
        saveTemplateName = ''
        saveTemplateDesc = ''
        templatesLoaded = false // Force reload next time
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } catch {
      addToast({ message: 'Failed to save template', type: 'error' })
    } finally {
      savingTemplate = false
    }
  }

  function startEdit() {
    if (!resumeDetail) return
    editForm = {
      name: resumeDetail.name,
      target_role: resumeDetail.target_role,
      target_employer: resumeDetail.target_employer,
      archetype: resumeDetail.archetype,
    }
    showEditForm = true
  }

  async function handleSaveEdit() {
    if (!selectedResumeId) return
    saving = true
    try {
      const result = await forge.resumes.update(selectedResumeId, editForm)
      if (result.ok) {
        addToast({ message: 'Resume updated', type: 'success' })
        showEditForm = false
        await loadResumes()
        await loadResumeDetail(selectedResumeId)
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } catch (e) {
      addToast({ message: 'Failed to update resume', type: 'error' })
    } finally {
      saving = false
    }
  }

  async function handleDelete() {
    if (!selectedResumeId) return
    deleting = true
    try {
      const result = await forge.resumes.delete(selectedResumeId)
      if (result.ok) {
        addToast({ message: 'Resume deleted', type: 'success' })
        deselectResume()
        await loadResumes()
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } catch (e) {
      addToast({ message: 'Failed to delete resume', type: 'error' })
    } finally {
      deleting = false
      deleteConfirm = false
    }
  }

  // ---- Entry management (copy-on-write) ----

  function startEntryEdit(entry: ResumeEntry) {
    editingEntryId = entry.id
    entryEditContent = entry.content ?? entry.perspective_content_snapshot ?? ''
  }

  async function saveEntryEdit(entryId: string) {
    if (!selectedResumeId) return
    entryEditSaving = true

    const result = await forge.resumes.updateEntry(selectedResumeId, entryId, {
      content: entryEditContent,
    })
    if (result.ok) {
      addToast({ message: 'Entry updated (cloned)', type: 'success' })
      editingEntryId = null
      await loadResumeDetail(selectedResumeId)
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to update entry'), type: 'error' })
    }

    entryEditSaving = false
  }

  async function resetEntry(entryId: string) {
    if (!selectedResumeId) return

    const result = await forge.resumes.updateEntry(selectedResumeId, entryId, {
      content: null,
    })
    if (result.ok) {
      addToast({ message: 'Entry reset to reference mode', type: 'success' })
      await loadResumeDetail(selectedResumeId)
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to reset entry'), type: 'error' })
    }
  }

  async function addEntry(perspectiveId: string) {
    if (!selectedResumeId || !pickerModal.sectionId) return
    const sectionId = pickerModal.sectionId
    const currentSection = resumeDetail?.sections.find(s => s.id === sectionId)
    const position = currentSection?.entries.length ?? 0

    try {
      const result = await forge.resumes.addEntry(selectedResumeId, {
        perspective_id: perspectiveId,
        section_id: sectionId,
        position,
      })
      if (result.ok) {
        addToast({ message: 'Entry added', type: 'success' })
        // Refresh with the same source filter
        const refreshFilter: Record<string, unknown> = { status: 'approved', limit: 500 }
        if (pickerModal.sourceId) {
          refreshFilter.source_id = pickerModal.sourceId
        }
        const listResult = await forge.perspectives.list(refreshFilter)
        if (listResult.ok) {
          availablePerspectives = listResult.data
        }
        // Refresh resume detail, gap analysis, and IR so DnD view updates
        await Promise.all([
          loadResumeDetail(selectedResumeId!),
          loadGapAnalysis(selectedResumeId!),
          loadIR(selectedResumeId!),
        ])
      } else {
        addToast({ message: friendlyError(result.error, 'Failed to add entry'), type: 'error' })
      }
    } catch (e) {
      addToast({ message: 'Failed to add entry', type: 'error' })
    }
  }

  async function removeEntry(entryId: string) {
    if (!selectedResumeId) return
    try {
      const result = await forge.resumes.removeEntry(selectedResumeId, entryId)
      if (result.ok) {
        addToast({ message: 'Entry removed', type: 'success' })
        await loadResumeDetail(selectedResumeId!)
        await loadGapAnalysis(selectedResumeId!)
      } else {
        addToast({ message: friendlyError(result.error, 'Failed to remove entry'), type: 'error' })
      }
    } catch (e) {
      addToast({ message: 'Failed to remove entry', type: 'error' })
    }
  }

  // ---- Picker ----
  async function openPicker(sectionId: string, entryType: string, sourceId?: string, sourceLabel?: string) {
    // Type-specific dispatch
    switch (entryType) {
      case 'skills':
        skillsPickerSectionId = sectionId
        return

      case 'education':
        sourcePickerState = { sectionId, sourceType: 'education' }
        return

      case 'projects':
        sourcePickerState = { sectionId, sourceType: 'project' }
        return

      case 'clearance':
        sourcePickerState = { sectionId, sourceType: 'clearance' }
        return

      case 'freeform':
        pickerModal = { open: true, sectionId, entryType, sourceId: null, sourceLabel: null }
        freeformInput = ''
        return

      case 'experience':
      case 'presentations':
      default:
        // Perspective picker (existing behavior)
        pickerModal = { open: true, sectionId, entryType, sourceId: sourceId ?? null, sourceLabel: sourceLabel ?? null }
        pickerArchetypeFilter = ''
        pickerDomainFilter = ''
        pickerLoading = true
        try {
          const filter: Record<string, unknown> = { status: 'approved', limit: 500 }
          if (sourceId) {
            filter.source_id = sourceId
          }
          const result = await forge.perspectives.list(filter)
          if (result.ok) {
            availablePerspectives = result.data
          } else {
            addToast({ message: friendlyError(result.error), type: 'error' })
          }
        } catch (e) {
          addToast({ message: 'Failed to load perspectives', type: 'error' })
        } finally {
          pickerLoading = false
        }
        return
    }
  }

  function closePicker() {
    pickerModal = { open: false, sectionId: '', entryType: '', sourceId: null, sourceLabel: null }
    availablePerspectives = []
    freeformInput = ''
  }

  // ---- Freeform entry ----
  async function addFreeformEntry() {
    if (!selectedResumeId || !pickerModal.sectionId || !freeformInput.trim()) return
    freeformSaving = true
    try {
      const sectionId = pickerModal.sectionId
      const currentSection = resumeDetail?.sections.find(s => s.id === sectionId)
      const position = currentSection?.entries.length ?? 0

      const result = await forge.resumes.addEntry(selectedResumeId, {
        section_id: sectionId,
        content: freeformInput.trim(),
        position,
      })
      if (result.ok) {
        addToast({ message: 'Freeform entry added', type: 'success' })
        freeformInput = ''
        closePicker()
        await Promise.all([
          loadResumeDetail(selectedResumeId!),
          loadIR(selectedResumeId!),
        ])
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } catch (e) {
      addToast({ message: 'Failed to add entry', type: 'error' })
    } finally {
      freeformSaving = false
    }
  }

  // ---- Section management callbacks ----
  async function handleAddSection(entryType: string, title: string) {
    if (!selectedResumeId) return
    const currentSections = ir?.sections ?? []
    const position = currentSections.length

    const result = await forge.resumes.createSection(selectedResumeId, {
      title,
      entry_type: entryType,
      position,
    })
    if (result.ok) {
      addToast({ message: `Section "${title}" added`, type: 'success' })
      await handleIRUpdate()
    } else {
      addToast({ message: friendlyError(result.error), type: 'error' })
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!selectedResumeId) return
    const result = await forge.resumes.deleteSection(selectedResumeId, sectionId)
    if (result.ok) {
      addToast({ message: 'Section deleted', type: 'success' })
      await handleIRUpdate()
    } else {
      addToast({ message: friendlyError(result.error), type: 'error' })
    }
  }

  async function handleRenameSection(sectionId: string, newTitle: string) {
    if (!selectedResumeId) return
    const result = await forge.resumes.updateSection(selectedResumeId, sectionId, { title: newTitle })
    if (result.ok) {
      addToast({ message: 'Section renamed', type: 'success' })
      await handleIRUpdate()
    } else {
      addToast({ message: friendlyError(result.error), type: 'error' })
    }
  }

  async function handleMoveSection(sectionId: string, direction: 'up' | 'down') {
    if (!selectedResumeId || !ir) return
    const sections = [...ir.sections].sort((a, b) => a.display_order - b.display_order)
    const idx = sections.findIndex(s => s.id === sectionId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sections.length) return

    // Swap positions
    const currentPos = sections[idx].display_order
    const swapPos = sections[swapIdx].display_order

    await Promise.all([
      forge.resumes.updateSection(selectedResumeId, sections[idx].id, { position: swapPos }),
      forge.resumes.updateSection(selectedResumeId, sections[swapIdx].id, { position: currentPos }),
    ])

    await handleIRUpdate()
  }

  function toggleSection(section: string) {
    collapsedSections[section] = !collapsedSections[section]
  }

  function truncate(text: string, max: number = 120): string {
    if (text.length <= max) return text
    return text.slice(0, max) + '...'
  }

  function getEntryDisplayContent(entry: any): string {
    // entry.content = cloned content (non-null when edited)
    // entry.perspective_content = live perspective text (always present from API JOIN)
    // entry.perspective_content_snapshot = snapshot at clone time (only set when cloned)
    return entry.content ?? entry.perspective_content ?? entry.perspective_content_snapshot ?? '(No content)'
  }
</script>

{#if viewMode === 'board' && !selectedResumeId && !showCreateForm}
  <div class="resumes-board-header">
    <h1 class="page-title">Resumes</h1>
    <div class="board-header-actions">
      <button class="btn btn-primary" onclick={() => { showCreateForm = true; viewMode = 'list'; loadTemplates() }}>
        + New Resume
      </button>
      <ViewToggle mode={viewMode} onchange={handleViewChange} />
    </div>
  </div>
  <GenericKanban
    columns={RESUME_COLUMNS}
    items={boardFilteredResumes}
    onDrop={handleResumeBoardDrop}
    {loading}
    emptyMessage="No resumes yet. Create your first resume to get started."
    defaultCollapsed="archived"
    sortItems={(a, b) => a.name.localeCompare(b.name)}
  >
    {#snippet filterBar()}
      <ResumeFilterBar bind:filters={resumeBoardFilters} onchange={() => {}} />
    {/snippet}

    {#snippet cardContent(resume)}
      <ResumeKanbanCard {resume} onclick={() => selectResume(resume.id)} />
    {/snippet}
  </GenericKanban>
{:else}
<div class="resumes-page">
  <!-- Left Panel -->
  <div class="left-panel">
    {#if loading}
      <div class="loading-container">
        <LoadingSpinner size="lg" message="Loading resumes..." />
      </div>

    {:else if !selectedResumeId && !showCreateForm}
      <!-- Resume List View -->
      <div class="panel-header">
        <h1 class="page-title">Resumes</h1>
        <div class="board-header-actions">
          <button class="btn btn-primary" onclick={() => { showCreateForm = true; loadTemplates() }}>
            + New Resume
          </button>
          <ViewToggle mode={viewMode} onchange={handleViewChange} />
        </div>
      </div>

      {#if resumes.length === 0}
        <EmptyState
          title="No resumes yet"
          description="Create your first resume to start building tailored applications."
          action="New Resume"
          onaction={() => { showCreateForm = true; loadTemplates() }}
        />
      {:else}
        <div class="resume-list">
          {#each resumes as resume (resume.id)}
            <div class="resume-card" role="button" tabindex="0" onclick={() => selectResume(resume.id)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectResume(resume.id) }}>
              <div class="resume-card-header">
                <span class="resume-name">{resume.name}</span>
                <div class="resume-card-actions">
                  <StatusBadge status={resume.status} />
                  <div class="dropdown">
                    <button class="btn btn-sm btn-download" onclick={(e) => { e.stopPropagation(); toggleDropdown(resume.id, e) }}>
                      Download
                    </button>
                    {#if openDropdown === resume.id}
                      <div class="dropdown-menu">
                        <button onclick={(e) => downloadResumeAs(resume.id, 'pdf', e)}>PDF</button>
                        <button onclick={(e) => downloadResumeAs(resume.id, 'markdown', e)}>Markdown</button>
                        <button onclick={(e) => downloadResumeAs(resume.id, 'latex', e)}>LaTeX</button>
                        <button onclick={(e) => downloadResumeAs(resume.id, 'json', e)}>JSON (IR)</button>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
              <div class="resume-card-meta">
                <span class="meta-item">{resume.target_role}</span>
                {#if resume.target_employer}
                  <span class="meta-sep">at</span>
                  <span class="meta-item">{resume.target_employer}</span>
                {/if}
              </div>
              <div class="resume-card-archetype">
                <span class="archetype-tag">{resume.archetype}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}

    {:else if showCreateForm && !selectedResumeId}
      <!-- Create Resume Form -->
      <div class="panel-header">
        <h1 class="page-title">New Resume</h1>
        <button class="btn btn-ghost" onclick={() => { showCreateForm = false; selectedTemplateId = null }}>
          Cancel
        </button>
      </div>

      <form class="form-card" onsubmit={(e) => { e.preventDefault(); handleCreate() }}>
        <div class="form-field">
          <label for="create-name">Name</label>
          <input
            id="create-name"
            type="text"
            bind:value={createForm.name}
            placeholder="e.g. Anthropic - Security Engineer"
            required
          />
        </div>

        <div class="form-field">
          <label for="create-role">Target Role</label>
          <input
            id="create-role"
            type="text"
            bind:value={createForm.target_role}
            placeholder="e.g. Security Engineer"
            required
          />
        </div>

        <div class="form-field">
          <label for="create-employer">Target Employer</label>
          <input
            id="create-employer"
            type="text"
            bind:value={createForm.target_employer}
            placeholder="e.g. Anthropic"
            required
          />
        </div>

        <div class="form-field">
          <label for="create-archetype">Archetype</label>
          <select id="create-archetype" bind:value={createForm.archetype} required>
            <option value="" disabled>Select archetype...</option>
            {#each archetypeNames as arch}
              <option value={arch}>{arch}</option>
            {/each}
          </select>
        </div>

        <div class="form-field">
          <label>Template (optional)</label>
          <div class="template-picker">
            <button
              type="button"
              class="template-option"
              class:selected={selectedTemplateId === null}
              onclick={() => selectedTemplateId = null}
            >
              <span class="template-option-name">Blank Resume</span>
              <span class="template-option-desc">Start with no sections</span>
            </button>
            {#each availableTemplates as tmpl}
              <button
                type="button"
                class="template-option"
                class:selected={selectedTemplateId === tmpl.id}
                onclick={() => selectedTemplateId = tmpl.id}
              >
                <span class="template-option-name">
                  {tmpl.name}
                  {#if tmpl.is_builtin}<span class="badge-sm">Built-in</span>{/if}
                </span>
                <span class="template-option-desc">
                  {tmpl.sections.length} section{tmpl.sections.length === 1 ? '' : 's'}
                  {#if tmpl.description}&mdash; {tmpl.description}{/if}
                </span>
              </button>
            {/each}
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create Resume'}
          </button>
        </div>
      </form>

    {:else if selectedResumeId}
      <!-- Resume Builder View -->
      <div class="panel-header">
        <button class="btn btn-ghost btn-back" onclick={deselectResume}>
          &larr; Back
        </button>
        <div class="header-actions">
          {#if !showEditForm}
            <button class="btn btn-secondary" onclick={startEdit}>Edit</button>
            <button class="btn btn-secondary" onclick={() => { showSaveAsTemplate = true }}>
              Save as Template
            </button>
          {/if}
          <button class="btn btn-danger" onclick={() => { deleteConfirm = true }}>
            Delete
          </button>
        </div>
      </div>

      {#if detailLoading}
        <div class="loading-container">
          <LoadingSpinner message="Loading resume..." />
        </div>
      {:else if resumeDetail}
        <!-- Resume Header -->
        {#if showEditForm}
          <form class="form-card" onsubmit={(e) => { e.preventDefault(); handleSaveEdit() }}>
            <div class="form-field">
              <label for="edit-name">Name</label>
              <input id="edit-name" type="text" bind:value={editForm.name} required />
            </div>
            <div class="form-field">
              <label for="edit-role">Target Role</label>
              <input id="edit-role" type="text" bind:value={editForm.target_role} required />
            </div>
            <div class="form-field">
              <label for="edit-employer">Target Employer</label>
              <input id="edit-employer" type="text" bind:value={editForm.target_employer} required />
            </div>
            <div class="form-field">
              <label for="edit-archetype">Archetype</label>
              <select id="edit-archetype" bind:value={editForm.archetype} required>
                {#each archetypeNames as arch}
                  <option value={arch}>{arch}</option>
                {/each}
              </select>
            </div>
            <div class="form-actions">
              <button class="btn btn-ghost" type="button" onclick={() => { showEditForm = false }}>
                Cancel
              </button>
              <button class="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        {:else}
          <div class="resume-header-card">
            <div class="resume-header-top">
              <h2 class="resume-title">{resumeDetail.name}</h2>
              <StatusBadge status={resumeDetail.status} />
            </div>
            <div class="resume-header-details">
              <span class="detail-item"><strong>Role:</strong> {resumeDetail.target_role}</span>
              <span class="detail-item"><strong>Employer:</strong> {resumeDetail.target_employer}</span>
              <span class="detail-item"><strong>Archetype:</strong> <span class="archetype-tag">{resumeDetail.archetype}</span></span>
            </div>
          </div>
        {/if}

        <!-- Linked JDs -->
        {#if selectedResumeId}
          <ResumeLinkedJDs resumeId={selectedResumeId} />
        {/if}

        <!-- View Mode Tabs -->
        <div class="view-tabs-container">
          <div class="view-tabs">
            {#each VIEW_TABS as tab}
              <button
                class="view-tab"
                class:active={activeViewTab === tab.value}
                onclick={() => activeViewTab = tab.value}
              >
                {tab.label}
              </button>
            {/each}
          </div>

          <div class="view-content">
            {#if irLoading}
              <div class="loading-container">
                <LoadingSpinner message="Compiling resume..." />
              </div>
            {:else if irError}
              <div class="view-error">
                <p>{irError}</p>
                <button class="btn btn-secondary" onclick={() => selectedResumeId && loadIR(selectedResumeId)}>
                  Retry
                </button>
              </div>
            {:else if ir}
              {#if activeViewTab === 'editor'}
                <DragNDropView
                  ir={ir}
                  resumeId={selectedResumeId}
                  onUpdate={handleIRUpdate}
                  onAddEntry={(sectionId, entryType, sourceId, sourceLabel) => openPicker(sectionId, entryType, sourceId, sourceLabel)}
                  onAddSection={handleAddSection}
                  onDeleteSection={handleDeleteSection}
                  onRenameSection={handleRenameSection}
                  onMoveSection={handleMoveSection}
                />
              {:else if activeViewTab === 'preview'}
                <PdfView resumeId={selectedResumeId} {ir} />
              {:else if activeViewTab === 'source'}
                <SourceView
                  {ir}
                  resumeId={selectedResumeId}
                  latexOverride={resumeDetail.latex_override ?? null}
                  latexOverrideUpdatedAt={resumeDetail.latex_override_updated_at ?? null}
                  markdownOverride={resumeDetail.markdown_override ?? null}
                  markdownOverrideUpdatedAt={resumeDetail.markdown_override_updated_at ?? null}
                  resumeUpdatedAt={resumeDetail.updated_at}
                  onOverrideChange={async () => { await loadResumeDetail(selectedResumeId!) }}
                />
              {/if}
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Right Panel (Gap Analysis) -->
  <div class="right-panel">
    {#if !selectedResumeId}
      <div class="gap-placeholder">
        <p class="gap-placeholder-text">Select a resume to view gap analysis</p>
      </div>
    {:else if gapLoading}
      <div class="loading-container">
        <LoadingSpinner message="Analyzing gaps..." />
      </div>
    {:else if gapAnalysis}
      <div class="gap-panel">
        <h3 class="gap-title">Gap Analysis</h3>

        {#if gapAnalysis.coverage_summary}
          <div class="coverage-summary">
            <div class="coverage-stat">
              <span class="coverage-number">{gapAnalysis.coverage_summary.perspectives_included}</span>
              <span class="coverage-label">Entries</span>
            </div>
            <div class="coverage-stat">
              <span class="coverage-number">{gapAnalysis.coverage_summary.domains_represented.length}</span>
              <span class="coverage-label">Domains</span>
            </div>
          </div>
        {/if}

        {#if gapAnalysis.gaps.length === 0}
          <div class="gap-all-good">
            <p>No gaps identified. Coverage looks good.</p>
          </div>
        {:else}
          <div class="gap-list">
            {#each gapAnalysis.gaps as gap}
              <div class="gap-item">
                <div class="gap-item-header">
                  <span class="gap-type-badge">{gap.type.replace(/_/g, ' ')}</span>
                </div>
                <p class="gap-description">{gap.description}</p>
                {#if gap.recommendation}
                  <p class="gap-recommendation">{gap.recommendation}</p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="gap-placeholder">
        <p class="gap-placeholder-text">Gap analysis unavailable</p>
      </div>
    {/if}
  </div>
</div>
{/if}

<!-- Skills picker modal -->
{#if skillsPickerSectionId && selectedResumeId}
  <SkillsPicker
    resumeId={selectedResumeId}
    sectionId={skillsPickerSectionId}
    onClose={() => skillsPickerSectionId = null}
    onUpdate={handleIRUpdate}
  />
{/if}

<!-- Source picker modal -->
{#if sourcePickerState && selectedResumeId}
  <SourcePicker
    resumeId={selectedResumeId}
    sectionId={sourcePickerState.sectionId}
    sourceType={sourcePickerState.sourceType}
    onClose={() => sourcePickerState = null}
    onUpdate={handleIRUpdate}
  />
{/if}

<!-- Freeform entry modal -->
{#if pickerModal.open && pickerModal.entryType === 'freeform'}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={closePicker} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add Freeform Entry">
      <div class="modal-header">
        <h3>Add Freeform Content</h3>
        <button class="btn btn-ghost" onclick={closePicker}>Close</button>
      </div>
      <div class="freeform-body">
        <textarea
          class="freeform-textarea"
          bind:value={freeformInput}
          placeholder="Enter text content..."
          rows={5}
        ></textarea>
        <div class="freeform-actions">
          <button class="btn btn-ghost" onclick={closePicker}>Cancel</button>
          <button
            class="btn btn-primary"
            onclick={addFreeformEntry}
            disabled={!freeformInput.trim() || freeformSaving}
          >
            {freeformSaving ? 'Adding...' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Perspective Picker Modal -->
{#if pickerModal.open && pickerModal.entryType !== 'freeform'}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={closePicker} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add Entry">
      <div class="modal-header">
        <h3>
          {#if pickerModal.sourceLabel}
            Add bullet &mdash; {pickerModal.sourceLabel}
          {:else}
            Add Entry to {SECTION_LABELS[pickerModal.entryType] ?? pickerModal.entryType}
          {/if}
        </h3>
        <button class="btn btn-ghost" onclick={closePicker}>Close</button>
      </div>

      <div class="picker-filters">
        <select bind:value={pickerArchetypeFilter} aria-label="Filter by archetype">
          <option value="">All archetypes</option>
          {#each archetypeNames as arch}
            <option value={arch}>{arch}</option>
          {/each}
        </select>

        <input
          type="text"
          placeholder="Filter by domain..."
          bind:value={pickerDomainFilter}
          aria-label="Filter by domain"
        />
      </div>

      <div class="picker-list">
        {#if pickerLoading}
          <div class="loading-container">
            <LoadingSpinner message="Loading perspectives..." />
          </div>
        {:else if filteredPickerPerspectives.length === 0}
          <p class="picker-empty">No matching perspectives available.</p>
        {:else}
          {#each filteredPickerPerspectives as perspective (perspective.id)}
            <button class="picker-item" onclick={() => addEntry(perspective.id)}>
              <div class="picker-item-content">{truncate(perspective.content, 200)}</div>
              <div class="picker-item-meta">
                {#if perspective.target_archetype}
                  <span class="archetype-tag">{perspective.target_archetype}</span>
                {/if}
                {#if perspective.domain}
                  <span class="domain-tag">{perspective.domain}</span>
                {/if}
                <span class="framing-tag">{perspective.framing}</span>
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation -->
<ConfirmDialog
  open={deleteConfirm}
  title="Delete Resume"
  message="Are you sure you want to delete this resume? This cannot be undone."
  confirmLabel={deleting ? 'Deleting...' : 'Delete'}
  onconfirm={handleDelete}
  oncancel={() => { deleteConfirm = false }}
/>

<!-- Save as Template Modal -->
{#if showSaveAsTemplate}
  <div class="modal-overlay" onclick={() => { showSaveAsTemplate = false }}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <h3>Save as Template</h3>
      <p class="modal-desc">Save this resume's section layout as a reusable template.</p>
      <div class="form-field">
        <label for="template-name">Template Name</label>
        <input
          id="template-name"
          type="text"
          bind:value={saveTemplateName}
          placeholder="e.g. My Standard Layout"
          required
        />
      </div>
      <div class="form-field">
        <label for="template-desc">Description (optional)</label>
        <textarea
          id="template-desc"
          bind:value={saveTemplateDesc}
          rows="2"
          placeholder="Brief description of this layout"
        ></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick={() => { showSaveAsTemplate = false; saveTemplateName = ''; saveTemplateDesc = '' }}>
          Cancel
        </button>
        <button
          class="btn btn-primary"
          onclick={handleSaveAsTemplate}
          disabled={savingTemplate || !saveTemplateName.trim()}
        >
          {savingTemplate ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Summary Picker (shown after resume creation) -->
<SummaryPicker
  open={showSummaryPicker}
  onpick={handleSummaryPick}
  oncancel={handleSummaryCancel}
/>

<style>
  .resumes-board-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .board-header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  /* ---- Layout ---- */
  .resumes-page {
    display: flex;
    gap: 1.5rem;
    min-height: calc(100vh - 4rem);
  }

  .left-panel {
    flex: 3;
    min-width: 0;
  }

  .right-panel {
    flex: 2;
    min-width: 0;
  }

  /* ---- Loading ---- */
  .loading-container {
    display: flex;
    justify-content: center;
    padding: 3rem 0;
  }

  /* ---- Panel Header ---- */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  .page-title {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* ---- Buttons ---- */
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-primary { background: var(--color-primary); color: var(--text-inverse); }
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-secondary { background: var(--color-border); color: var(--text-secondary); }
  .btn-secondary:hover:not(:disabled) { background: var(--color-border-strong); }
  .btn-ghost { background: transparent; color: var(--text-muted); }
  .btn-ghost:hover { color: var(--text-secondary); background: var(--color-ghost); }
  .btn-danger { background: var(--color-danger-subtle); color: var(--color-danger); }
  .btn-danger:hover:not(:disabled) { background: var(--color-danger-subtle); }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: var(--text-sm); }
  .btn-xs { padding: 0.2rem 0.4rem; font-size: var(--text-xs); }
  .btn-add { background: var(--color-success-subtle); color: var(--color-success-strong); margin-top: 0.5rem; }
  .btn-add:hover { background: var(--color-success-subtle); }
  .btn-back { font-size: var(--text-base); }

  /* ---- Resume List ---- */
  .resume-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .resume-card {
    display: block;
    width: 100%;
    text-align: left;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    cursor: pointer;
    transition: box-shadow 0.15s, border-color 0.15s;
  }

  .resume-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    border-color: var(--color-primary);
  }

  .resume-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.35rem;
  }

  .resume-name { font-weight: var(--font-semibold); font-size: var(--text-base); color: var(--text-primary); }

  .resume-card-meta {
    font-size: 0.825rem;
    color: var(--text-muted);
    margin-bottom: 0.35rem;
  }

  .meta-sep { margin: 0 0.25rem; color: var(--text-faint); }

  .resume-card-archetype { margin-top: 0.25rem; }

  /* ---- Tags ---- */
  .archetype-tag {
    display: inline-block;
    padding: 0.15em 0.5em;
    background: var(--color-tag-bg);
    color: var(--color-tag-text);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .domain-tag {
    display: inline-block;
    padding: 0.15em 0.5em;
    background: var(--color-success-subtle);
    color: var(--color-success-strong);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .framing-tag {
    display: inline-block;
    padding: 0.15em 0.5em;
    background: var(--color-warning-subtle);
    color: var(--color-warning-text);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  /* ---- Forms ---- */
  .form-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .form-field { margin-bottom: 1rem; }

  .form-field label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.35rem;
  }

  .form-field input,
  .form-field select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--text-primary);
    background: var(--color-surface);
    transition: border-color 0.15s;
  }

  .form-field input:focus,
  .form-field select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  /* ---- Resume Header Card ---- */
  .resume-header-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.25rem;
  }

  .resume-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .resume-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .resume-header-details {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .detail-item strong { color: var(--text-secondary); }

  /* ---- Sections ---- */
  .sections {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-block {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--color-surface-raised);
    border: none;
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-align: left;
    transition: background 0.15s;
  }

  .section-header:hover { background: var(--color-ghost); }

  .section-chevron {
    font-size: 0.65rem;
    transition: transform 0.2s;
    color: var(--text-faint);
  }

  .section-chevron.collapsed { transform: rotate(-90deg); }
  .section-label { flex: 1; }
  .section-count { font-size: 0.75rem; color: var(--text-faint); font-weight: 400; }
  .section-content { padding: 0.75rem 1rem; }

  .section-empty {
    font-size: 0.8rem;
    color: var(--text-faint);
    font-style: italic;
    padding: 0.25rem 0;
  }

  /* ---- Entry Cards (copy-on-write) ---- */
  .entry-card {
    padding: 0.75rem;
    border: 1px solid var(--color-ghost);
    border-radius: 6px;
    margin-bottom: 0.5rem;
    transition: border-color 0.15s;
  }

  .entry-card.cloned {
    border-left: 3px solid var(--color-warning);
  }

  .entry-content {
    font-size: 0.825rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 0.35rem;
  }

  .entry-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }

  .cow-badge {
    display: inline-block;
    padding: 0.1em 0.4em;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .cow-badge.reference { background: var(--color-info-subtle); color: var(--color-info-text); }
  .cow-badge.cloned { background: var(--color-warning-bg); color: var(--color-warning-text); }

  .entry-actions {
    display: flex;
    gap: 0.35rem;
  }

  .entry-edit-textarea {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-primary);
    border-radius: 6px;
    font-size: 0.825rem;
    color: var(--text-primary);
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    min-height: 80px;
  }

  .entry-edit-textarea:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .entry-edit-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  /* ---- Gap Analysis Panel ---- */
  .gap-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
  }

  .gap-placeholder-text {
    font-size: 0.9rem;
    color: var(--text-faint);
    font-style: italic;
  }

  .gap-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1.25rem;
    position: sticky;
    top: 2rem;
  }

  .gap-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border);
  }

  .coverage-summary {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-ghost);
  }

  .coverage-stat { text-align: center; }

  .coverage-number {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary);
    line-height: 1;
  }

  .coverage-label {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .gap-all-good {
    padding: 1rem;
    background: var(--color-success-subtle);
    border: 1px solid var(--color-success);
    border-radius: 6px;
    color: var(--color-success-strong);
    font-size: 0.85rem;
    font-weight: 500;
    text-align: center;
  }

  .gap-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .gap-item {
    padding: 0.75rem;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-ghost);
    border-radius: 6px;
  }

  .gap-item-header {
    margin-bottom: 0.35rem;
  }

  .gap-type-badge {
    display: inline-block;
    padding: 0.15em 0.5em;
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .gap-description {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .gap-recommendation {
    font-size: 0.78rem;
    color: var(--text-secondary);
    line-height: 1.4;
    margin-top: 0.25rem;
    font-style: italic;
  }

  /* ---- Modal ---- */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal {
    background: var(--color-surface);
    border-radius: 8px;
    width: 90%;
    max-width: 640px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .picker-filters {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--color-ghost);
  }

  .picker-filters select,
  .picker-filters input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    font-size: 0.825rem;
    color: var(--text-primary);
  }

  .picker-filters select:focus,
  .picker-filters input:focus {
    outline: none;
    border-color: var(--color-border-focus);
  }

  .picker-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 1.25rem;
  }

  .picker-empty {
    text-align: center;
    color: var(--text-faint);
    font-size: 0.85rem;
    padding: 2rem 0;
    font-style: italic;
  }

  .picker-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.75rem;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .picker-item:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
  }

  .picker-item-content {
    font-size: 0.825rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 0.35rem;
  }

  .picker-item-meta {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  /* ---- View Tabs ---- */
  .view-tabs-container {
    margin-top: 1.5rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-surface);
  }

  .view-tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-raised);
  }

  .view-tab {
    padding: 0.75rem 1.25rem;
    border: none;
    background: transparent;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    font-family: inherit;
  }

  .view-tab:hover {
    color: var(--text-secondary);
  }

  .view-tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
    background: var(--color-surface);
  }

  .view-content {
    min-height: 400px;
  }

  .view-error {
    padding: 2rem;
    text-align: center;
    color: var(--color-danger);
  }

  /* ---- Freeform modal ---- */
  .freeform-body {
    padding: 1.25rem;
  }

  .freeform-textarea {
    width: 100%;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    font-size: 0.85rem;
    color: var(--text-primary);
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    min-height: 100px;
  }

  .freeform-textarea:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .freeform-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  /* ---- Template Picker ---- */
  .template-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
  .template-option {
    text-align: left;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .template-option:hover { border-color: var(--color-info-border); }
  .template-option.selected { border-color: var(--color-info); background: var(--color-info-subtle); }
  .template-option-name {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  .template-option-desc {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.15rem;
  }
  .badge-sm {
    font-size: 0.65rem;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    background: var(--color-info-subtle);
    color: var(--color-info-text);
    font-weight: 600;
    margin-left: 0.25rem;
  }

  /* ---- Save as Template Modal ---- */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal-card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 440px;
    width: 90%;
    box-shadow: var(--shadow-lg);
  }
  .modal-card h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  .modal-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }
  .modal-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
  }

  /* ---- Download Dropdown ---- */

  .resume-card-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dropdown {
    position: relative;
  }

  .btn-download {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.25rem;
    background: var(--color-surface);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .btn-download:hover {
    background: var(--color-ghost);
  }

  .dropdown-menu {
    position: absolute;
    right: 0;
    top: 100%;
    z-index: 20;
    min-width: 8rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-radius: 0.375rem;
    box-shadow: var(--shadow-md);
    padding: 0.25rem 0;
    margin-top: 0.25rem;
  }

  .dropdown-menu button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .dropdown-menu button:hover {
    background: var(--color-ghost);
  }
</style>
