<!-- Hallmark · P4 H4 E4 S4 R4 V4 — 인앱 다이얼로그 (M7 산출물 4, M0 인계 #3 폐쇄).
  - 네이티브 prompt/confirm 을 대체: 메인 스레드를 막지 않고 8–13세 UX(PLAN §7.2)에 맞는 모달.
  - 접근성: role="dialog" aria-modal="true" aria-labelledby(제목). 포커스 트랩 + ESC 닫기 +
    배경 클릭 닫기. 닫힐 때 호출자(트리거)로 포커스 복귀.
  - 변형: prompt(이름변경 등 텍스트 입력) · confirm(단순 확인) · parent-gate(파괴적 행동 보호,
    산술 과제 — makeParentGateChallenge). parent-gate 는 COPPA 정합 어른 확인(PLAN §7.2). -->
<script lang="ts">
  import { m } from '../paraglide/messages.js';
  import { isParentGateCorrect, makeParentGateChallenge, type ParentGateChallenge } from '../ui/parent-gate.js';

  type Variant = 'prompt' | 'confirm' | 'parent-gate';

  interface Props {
    open: boolean;
    title: string;
    description?: string;
    variant?: Variant;
    promptLabel?: string;
    promptValue?: string;
    promptPlaceholder?: string;
    danger?: boolean;
    confirmLabel?: string;
    cancelLabel?: string;
    gatePrompt?: string;
    gateWrong?: string;
    confirmError?: string;
    /** 확인 시. prompt 변형은 입력값을, 그 외는 빈 문자열을 넘긴다. */
    onconfirm?: (value: string) => void | Promise<void>;
    /** 취소/ESC/배경클릭 시. */
    oncancel?: () => void;
  }

  let {
    open = $bindable(false),
    title,
    description,
    variant = 'confirm',
    promptLabel,
    promptValue = '',
    promptPlaceholder,
    danger = false,
    confirmLabel,
    cancelLabel,
    gatePrompt,
    gateWrong,
    confirmError,
    onconfirm,
    oncancel
  }: Props = $props();

  let panel: HTMLDivElement | undefined = $state();
  let textValue = $state('');
  let gate: ParentGateChallenge | undefined = $state(undefined);
  let gateInput = $state('');
  let gateError = $state(false);
  let submitting = $state(false);
  let actionError = $state<string | null>(null);
  let lastFocused: HTMLElement | null = null;

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const gateSolved = $derived(
    variant === 'parent-gate' && gate ? isParentGateCorrect(gate, gateInput) : false
  );

  const confirmDisabled = $derived(
    submitting || (variant === 'prompt' ? textValue.trim() === '' : variant === 'parent-gate' ? !gateSolved : false)
  );

  function close(): void {
    open = false;
  }

  function fireCancel(): void {
    if (submitting) return;
    oncancel?.();
    close();
  }

  async function fireConfirm(): Promise<void> {
    if (confirmDisabled) {
      if (variant === 'parent-gate') gateError = true;
      return;
    }
    actionError = null;
    submitting = true;
    try {
      await onconfirm?.(variant === 'prompt' ? textValue.trim() : '');
      close();
    } catch {
      actionError = confirmError ?? m.dialog_action_error();
    } finally {
      submitting = false;
    }
  }

  function focusables(): HTMLElement[] {
    if (!panel) return [];
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function onWindowKey(e: KeyboardEvent): void {
    if (!open || e.key !== 'Escape') return;
    e.preventDefault();
    fireCancel();
  }

  function onBackdrop(e: MouseEvent): void {
    if (e.target === backdropEl) fireCancel();
  }

  let backdropEl: HTMLDivElement | undefined = $state();

  // 열릴 때: 변형별 초기화 + 포커스 이동. 닫힐 때: 포커스 복귀.
  $effect(() => {
    if (!open) return;
    lastFocused = document.activeElement as HTMLElement | null;
    submitting = false;
    actionError = null;
    if (variant === 'prompt') textValue = promptValue;
    if (variant === 'parent-gate') {
      gate = makeParentGateChallenge();
      gateInput = '';
      gateError = false;
    }
    // 다음 프레임에 포커스 이동(패널이 DOM 에 그려진 뒤).
    const id = requestAnimationFrame(() => {
      const items = focusables();
      // prompt → 입력칸, 그 외 → 확인 버튼이 우선(주 행동). 없으면 첫 포커서블.
      const target =
        variant === 'prompt' ? panel?.querySelector<HTMLInputElement>('input') : undefined;
      (target ?? items[0])?.focus();
    });
    return () => {
      cancelAnimationFrame(id);
      lastFocused?.focus?.();
    };
  });

  const titleId = 'dialog-title';
</script>

<svelte:window onkeydown={onWindowKey} />

{#if open}
  <div
    bind:this={backdropEl}
    class="backdrop"
    role="presentation"
    onclick={onBackdrop}
  >
    <div
      bind:this={panel}
      class="panel"
      class:danger
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-busy={submitting}
      tabindex="-1"
      onkeydown={onKey}
    >
      <h2 id={titleId} class="title">{title}</h2>

      {#if description}
        <p class="desc">{description}</p>
      {/if}

      {#if variant === 'prompt'}
        <label class="field">
          {#if promptLabel}<span class="label">{promptLabel}</span>{/if}
          <input
            bind:value={textValue}
            placeholder={promptPlaceholder}
            maxlength="20"
            autocomplete="off"
            onkeydown={(e) => {
              if (e.key === 'Enter') void fireConfirm();
            }}
          />
        </label>
      {:else if variant === 'parent-gate' && gate}
        <div class="gate">
          {#if gatePrompt}<p class="gate-prompt">{gatePrompt}</p>{/if}
          <p class="gate-sum" aria-label={gate?.prompt}>{gate.prompt} = ?</p>
          <label class="field">
            <span class="label">{m.dialog_parent_gate_answer_label()}</span>
            <input
              bind:value={gateInput}
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              onkeydown={(e) => {
                gateError = false;
                if (e.key === 'Enter') void fireConfirm();
              }}
            />
          </label>
          {#if gateError && !gateSolved}
            <p class="gate-wrong" role="alert">{gateWrong}</p>
          {/if}
        </div>
      {/if}

      {#if actionError}
        <p class="action-error" role="alert">{actionError}</p>
      {/if}

      <div class="actions">
        <button type="button" class="btn--ghost" onclick={fireCancel} disabled={submitting}>
          {cancelLabel ?? m.dialog_cancel()}
        </button>
        <button
          type="button"
          class={danger ? 'btn--danger' : 'btn--primary'}
          onclick={() => void fireConfirm()}
          disabled={confirmDisabled}
          data-state={submitting ? 'loading' : undefined}
        >
          {confirmLabel ?? m.dialog_confirm()}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background: color-mix(in srgb, var(--stage-floor) 80%, transparent);
    backdrop-filter: blur(4px);
    /* 모달 진입 — 대비를 유지하는 짧은 이동. reduced-motion 은 전역 블록이 즉시 전환. */
    animation: curtain-rise var(--motion-base) var(--ease-stage) both;
  }

  .panel {
    width: min(100%, 26rem);
    max-height: 90dvh;
    overflow: auto;
    background: var(--gradient-card);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-stage), 0 0 40px var(--spotlight-wash);
    padding: var(--space-5) var(--space-5) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    animation: dialog-in var(--motion-slow) var(--ease-spring) both;
  }
  @keyframes dialog-in {
    from { transform: scale(0.92) translateY(10px); }
    to { transform: scale(1) translateY(0); }
  }
  .panel.danger {
    border-color: color-mix(in srgb, var(--miss) 55%, transparent);
  }

  .title {
    font-size: var(--text-title);
    margin: 0;
  }

  .desc {
    color: var(--house-light);
    line-height: 1.5;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-top: var(--space-1);
  }
  .field .label,
  .gate-prompt {
    font-size: var(--text-small);
    color: var(--house-light);
  }
  .field input {
    width: 100%;
    background: var(--stage-floor);
    color: var(--house-bright);
    border-color: var(--stage-line);
  }

  .gate {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }
  .gate-sum {
    margin: 0;
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--spotlight);
    text-align: center;
    padding: var(--space-3);
    background: var(--stage-floor);
    border-radius: var(--radius);
  }
  .gate-wrong {
    margin: 0;
    color: var(--miss);
    font-size: var(--text-small);
  }

  .action-error {
    margin: 0;
    color: var(--miss);
    font-size: var(--text-small);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
</style>
