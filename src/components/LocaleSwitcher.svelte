<!-- Hallmark · P3 H3 E4 S3 R4 V4 — 로케일 세그먼티드 컨트롤. 헤더용 compact 음성.
  활성 로케일 = 스포트라이트. 전역 button.primary 스타일과 독립된 pill 그룹. -->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { activeLocale, availableLocales, type Locale } from '../lib/i18n/locale.svelte.js';

  interface Props {
    /** 선택된 로케일을 프로필 설정에 저장하는 콜백. */
    onchange: (locale: Locale) => void | Promise<void>;
  }
  const { onchange }: Props = $props();

  const LABELS: Record<Locale, () => string> = {
    ko: m.locale_name_ko,
    en: m.locale_name_en
  };
</script>

<div class="segmented" role="group" aria-label={m.settings_language()}>
  {#each availableLocales as locale (locale)}
    <button
      type="button"
      class="seg"
      class:active={activeLocale() === locale}
      aria-pressed={activeLocale() === locale}
      onclick={() => onchange(locale)}>{LABELS[locale]()}</button
    >
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    gap: 0;
    padding: var(--space-3xs);
    background: var(--stage-floor);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-pill);
  }
  .seg {
    min-height: var(--tap);
    min-width: var(--tap);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--house-bright);
    font-size: var(--text-small);
    font-weight: 700;
    cursor: pointer;
    transition:
      background-color var(--motion-base) ease,
      color var(--motion-base) ease;
  }
  .seg:hover {
    color: var(--house-bright);
    background: transparent;
  }
  .seg.active {
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: 800;
  }
</style>
