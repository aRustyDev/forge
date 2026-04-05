<!--
  RenderViewport — Placeholder for document preview rendering.
  Library decisions TBD:
    - Markdown: remark/marked + rehype (GFM support, sanitization via DOMPurify)
    - LaTeX: highlight.js or CodeMirror (syntax highlighting)
    - PDF: pdf.js or iframe with data URL
-->
<script lang="ts">
  interface Props {
    content: string
    format: 'markdown' | 'latex' | 'pdf'
    height?: string
  }
  let { content, format, height = '400px' }: Props = $props()
</script>

<div class="render-viewport" style="height: {height}">
  <div class="render-placeholder">
    <p class="render-format">{format.toUpperCase()} Preview</p>
    <p class="render-message">Render preview coming soon.</p>
    <p class="render-note">Content length: {content.length} characters</p>
  </div>
</div>

<style>
  .render-viewport {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .render-placeholder {
    text-align: center;
    color: var(--text-muted);
    padding: var(--space-6);
  }
  .render-format {
    font-size: var(--text-lg, 1.1rem);
    font-weight: var(--font-semibold);
    margin: 0 0 var(--space-2);
  }
  .render-message {
    font-size: var(--text-sm);
    margin: 0 0 var(--space-1);
  }
  .render-note {
    font-size: var(--text-xs);
    font-style: italic;
    margin: 0;
  }
</style>
