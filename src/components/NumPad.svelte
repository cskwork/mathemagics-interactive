<script lang="ts">
  /**
   * Hallmark · P3 H3 E4 S3 R4 V3 — 가상 넘패드 (브리프 §2-5 / 리서치 §2.2).
   *
   * 태블릿에서 OS 키보드가 화면을 가리는 것을 막고, 큰 터치 타깃(≥48px)으로 아동이 누르기 쉽게 한다.
   * 배치: 1-2-3 / 4-5-6 / 7-8-9 / 지우기-0-⌫. 물리 키보드는 DigitInput 에서 병행 처리.
   */
  import { m } from '../lib/paraglide/messages.js';

  interface Props {
    ondigit: (d: string) => void;
    onbackspace: () => void;
    onclear: () => void;
    disabled?: boolean;
  }
  const { ondigit, onbackspace, onclear, disabled = false }: Props = $props();

  // 3×4 그리드: 1-9, 지우기/0/⌫
  const layout = [
    { k: '1', label: '1', act: () => ondigit('1') },
    { k: '2', label: '2', act: () => ondigit('2') },
    { k: '3', label: '3', act: () => ondigit('3') },
    { k: '4', label: '4', act: () => ondigit('4') },
    { k: '5', label: '5', act: () => ondigit('5') },
    { k: '6', label: '6', act: () => ondigit('6') },
    { k: '7', label: '7', act: () => ondigit('7') },
    { k: '8', label: '8', act: () => ondigit('8') },
    { k: '9', label: '9', act: () => ondigit('9') },
    { k: 'clear', label: () => m.numpad_clear(), act: () => onclear() },
    { k: '0', label: '0', act: () => ondigit('0') },
    { k: 'back', label: '⌫', act: () => onbackspace() }
  ];
</script>

<div class="numpad" role="group" aria-label={m.numpad_label()}>
  {#each layout as b (b.k)}
    <button
      class="num"
      onclick={b.act}
      {disabled}
      aria-label={typeof b.label === 'function' ? b.label() : b.label}
    >
      {typeof b.label === 'function' ? b.label() : b.label}
    </button>
  {/each}
</div>

<style>
  /* Hallmark · P3 H3 E4 S3 R4 V3 — 숫자 카드 음성. 넘패드 버튼 = 무대 위 숫자 카드.
   * 카드 깊이(inset highlight + drop) 로 손가락에 닿는 질감. tabular-nums 로 정렬. */
  .numpad {
    display: grid;
    grid-template-columns: repeat(3, var(--tap));
    gap: var(--space-2);
    justify-content: center;
  }
  .num {
    width: var(--tap);
    height: var(--tap);
    font-size: 1.4rem;
    font-weight: 800;
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    padding: 0;
    background: var(--stage-lit);
    color: var(--house-bright);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-inset), var(--shadow-cell);
  }
  .num:hover {
    background: var(--stage-rise);
  }
  .num:active {
    transform: translateY(1px);
    box-shadow: var(--shadow-inset);
  }
</style>
