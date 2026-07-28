<script lang="ts">
  /**
   * Hallmark · P4 H4 E4 S4 R4 V4 — 개발용 플레이그라운드 (브리프 §2-6). `#/dev/playground` 에서만 접근 — 내비게이션에 숨김.
   *
   * 파라미터(op·method·digits·carry)를 조절해 문제를 생성하고, ① 애니메이션 재생 모드
   * ② 직접 입력 모드를 전환하며 엔진+렌더+입력 전 파이프라인을 확인한다.
   * URL 쿼리(`#/dev/playground?op=add&method=ltr&digits=3&carry=1&mode=animation`)로 초기값 지정.
   *
   * M7: 컨트롤 = "조명실(lighting booth)" 패널, 계산 그리드 = "무대(stage)". URL 계약·로직은 동일.
   */
  import { m } from '../lib/paraglide/messages.js';
  import { generateProblem } from '../lib/engine/generate.js';
  import { deriveGrid, deriveSteps } from '../lib/engine/derive.js';
  import type { Method, Op, Problem } from '../lib/engine/types.js';
  import StepPlayer from '../components/StepPlayer.svelte';
  import DigitInput from '../components/DigitInput.svelte';

  type Mode = 'animation' | 'input';

  function readQuery(): {
    op: Op;
    method: Method;
    digits: number;
    carry: boolean;
    mode: Mode;
    seed: number;
  } {
    const hash = typeof location !== 'undefined' ? location.hash : '';
    const qIdx = hash.indexOf('?');
    const q = qIdx >= 0 ? new URLSearchParams(hash.slice(qIdx + 1)) : null;
    const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
    return {
      op: q?.get('op') === 'sub' ? 'sub' : 'add',
      method: q?.get('method') === 'ltr' ? 'ltr' : 'rtl',
      digits: clamp(Number(q?.get('digits') ?? 3) || 3, 1, 4),
      carry: q?.get('carry') !== '0',
      mode: q?.get('mode') === 'input' ? 'input' : 'animation',
      seed: Number(q?.get('seed') ?? 7) || 7
    };
  }

  const init = readQuery();
  let op = $state<Op>(init.op);
  let method = $state<Method>(init.method);
  let digits = $state(init.digits);
  let carry = $state(init.carry);
  let mode = $state<Mode>(init.mode);
  let seed = $state(init.seed);

  /** 문제 생성 결과(순수 derive — 부작용 없음). */
  const generated = $derived.by<{ problem: Problem; error: undefined } | { problem: undefined; error: string }>(
    () => {
      try {
        return { problem: generateProblem(seed, { op, method, digits, carry }), error: undefined };
      } catch (e) {
        return { problem: undefined, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );
  const problem = $derived(generated.problem);
  const errorMsg = $derived(generated.error);
  const grid = $derived(problem ? deriveGrid(problem) : undefined);
  const steps = $derived(problem ? deriveSteps(problem) : undefined);

  function newProblem(): void {
    seed = Math.floor(Math.random() * 0xffffffff);
  }
</script>

<section class="stack booth-layout">
  <h2>{m.playground_title()}</h2>

  <!-- 조명실(lighting booth) 패널 — 공연을 조정하는 컨트롤 -->
  <div class="card booth" role="group" aria-label={m.playground_booth()}>
    <p class="booth-label">{m.playground_booth()}</p>
    <div class="booth-grid">
      <label class="ctl">
        <span>{m.playground_op()}</span>
        <select bind:value={op}>
          <option value="add">{m.playground_op_add()}</option>
          <option value="sub">{m.playground_op_sub()}</option>
        </select>
      </label>
      <label class="ctl">
        <span>{m.playground_method()}</span>
        <select bind:value={method}>
          <option value="ltr">{m.playground_method_ltr()}</option>
          <option value="rtl">{m.playground_method_rtl()}</option>
        </select>
      </label>
      <label class="ctl">
        <span>{m.playground_digits()}</span>
        <select bind:value={digits}>
          {#each [2, 3, 4] as d (d)}
            <option value={d}>{d}</option>
          {/each}
        </select>
      </label>
      <label class="ctl">
        <span>{m.playground_carry()}</span>
        <select bind:value={carry}>
          <option value={true}>{m.playground_carry_yes()}</option>
          <option value={false}>{m.playground_carry_no()}</option>
        </select>
      </label>
      <label class="ctl">
        <span>{m.playground_mode()}</span>
        <select bind:value={mode}>
          <option value="animation">{m.playground_mode_animation()}</option>
          <option value="input">{m.playground_mode_input()}</option>
        </select>
      </label>
      <button class="btn--primary" onclick={newProblem}>{m.playground_new_problem()}</button>
    </div>
  </div>

  <!-- 무대(stage) — 계산 그리드가 서는 중앙 -->
  <div class="stage-deck" role="group" aria-label={m.playground_stage()}>
    {#if errorMsg}
      <p class="card" role="alert">{errorMsg}</p>
    {:else if problem && grid && steps}
      <div class="stage-deck-grid">
        {#if mode === 'animation'}
          {#key seed + op + method + digits + carry}
            <StepPlayer {grid} {steps} />
          {/key}
        {:else}
          {#key seed + op + method + digits + carry}
            <DigitInput {grid} {steps} />
          {/key}
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .booth {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    /* 조명실 패널 — 무대보다 한 단 어둡게, 뚜렷한 가장자리 */
    background: var(--stage-floor);
    border-color: var(--stage-edge);
  }
  .booth-label {
    margin: 0;
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--house-light);
  }
  .booth-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--space-3);
    align-items: end;
  }
  .ctl {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .ctl span {
    font-size: var(--text-small);
    color: var(--house-light);
  }
  /* 새 문제 버튼을 그리드 셀 하나를 차지하도록 */
  .booth-grid > button {
    width: 100%;
  }

  .stage-deck {
    /* 무대 중앙 — 엷은 스포트라이트 침전 */
    background-image: var(--stage-spotlight-bg);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-4);
    min-height: var(--tap);
  }
  .stage-deck-grid {
    display: flex;
    justify-content: center;
  }
</style>
