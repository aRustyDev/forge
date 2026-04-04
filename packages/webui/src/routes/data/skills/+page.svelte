<script lang="ts">
  import SkillsView from '../../data/sources/SkillsView.svelte'
</script>

<div class="skills-page-wrapper">
  <SkillsView />
</div>

<style>
  .skills-page-wrapper {
    height: calc(100vh - 4rem);
    margin: -2rem;
    overflow-y: auto;
  }
</style>
