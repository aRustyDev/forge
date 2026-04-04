<script lang="ts">
  import { onDestroy } from 'svelte'
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner } from '$lib/components'

  import type { ResumeDocument } from '@forge/sdk'

  let {
    resumeId,
    ir,
  }: {
    resumeId: string
    ir: ResumeDocument | null
  } = $props()

  let pdfDataUrl = $state<string | null>(null)
  let loading = $state(false)
  let error = $state<{ code: string; message: string; details?: string } | null>(null)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // Auto-generate PDF when IR changes (debounced 3s)
  $effect(() => {
    // Track ir to trigger on changes
    const _ir = ir
    if (!_ir) return

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      generatePdf()
    }, 3000)

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  })

  async function generatePdf() {
    loading = true
    error = null
    // Revoke previous URL if any
    if (pdfDataUrl) {
      URL.revokeObjectURL(pdfDataUrl)
      pdfDataUrl = null
    }

    try {
      const result = await forge.resumes.pdf(resumeId)
      if (result.ok) {
        const blob = result.data as Blob
        pdfDataUrl = URL.createObjectURL(blob)
        addToast({ message: 'PDF generated', type: 'success' })
      } else {
        const err = result.error
        if (err.code === 'LATEX_COMPILE_ERROR') {
          error = {
            code: err.code,
            message: 'LaTeX compilation failed',
            details: typeof err.details === 'object' && err.details !== null
              ? (err.details as Record<string, string>).tectonic_stderr ?? err.message
              : err.message,
          }
        } else if (err.code === 'TECTONIC_NOT_AVAILABLE') {
          error = {
            code: err.code,
            message: 'Tectonic is not installed',
            details: 'Install tectonic for PDF generation: cargo install tectonic',
          }
        } else if (err.code === 'TECTONIC_TIMEOUT') {
          error = {
            code: err.code,
            message: 'PDF generation timed out',
            details: 'The LaTeX compilation took too long (>60s). Simplify the document and try again.',
          }
        } else {
          error = { code: 'UNKNOWN', message: friendlyError(err) }
        }
      }
    } catch (e) {
      error = { code: 'NETWORK', message: 'Failed to generate PDF' }
    } finally {
      loading = false
    }
  }

  onDestroy(() => {
    if (pdfDataUrl) URL.revokeObjectURL(pdfDataUrl)
  })
</script>

<div class="pdf-view">
  {#if !pdfDataUrl && !loading && !error}
    <!-- Initial state -->
    <div class="pdf-empty">
      <p class="pdf-empty-text">Click "Generate PDF" to compile your resume to PDF using tectonic.</p>
      <button class="btn btn-primary" onclick={generatePdf}>
        Generate PDF
      </button>
    </div>

  {:else if loading}
    <div class="pdf-loading">
      <LoadingSpinner size="lg" message="Compiling PDF..." />
      <p class="pdf-loading-sub">This may take 10-30 seconds on first run (tectonic downloads packages).</p>
    </div>

  {:else if error}
    <div class="pdf-error">
      <div class="pdf-error-header">
        <span class="pdf-error-code">{error.code}</span>
        <span class="pdf-error-message">{error.message}</span>
      </div>
      {#if error.details}
        <pre class="pdf-error-details">{error.details}</pre>
      {/if}
      <button class="btn btn-secondary" onclick={generatePdf}>
        Retry
      </button>
    </div>

  {:else if pdfDataUrl}
    <div class="pdf-toolbar">
      <button class="btn btn-secondary btn-sm" onclick={generatePdf}>
        Regenerate
      </button>
      <a class="btn btn-primary btn-sm" href={pdfDataUrl} download="resume.pdf">
        Download PDF
      </a>
    </div>
    <iframe
      class="pdf-frame"
      src={pdfDataUrl}
      title="Resume PDF Preview"
    ></iframe>
  {/if}
</div>

<style>
  .pdf-view {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 12rem);
    min-height: 500px;
  }

  .pdf-empty, .pdf-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .pdf-empty-text {
    font-size: 0.9rem;
    max-width: 400px;
  }

  .pdf-loading-sub {
    font-size: 0.8rem;
    color: #9ca3af;
  }

  .pdf-error {
    padding: 1.5rem;
  }

  .pdf-error-header {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    margin-bottom: 0.75rem;
  }

  .pdf-error-code {
    padding: 0.2rem 0.5rem;
    background: #fef2f2;
    color: #ef4444;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: monospace;
  }

  .pdf-error-message {
    font-weight: 500;
    color: #374151;
  }

  .pdf-error-details {
    background: #1a1a2e;
    color: #e0e0e0;
    padding: 1rem;
    border-radius: 6px;
    font-size: 0.8rem;
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 1rem;
    white-space: pre-wrap;
  }

  .pdf-toolbar {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .pdf-frame {
    flex: 1;
    width: 100%;
    border: none;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
    text-decoration: none;
    font-family: inherit;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-primary { background: #6c63ff; color: #fff; }
  .btn-primary:hover:not(:disabled) { background: #5a52e0; }
  .btn-secondary { background: #e5e7eb; color: #374151; }
  .btn-secondary:hover:not(:disabled) { background: #d1d5db; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
</style>
