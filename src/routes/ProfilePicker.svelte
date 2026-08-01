<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import Dialog from '../lib/components/Dialog.svelte';
  import Icon from '../components/Icon.svelte';
  import Avatar, { AVATAR_IDS } from '../components/Avatar.svelte';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  let creating = $state(false);
  let draftName = $state('');
  let draftAvatar = $state<string>(AVATAR_IDS[0]);
  let busy = $state(false);

  let renameOpen = $state(false);
  let renameTarget = $state<{ id: string; name: string } | undefined>(undefined);
  let deleteOpen = $state(false);
  let deleteTarget = $state<{ id: string; name: string } | undefined>(undefined);

  function openForm(): void {
    draftName = '';
    draftAvatar = AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)] ?? AVATAR_IDS[0];
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

<section class="cast">
  <header class="cast-head">
    <h2>{m.stage_cast_heading()}</h2>
    <p class="muted">{m.stage_cast_hint()}</p>
  </header>

  {#if app.profiles().length === 0 && !creating}
    <!-- Warm empty state -->
    <div class="welcome">
      <div class="welcome-icon" aria-hidden="true"><Icon name="sparkles" /></div>
      <p class="welcome-title">{m.stage_cast_empty()}</p>
      <button class="btn--primary welcome-btn" onclick={openForm}>
        <Icon name="users" />
        <span>{m.profiles_add()}</span>
      </button>
    </div>
  {:else if app.profiles().length > 0}
    <ul class="roster" role="list">
      {#each app.profiles() as profile (profile.id)}
        <li class="cast-row">
          <button class="cast-pick" onclick={() => choose(profile.id)}>
            <span class="cast-avatar" aria-hidden="true"><Avatar id={profile.avatar} /></span>
            <span class="cast-name">{profile.name}</span>
            <span class="cast-arrow" aria-hidden="true"><Icon name="chevron-right" /></span>
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
    <form class="form-card" onsubmit={submit}>
      <div class="field">
        <label for="profile-name" class="field-label">{m.profiles_name_label()}</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          id="profile-name"
          bind:value={draftName}
          placeholder={m.profiles_name_placeholder()}
          maxlength="20"
          autocomplete="off"
          autofocus
        />
      </div>

      <fieldset class="avatars">
        <legend>{m.profiles_avatar_label()}</legend>
        <div class="avatar-grid">
          {#each AVATAR_IDS as avatar (avatar)}
            <button
              type="button"
              class="avatar-btn"
              aria-pressed={draftAvatar === avatar}
              onclick={() => (draftAvatar = avatar)}><Avatar id={avatar} /></button
            >
          {/each}
        </div>
      </fieldset>

      <div class="form-actions">
        <button class="btn--primary" type="submit" disabled={busy || draftName.trim() === ''} data-state={busy ? 'loading' : undefined}>
          {m.profiles_save()}
        </button>
        <button type="button" onclick={() => (creating = false)}>{m.profiles_cancel()}</button>
      </div>
    </form>
  {:else if app.profiles().length > 0}
    <button class="btn--primary add-btn" onclick={openForm}>
      <Icon name="users" />
      <span>{m.profiles_add()}</span>
    </button>
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
  .cast {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .cast-head h2 {
    font-size: var(--text-title);
    margin-bottom: var(--space-1);
  }
  .cast-head p {
    font-size: var(--text-small);
  }

  /* ── Welcome empty state ── */
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-7) var(--space-5);
    text-align: center;
  }
  .welcome-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    background: var(--spotlight-wash);
    color: var(--spotlight);
    font-size: 2rem;
    animation: stage-pop var(--motion-slow) var(--ease-stage) both;
  }
  .welcome-title {
    font-size: var(--text-lead);
    color: var(--house-light);
    max-width: 18rem;
  }
  .welcome-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-body);
    padding: 0 var(--space-5);
  }

  /* ── Roster ── */
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
    gap: var(--space-2);
    background: var(--gradient-card);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
    padding: var(--space-2) var(--space-3);
    box-shadow: var(--shadow-card);
    transition: border-color var(--motion-base) ease;
  }
  .cast-row:hover {
    border-color: var(--stage-edge);
  }
  .cast-pick {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1 1 auto;
    min-width: 0;
    background: none;
    border: 0;
    padding: var(--space-2) 0;
    text-align: left;
    cursor: pointer;
    color: var(--house-bright);
    font: inherit;
    border-radius: var(--radius-sm);
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
    font-size: var(--text-body);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1 1 auto;
  }
  .cast-arrow {
    color: var(--house-light);
    font-size: 0.9rem;
    opacity: 0.5;
    transition: opacity var(--motion-base) ease, transform var(--motion-base) ease;
  }
  .cast-pick:hover .cast-arrow {
    opacity: 1;
    transform: translateX(2px);
  }
  .cast-actions {
    display: flex;
    gap: 0;
    flex: 0 0 auto;
  }
  .cast-actions button {
    min-height: calc(var(--tap) * 0.8);
    padding: 0 var(--space-2);
    font-size: var(--text-small);
    border-radius: var(--radius-sm);
  }

  /* ── Form ── */
  .form-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background: var(--gradient-card);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    box-shadow: var(--shadow-stage);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .field-label {
    font-size: var(--text-small);
    color: var(--house-light);
    font-weight: 600;
  }
  .avatars {
    border: 0;
    padding: 0;
    margin: 0;
  }
  .avatars legend {
    font-size: var(--text-small);
    color: var(--house-light);
    font-weight: 600;
    padding: 0;
    margin-bottom: var(--space-3);
  }
  .avatar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(var(--tap) + 0.5rem), 1fr));
    gap: var(--space-2);
  }
  .avatar-btn {
    font-size: 1.5rem;
    width: 100%;
    aspect-ratio: 1;
    min-height: var(--tap);
    padding: 0;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--motion-fast) var(--ease-spring);
  }
  .avatar-btn:active {
    transform: scale(0.92);
  }
  .avatar-btn[aria-pressed='true'] {
    box-shadow: inset 0 0 0 3px var(--spotlight);
    background: var(--spotlight-wash);
  }
  .form-actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  /* ── Add button ── */
  .add-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    align-self: flex-start;
  }

  @media (max-width: 360px) {
    .cast-row {
      flex-wrap: wrap;
    }
    .cast-pick {
      min-width: 55%;
    }
    .cast-actions button {
      font-size: var(--text-caption);
    }
  }
</style>
