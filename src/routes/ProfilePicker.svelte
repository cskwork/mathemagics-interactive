<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';

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

  async function rename(id: string, currentName: string): Promise<void> {
    const next = globalThis.prompt(m.profiles_rename(), currentName);
    if (next === null || next.trim() === '') return;
    await app.renameProfile(id, next);
  }

  async function remove(id: string, name: string): Promise<void> {
    if (!globalThis.confirm(m.profiles_delete_confirm({ name }))) return;
    await app.deleteProfile(id);
  }
</script>

<section class="stack">
  <h2>{m.profiles_heading()}</h2>

  {#if app.profiles().length === 0}
    <p class="muted">{m.profiles_empty()}</p>
  {:else}
    <ul class="stack" style="list-style: none; margin: 0; padding: 0;">
      {#each app.profiles() as profile (profile.id)}
        <li class="card row" style="justify-content: space-between;">
          <button class="row" style="background: none; flex: 1; justify-content: flex-start;" onclick={() => choose(profile.id)}>
            <span aria-hidden="true" style="font-size: 2rem;">{profile.avatar}</span>
            <span>{profile.name}</span>
          </button>
          <span class="row">
            <button onclick={() => rename(profile.id, profile.name)}>{m.profiles_rename()}</button>
            <button class="danger" onclick={() => remove(profile.id, profile.name)}>{m.profiles_delete()}</button>
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if creating}
    <form class="card stack" onsubmit={submit}>
      <label class="stack" style="gap: 0.25rem;">
        <span>{m.profiles_name_label()}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={draftName} placeholder={m.profiles_name_placeholder()} autofocus maxlength="20" />
      </label>

      <fieldset style="border: 0; padding: 0; margin: 0;">
        <legend>{m.profiles_avatar_label()}</legend>
        <div class="row">
          {#each AVATARS as avatar (avatar)}
            <button
              type="button"
              aria-pressed={draftAvatar === avatar}
              style="font-size: 1.6rem; {draftAvatar === avatar ? 'outline: 3px solid var(--accent);' : ''}"
              onclick={() => (draftAvatar = avatar)}>{avatar}</button
            >
          {/each}
        </div>
      </fieldset>

      <div class="row">
        <button class="primary" type="submit" disabled={busy || draftName.trim() === ''}>{m.profiles_save()}</button>
        <button type="button" onclick={() => (creating = false)}>{m.profiles_cancel()}</button>
      </div>
    </form>
  {:else}
    <div><button class="primary" onclick={openForm}>{m.profiles_add()}</button></div>
  {/if}
</section>
