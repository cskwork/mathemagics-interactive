<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import LocaleSwitcher from '../components/LocaleSwitcher.svelte';
  import Dialog from '../lib/components/Dialog.svelte';
  import { migrate, NotAMathemagicsBundleError, SchemaTooNewError } from '../lib/storage/index.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ExportBundle, ImportMode } from '../lib/storage/types.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const settings = $derived(app.settings());

  let exportState = $state<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function doExport(): Promise<void> {
    exportState = 'loading';
    try {
      const bundle = await app.exportData();
      const json = JSON.stringify(bundle);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mathemagics-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      exportState = 'done';
    } catch {
      exportState = 'error';
    }
  }

  let importDialogOpen = $state(false);
  let preview = $state<ExportBundle | null>(null);
  let importError = $state<string | null>(null);
  let importMode = $state<ImportMode>('merge');
  let importBusy = $state(false);

  async function onFile(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    importError = null;
    try {
      const text = await file.text();
      const bundle = migrate(JSON.parse(text));
      preview = bundle;
      importMode = 'merge';
      importDialogOpen = true;
    } catch (err) {
      importError = err instanceof NotAMathemagicsBundleError || err instanceof SchemaTooNewError
        ? m.import_invalid()
        : m.import_error();
    }
  }

  async function applyImport(): Promise<void> {
    if (!preview) return;
    importBusy = true;
    try {
      await app.importData(preview, importMode);
      importDialogOpen = false;
      preview = null;
      exportState = 'done';
    } catch {
      importError = m.import_error();
      importDialogOpen = false;
    } finally {
      importBusy = false;
    }
  }
</script>

<section class="settings">
  <h2>{m.settings_heading()}</h2>

  <!-- Preferences group -->
  <div class="group">
    <h3 class="group-title">{m.settings_language()}</h3>
    <div class="group-body">
      {#if settings}
        <div class="row-item">
          <div class="row-label">
            <span>{m.settings_language()}</span>
            <span class="muted sub">{m.settings_language_hint()}</span>
          </div>
          <LocaleSwitcher onchange={(locale) => app.setLocale(locale)} />
        </div>

        <div class="row-item">
          <label for="sound-toggle">{m.settings_sound()}</label>
          <button
            class="toggle"
            id="sound-toggle"
            role="switch"
            aria-checked={settings.soundOn}
            aria-label={m.settings_sound()}
            onclick={() => app.updateSettings({ soundOn: !settings.soundOn })}
          >
            <span class="toggle-thumb"></span>
          </button>
        </div>

        <div class="row-item">
          <label for="daily-goal">{m.settings_daily_goal()}</label>
          <div class="number-input">
            <input
              id="daily-goal"
              type="number"
              min="1"
              max="60"
              value={settings.dailyGoalMinutes}
              onchange={(e) => app.updateSettings({ dailyGoalMinutes: Number(e.currentTarget.value) })}
            />
            <span class="muted">분</span>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Storage info -->
  <div class="group">
    <h3 class="group-title">{m.storage_mode_label()}</h3>
    <div class="group-body">
      <div class="info-row">
        <span>{app.storageMode() === 'server' ? m.storage_mode_server() : m.storage_mode_local()}</span>
      </div>
      {#if app.storageMode() === 'local'}
        <div class="info-row">
          <span class="muted sub">
            {app.persistence() === 'granted' ? m.storage_persist_granted() : m.storage_persist_denied()}
          </span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Data export/import -->
  <div class="group">
    <h3 class="group-title">{m.export_section()}</h3>
    <div class="group-body">
      <p class="muted sub">{m.export_hint()}</p>
      <div class="export-actions">
        <button
          class="btn--primary"
          data-state={exportState === 'loading' ? 'loading' : exportState === 'done' ? 'success' : undefined}
          onclick={doExport}
          disabled={exportState === 'loading'}
        >
          {m.export_button()}
        </button>
        <label class="btn--secondary file-label">
          {m.import_button()}
          <input type="file" accept="application/json,.json" onchange={onFile} hidden />
        </label>
      </div>
      {#if exportState === 'done'}<p class="muted success-text">{m.export_done()}</p>{/if}
      {#if importError}<p class="error-text">{importError}</p>{/if}
    </div>
  </div>

  <button class="btn--ghost back-btn" onclick={() => router.navigate('home')}>
    ← {m.settings_back()}
  </button>
</section>

<Dialog
  bind:open={importDialogOpen}
  title={m.import_preview_title()}
  description={preview
    ? `${m.import_preview_profiles({ n: preview.profiles.length })} · ${m.import_preview_progress({ n: preview.progress.length })} · ${m.import_preview_cards({ n: preview.srsCards.length })} · ${m.import_preview_settings({ n: preview.settings.length })}`
    : ''}
  confirmLabel={m.import_apply()}
  cancelLabel={m.import_cancel()}
  danger={importMode === 'replace'}
  onconfirm={applyImport}
>
</Dialog>

{#if importBusy}
<div class="overlay" role="status" aria-live="polite">{m.import_button()}…</div>
{/if}

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .settings h2 {
    font-size: var(--text-title);
  }

  /* ── Groups ── */
  .group {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .group-title {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--house-light);
    margin-bottom: var(--space-2);
    padding-left: var(--space-1);
  }
  .group-body {
    background: var(--gradient-card);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
    overflow: hidden;
  }

  /* ── Row items ── */
  .row-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--stage-line);
  }
  .row-item:last-child {
    border-bottom: none;
  }
  .row-label {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .sub {
    font-size: var(--text-caption);
  }

  /* ── Toggle switch ── */
  .toggle {
    position: relative;
    width: 3rem;
    height: 1.75rem;
    border-radius: var(--radius-pill);
    border: none;
    background: var(--stage-floor);
    box-shadow: inset 0 0 0 1px var(--stage-line);
    cursor: pointer;
    padding: 0;
    min-height: auto;
    min-width: auto;
    transition: background var(--motion-base) ease;
  }
  .toggle[aria-checked='true'] {
    background: var(--spotlight);
    box-shadow: none;
  }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: calc(1.75rem - 4px);
    height: calc(1.75rem - 4px);
    border-radius: 50%;
    background: var(--house-bright);
    transition: transform var(--motion-base) var(--ease-stage);
  }
  .toggle[aria-checked='true'] .toggle-thumb {
    transform: translateX(1.25rem);
    background: var(--spotlight-ink);
  }

  /* ── Number input ── */
  .number-input {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .number-input input {
    width: 4rem;
    text-align: center;
  }

  /* ── Info rows ── */
  .info-row {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--stage-line);
  }
  .info-row:last-child {
    border-bottom: none;
  }

  /* ── Export ── */
  .export-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    padding: var(--space-3) var(--space-4);
  }
  .file-label {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
  }
  .success-text {
    color: var(--applause);
    padding: 0 var(--space-4) var(--space-3);
    font-size: var(--text-small);
  }
  .error-text {
    color: var(--miss);
    padding: 0 var(--space-4) var(--space-3);
    font-size: var(--text-small);
  }

  /* ── Back ── */
  .back-btn {
    align-self: flex-start;
    margin-top: var(--space-2);
  }

  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--stage-floor) 70%, transparent);
    color: var(--house-bright);
  }
</style>
