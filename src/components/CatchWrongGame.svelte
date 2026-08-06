<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — "오답 잡아내기" 게임 (M5 산출물 3).
  완성된 계산들 중 모드섬으로 틀린 것을 찾는다. makeRound/findWrongByModSum(순수) 로 구동.
  정답 선택 시 spotlight-sweep, 오답 선택 시 가벼운 shake. 비교·순위 없음(PLAN §7.2).
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { findWrongByModSum, makeRound, type CatchRound } from '../lib/engine/catch-wrong.js';

  const INIT_SEED = 5;
  const INIT_ITEMS = 4;

  interface Props {
    /** 오답을 잡을 때마다 호출(진도 저장용). */
    oncaught?: () => void;
  }
  const { oncaught }: Props = $props();

  let round: CatchRound = $state(makeRound(INIT_SEED, INIT_ITEMS, 'mul'));
  let picked = $state<number | undefined>(undefined);
  let solved = $state(false);
  let roundSeed = $state(INIT_SEED);
  let sweepKey = $state(0);

  function opSign(op: 'add' | 'mul'): string {
    return op === 'mul' ? '×' : '+';
  }
  function pick(i: number): void {
    if (solved) return;
    picked = i;
    if (i === round.wrongIndex) {
      solved = true;
      sweepKey += 1;
      oncaught?.();
    }
  }
  function nextRound(): void {
    roundSeed += 100;
    round = makeRound(roundSeed, INIT_ITEMS, 'mul');
    picked = undefined;
    solved = false;
  }
  const detected = $derived(solved ? findWrongByModSum(round) : undefined);
</script>

<section class="stack catch">
  <header class="catch-head">
    <h2>{m.catch_heading()}</h2>
    <p class="muted">{m.catch_intro()}</p>
  </header>

  <p class="ask" aria-live="polite">{m.catch_which_wrong()}</p>

  <ul class="items" role="list">
    {#each round.items as it, i (i)}
      <li>
        <button
          class="card item"
          class:item--picked={picked === i}
          class:item--wrong-pick={picked === i && i !== round.wrongIndex}
          class:item--caught={solved && i === round.wrongIndex}
          onclick={() => pick(i)}
          disabled={solved}
          aria-label={`${it.operands[0]} ${opSign(it.op)} ${it.operands[1]} = ${it.claimed}`}
        >
          <span class="expr"
            >{it.operands[0]} {opSign(it.op)} {it.operands[1]} =</span
          >
          <strong class="claimed">{it.claimed}</strong>
        </button>
      </li>
    {/each}
  </ul>

  {#if solved}
    <div class="card verdict" class:ok={solved} aria-live="polite">
      {#key sweepKey}
        <div class="sweep" aria-hidden="true"></div>
      {/key}
      <p>{m.catch_correct()}</p>
      {#if detected !== undefined && round.items[detected]}
        <p class="muted small">
          {round.items[detected]!.operands[0]} {opSign(round.items[detected]!.op)} {round.items[detected]!.operands[1]}
          = {round.items[detected]!.truth} (틀린 답 {round.items[detected]!.claimed})
        </p>
      {/if}
      <div class="row controls">
        <button class="btn--primary" onclick={nextRound}>{m.catch_next_round()}</button>
      </div>
    </div>
  {:else if picked !== undefined}
    <p class="muted wrong-pick-msg" aria-live="polite">{m.catch_wrong_pick()}</p>
  {/if}
</section>

<style>
  .catch-head h2 {
    font-size: var(--text-title);
    margin: 0;
  }
  .ask {
    font-size: var(--text-lead);
    color: var(--spotlight);
    font-weight: 700;
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--space-3);
  }
  .item {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-4);
    cursor: pointer;
    text-align: center;
    transition: border-color var(--motion-base) ease, transform var(--motion-base) ease;
  }
  .item:hover {
    border-color: var(--spotlight);
  }
  .expr {
    font-size: var(--text-body);
    color: var(--house-light);
  }
  .claimed {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-size: 1.6rem;
    color: var(--house-bright);
  }
  .item--wrong-pick {
    border-color: var(--miss);
    animation: shake 0.32s ease;
  }
  .item--caught {
    border-color: var(--applause);
    background: var(--applause-wash);
  }
  .item--caught .claimed {
    color: var(--applause);
  }
  .verdict {
    position: relative;
    overflow: hidden;
    text-align: center;
  }
  .verdict.ok {
    border-color: var(--applause);
  }
  .sweep {
    position: absolute;
    inset: 0;
    background: linear-gradient(110deg, transparent 30%, var(--spotlight-wash-strong) 50%, transparent 70%);
    animation: sweep 0.6s var(--ease-stage);
    pointer-events: none;
  }
  .wrong-pick-msg {
    color: var(--miss);
  }
  .controls {
    justify-content: center;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }
  @keyframes sweep {
    from { transform: translateX(-100%); }
    to { transform: translateX(100%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .item, .sweep { transition-duration: 0.01ms; animation: none; }
  }
</style>
