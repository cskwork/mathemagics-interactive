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

<div class="row" role="group" aria-label={m.settings_language()}>
  {#each availableLocales as locale (locale)}
    <button
      class={activeLocale() === locale ? 'primary' : ''}
      aria-pressed={activeLocale() === locale}
      onclick={() => onchange(locale)}>{LABELS[locale]()}</button
    >
  {/each}
</div>
