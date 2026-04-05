<!--
  JDOverlayHost.svelte — Singleton mount for the JD overlay modal.

  Mount this exactly once, in packages/webui/src/routes/+layout.svelte,
  outside the main .app wrapper (same position as ChainViewModal) so it
  renders above all other content and escapes stacking contexts.

  Any consumer can then open the modal via:
    import { openJDOverlay } from '$lib/components/overlays'
    openJDOverlay(jdId, optionalInitialData)
-->
<script lang="ts">
  import JDOverlayModal from './JDOverlayModal.svelte'
  import { jdOverlayState, closeJDOverlay } from './jdOverlay.svelte'
</script>

<JDOverlayModal
  open={jdOverlayState.jdId !== null}
  jdId={jdOverlayState.jdId}
  initialData={jdOverlayState.initialData}
  onClose={closeJDOverlay}
/>
