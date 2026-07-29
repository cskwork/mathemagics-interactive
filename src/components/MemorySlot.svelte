<!--
  Hallmark · P3 H4 E4 S3 R4 V3 — 메모리 슬롯 (M6 산출물 2, PLAN §7.1 메모리 슬롯 치환).
  계산 중간값을 "단어 카드"(음성 코드, 7장) 또는 "손가락"(hand 변형, 4장 §4-2) 으로 저장하는 연출.
  memory 스텝(action=store) 을 받으면 카드가 등장하고, recall 이면 살짝 밝아진다.
  색/폰트는 전부 M7 토큰(var(--*)). inline 리터럴 0.
-->
<script lang="ts">
  import Icon from './Icon.svelte';
  interface SlotEntry {
    slot: string;
    value: number;
    digits?: string;
    word?: string;
    /** 손가락 저장 변형(4장 엄지 법칙). true 면 손 아이콘. */
    hand?: boolean;
  }

  interface Props {
    /** 현재 저장된 슬롯 목록(slot 식별자 기준 최신값). */
    entries?: SlotEntry[];
    /** recall 이 발생한 슬롯(하이라이트). */
    activeSlot?: string;
    /** 전체 표시 라벨(위 문구). */
    label?: string;
  }
  let { entries = [], activeSlot, label }: Props = $props();
</script>

{#if entries.length > 0}
  <div class="memory-rack" role="group" aria-label={label ?? 'memory slots'}>
    {#if label}<span class="rack-label">{label}</span>{/if}
    <div class="cards">
      {#each entries as e (e.slot)}
        <div
          class="card-slot"
          class:hand={e.hand}
          class:active={e.slot === activeSlot}
          role="img"
          aria-label={`${e.slot}: ${e.value}${e.word ? ' (' + e.word + ')' : ''}`}
        >
          {#if e.hand}
            <span class="hand-icon" aria-hidden="true"><Icon name="hand" /></span>
          {/if}
          <span class="value">{e.value.toLocaleString()}</span>
          {#if e.digits}
            <span class="digits" aria-hidden="true">{e.digits}</span>
          {/if}
          {#if e.word}
            <span class="word">“{e.word}”</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .memory-rack {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    background: var(--stage-floor);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
  }
  .rack-label {
    font-size: var(--text-small);
    color: var(--house-light);
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .card-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    min-width: var(--tap);
    padding: var(--space-2) var(--space-3);
    background: var(--stage-mid);
    border: 1px solid var(--stage-edge);
    border-radius: var(--radius);
    box-shadow: var(--shadow-cell);
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    transition:
      transform var(--motion-base) var(--ease-stage),
      border-color var(--motion-base) var(--ease-stage);
  }
  .card-slot.active {
    border-color: var(--spotlight);
    box-shadow: var(--shadow-cell), 0 0 0 3px var(--spotlight-glow);
    transform: translateY(-2px);
  }
  .card-slot.hand {
    background: color-mix(in srgb, var(--spotlight-wash) 30%, var(--stage-mid));
  }
  .hand-icon {
    font-size: 1.4rem;
    line-height: 1;
  }
  .value {
    font-weight: 800;
    color: var(--spotlight);
    font-size: var(--text-body);
  }
  .digits {
    font-size: var(--text-caption);
    color: var(--house-light);
    letter-spacing: 0.05em;
  }
  .word {
    font-family: var(--font-display);
    font-size: var(--text-small);
    color: var(--house-bright);
  }
</style>
