<!-- Hallmark · P4 H4 E4 S4 R4 V4 — "오늘의 공연자" 출연진 명단 (M7 산출물 3·4).
  - 프로필 = 무대 프로그램 팜플렛의 출연진. 빈 상태는 "첫 공연자를 등록하세요".
  - 네이티브 prompt/confirm 제거 → 인앱 Dialog(M0 인계 #3 폐쇄). 이름변경=prompt 변형,
    삭제=parent-gate 산술 과제(COPPA). 네이티브 대화상자 호출 0건. -->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import Dialog from '../lib/components/Dialog.svelte';

  const AVATARS = ['🐧', '🦊', '🐢', '🦉', '🐙', '🦄', '🐝', '🐳'] as const;

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  let creating = $state(false);
  let draftName = $state('');
  let draftAvatar = $state<string>(AVATARS[0]);
  let busy = $state(false);

  // 인앱 다이얼로그 상태(이름변경/삭제). 네이티브 prompt/confirm 대체.
  let renameOpen = $state(false);
  let renameTarget = $state<{ id: string; name: string } | undefined>(undefined);
  let deleteOpen = $state(false);
  let deleteTarget = $state<{ id: string; name: string } | undefined>(undefined);

  function openForm(): void {
    draftName = '';
    draftAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)] ?? AVATARS[0];
    creating = true;
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || draftName.trim() === '') return;
    busy = true;
    try {
      const profile = await app.createProfile(draftName, draftAvatar);
      creating = false;
      await app.selectProfile(profile.id);
      router.navigate('home');
    } finally {
      busy = false;
    }
  }

  async function choose(id: string): Promise<void> {
    await app.selectProfile(id);
    router.navigate('home');
  }

  function askRename(id: string, currentName: string): void {
    renameTarget = { id, name: currentName };
    renameOpen = true;
  }
  async function doRename(value: string): Promise<void> {
    if (!renameTarget || value === '') return;
    await app.renameProfile(renameTarget.id, value);
  }

  function askDelete(id: string, name: string): void {
    deleteTarget = { id, name };
    deleteOpen = true;
  }
  async function doDelete(): Promise<void> {
    if (!deleteTarget) return;
    await app.deleteProfile(deleteTarget.id);
  }
</script>

<section class="stack cast">
  <header class="cast-head">
    <h2>{m.stage_cast_heading()}</h2>
    <p class="muted">{m.stage_cast_hint()}</p>
  </header>

  {#if app.profiles().length === 0}
    <div class="card card--empty">
      <span class="empty-mark" aria-hidden="true">◆</span>
      <p>{m.stage_cast_empty()}</p>
    </div>
  {:else}
    <ul class="roster" role="list">
      {#each app.profiles() as profile (profile.id)}
        <li class="cast-row">
          <button class="cast-pick" onclick={() => choose(profile.id)}>
            <span class="cast-avatar" aria-hidden="true">{profile.avatar}</span>
            <span class="cast-name">{profile.name}</span>
          </button>
          <span class="cast-actions">
            <button class="btn--ghost" onclick={() => askRename(profile.id, profile.name)}>
              {m.profiles_rename()}
            </button>
            <button class="btn--danger" onclick={() => askDelete(profile.id, profile.name)}>
              {m.profiles_delete()}
            </button>
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if creating}
    <form class="card stack" onsubmit={submit}>
      <label class="field">
        <span class="field-label">{m.profiles_name_label()}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={draftName} placeholder={m.profiles_name_placeholder()} autofocus maxlength="20" />
      </label>

      <fieldset class="avatars">
        <legend>{m.profiles_avatar_label()}</legend>
        <div class="row">
          {#each AVATARS as avatar (avatar)}
            <button
              type="button"
              class="avatar-btn"
              aria-pressed={draftAvatar === avatar}
              onclick={() => (draftAvatar = avatar)}>{avatar}</button
            >
          {/each}
        </div>
      </fieldset>

      <div class="row">
        <button class="btn--primary" type="submit" disabled={busy || draftName.trim() === ''} data-state={busy ? 'loading' : undefined}>
          {m.profiles_save()}
        </button>
        <button type="button" onclick={() => (creating = false)}>{m.profiles_cancel()}</button>
      </div>
    </form>
  {:else}
    <div><button class="btn--primary" onclick={openForm}>{m.profiles_add()}</button></div>
  {/if}
</section>

<Dialog
  bind:open={renameOpen}
  title={m.dialog_rename_title()}
  variant="prompt"
  promptLabel={m.profiles_name_label()}
  promptValue={renameTarget?.name ?? ''}
  confirmLabel={m.dialog_confirm()}
  cancelLabel={m.dialog_cancel()}
  onconfirm={(value) => doRename(value)}
/>

<Dialog
  bind:open={deleteOpen}
  title={m.dialog_delete_title()}
  description={m.dialog_delete_body({ name: deleteTarget?.name ?? '' })}
  variant="parent-gate"
  danger
  gatePrompt={m.dialog_parent_gate_prompt()}
  gateWrong={m.dialog_parent_gate_wrong()}
  confirmLabel={m.profiles_delete()}
  cancelLabel={m.dialog_cancel()}
  onconfirm={() => doDelete()}
/>

<style>
  .cast-head h2 {
    margin-bottom: var(--space-1);
  }
  .card--empty {
    text-align: center;
    color: var(--house-light);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .empty-mark {
    color: var(--spotlight);
  }

  .roster {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .cast-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    background: var(--stage-mid);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
    padding: var(--space-2) var(--space-3);
    box-shadow: var(--shadow-card);
  }
  .cast-pick {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1 1 auto;
    min-width: 0;
    background: none;
    border: 0;
    padding: var(--space-1) 0;
    text-align: left;
    cursor: pointer;
    color: var(--house-bright);
    font: inherit;
  }
  .cast-pick:hover {
    background: transparent;
  }
  .cast-avatar {
    font-size: 1.6rem;
    line-height: 1;
  }
  .cast-name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cast-actions {
    display: flex;
    gap: var(--space-1);
    flex: 0 0 auto;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .field-label {
    font-size: var(--text-small);
    color: var(--house-light);
  }
  .avatars {
    border: 0;
    padding: 0;
    margin: 0;
  }
  .avatars legend {
    font-size: var(--text-small);
    color: var(--house-light);
    padding: 0;
    margin-bottom: var(--space-2);
  }
  .avatar-btn {
    font-size: 1.5rem;
    width: var(--tap);
    height: var(--tap);
    padding: 0;
  }
  .avatar-btn[aria-pressed='true'] {
    box-shadow: inset 0 0 0 3px var(--spotlight);
  }

  /* 좁은 폭: 출연 행이 1열로 — 이름이 두 줄로 떨어지지 않게 축소. */
  @media (max-width: 360px) {
    .cast-row {
      flex-wrap: wrap;
    }
    .cast-pick {
      min-width: 60%;
    }
  }
</style>
