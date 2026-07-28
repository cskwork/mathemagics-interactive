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

  // ── 내보내기 ─────────────────────────────────────────────────────────────────
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

  // ── 가져오기 (파일 선택 → 미리보기 다이얼로그 → merge/replace 적용) ──────────
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

<section class="stack">
  <h2>{m.settings_heading()}</h2>

  {#if settings}
    <div class="card stack">
      <div class="stack" style="gap: 0.25rem;">
        <strong>{m.settings_language()}</strong>
        <span class="muted">{m.settings_language_hint()}</span>
      </div>
      <LocaleSwitcher onchange={(locale) => app.setLocale(locale)} />
    </div>

    <div class="card row" style="justify-content: space-between;">
      <label for="sound-toggle">{m.settings_sound()}</label>
      <input
        id="sound-toggle"
        type="checkbox"
        checked={settings.soundOn}
        onchange={(e) => app.updateSettings({ soundOn: e.currentTarget.checked })}
      />
    </div>

    <div class="card row" style="justify-content: space-between;">
      <label for="daily-goal">{m.settings_daily_goal()}</label>
      <input
        id="daily-goal"
        type="number"
        min="1"
        max="60"
        style="max-width: 6rem;"
        value={settings.dailyGoalMinutes}
        onchange={(e) => app.updateSettings({ dailyGoalMinutes: Number(e.currentTarget.value) })}
      />
    </div>
  {/if}

  <div class="card stack" style="gap: 0.25rem;">
    <strong>{m.storage_mode_label()}</strong>
    <span class="muted">
      {app.storageMode() === 'server' ? m.storage_mode_server() : m.storage_mode_local()}
    </span>
    {#if app.storageMode() === 'local'}
      <span class="muted">
        {app.persistence() === 'granted' ? m.storage_persist_granted() : m.storage_persist_denied()}
      </span>
    {/if}
  </div>

  <!-- M6 산출물 5: ExportBundle UI — 내보내기/가져오기(미리보기 + merge/replace). -->
  <div class="card stack">
    <strong>{m.export_section()}</strong>
    <span class="muted">{m.export_hint()}</span>
    <div class="row" style="gap: var(--space-2); flex-wrap: wrap;">
      <button
        class="btn--primary"
        data-state={exportState === 'loading' ? 'loading' : exportState === 'done' ? 'success' : undefined}
        onclick={doExport}
        disabled={exportState === 'loading'}
      >
        {m.export_button()}
      </button>
      <label class="btn--secondary" style="cursor: pointer;">
        {m.import_button()}
        <input type="file" accept="application/json,.json" onchange={onFile} hidden />
      </label>
    </div>
    {#if exportState === 'done'}<span class="muted">{m.export_done()}</span>{/if}
    {#if importError}<span class="muted" style="color: var(--miss);">{importError}</span>{/if}
  </div>

  <div><button onclick={() => router.navigate('home')}>{m.settings_back()}</button></div>
</section>

<!-- 가져오기 미리보기 다이얼로그: 적용 전 내용 확인 + merge/replace 선택. -->
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
