import { useCallback, useRef } from 'react';
import { InputState } from '@/lib/minecraft/player';
import { BLOCK_BREAK_DURATION_MS } from '@/lib/minecraft/breakOverlay';

const TOUCH_SENS = 0.005;
const TAP_MAX_MS = 300;
const TAP_MAX_MOVE_PX = 10;

// 必须让准星停留在某个可破坏方块上累计 ARMING_MS 才开始破坏，
// 避免普通移动视角时把沿途方块误破坏。
const ARMING_MS = 300;

// 进入连续破坏后，只要准星离开所有可破坏方块超过 RESET_MS，
// 就视为玩家在「看视角」而非「连续挖掘」，重置回待武装状态。
const RESET_MS = 350;

type BreakMode = 'idle' | 'arming' | 'breaking';

interface TouchState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  // long-press break state
  mode: BreakMode;
  armingStartTime: number | null;
  airStartTime: number | null;
  breakTargetKey: string | null;
  breakStartTime: number | null;
  breakRaf: number | null;
  cancelled: boolean;
}

interface UseMobileControlsOptions {
  getInput: () => InputState | null;
  getPlayerState: () => { yaw: number; pitch: number; flying: boolean } | null;
  getBreakTargetKey: () => string | null;
  onPlaceBlock: () => void;
  onBreakBlock: () => void;
  onBreakProgress: (progress: number, x: number, y: number) => void;
  onBreakCancel: () => void;
}

export function useMobileControls({
  getInput,
  getPlayerState,
  getBreakTargetKey,
  onPlaceBlock,
  onBreakBlock,
  onBreakProgress,
  onBreakCancel,
}: UseMobileControlsOptions) {
  const rightTouchRef = useRef<TouchState | null>(null);

  // ── Joystick ────────────────────────────────────────────────────────────────
  const onJoystickMove = useCallback((x: number, y: number) => {
    const input = getInput();
    if (!input) return;
    input.joystickX = x;
    input.joystickY = y;
  }, [getInput]);

  const onJoystickRelease = useCallback(() => {
    const input = getInput();
    if (!input) return;
    input.joystickX = null;
    input.joystickY = null;
  }, [getInput]);

  // ── Jump / fly ──────────────────────────────────────────────────────────────
  const onJump = useCallback(() => {
    const input = getInput();
    if (!input) return;
    input.jump = true;
  }, [getInput]);

  const onJumpRelease = useCallback(() => {
    const input = getInput();
    if (!input) return;
    input.jump = false;
  }, [getInput]);

  const onAscend = useCallback(() => {
    const input = getInput();
    if (!input) return;
    input.jump = true;
  }, [getInput]);

  const onAscendRelease = useCallback(() => {
    const input = getInput();
    if (!input) return;
    input.jump = false;
  }, [getInput]);

  const onDescend = useCallback(() => {
    const input = getInput();
    if (!input) return;
    input.flyDown = true;
  }, [getInput]);

  const onDescendRelease = useCallback(() => {
    const input = getInput();
    if (!input) return;
    input.flyDown = false;
  }, [getInput]);

  const onToggleFly = useCallback(() => {
    const state = getPlayerState();
    if (!state) return;
    state.flying = !state.flying;
  }, [getPlayerState]);

  // ── Right-half touch helpers ─────────────────────────────────────────────────
  const cancelBreak = useCallback((ref: TouchState) => {
    if (ref.breakRaf !== null) {
      cancelAnimationFrame(ref.breakRaf);
      ref.breakRaf = null;
    }
    ref.mode = 'idle';
    ref.armingStartTime = null;
    ref.airStartTime = null;
    ref.breakTargetKey = null;
    ref.breakStartTime = null;
    ref.cancelled = true;
    onBreakCancel();
  }, [onBreakCancel]);

  const startBreakLoop = useCallback((ref: TouchState) => {
    if (ref.breakRaf !== null) return;
    ref.mode = 'idle';
    ref.armingStartTime = null;
    ref.airStartTime = null;
    ref.breakTargetKey = null;
    ref.breakStartTime = null;

    const tick = (now: number) => {
      if (ref.cancelled) return;

      const targetKey = getBreakTargetKey();

      if (!targetKey) {
        if (ref.mode === 'breaking') {
          if (ref.airStartTime === null) ref.airStartTime = now;
          if (now - ref.airStartTime >= RESET_MS) {
            ref.mode = 'idle';
            ref.armingStartTime = null;
            ref.breakTargetKey = null;
            ref.breakStartTime = null;
            onBreakCancel();
          }
        } else if (ref.mode === 'arming') {
          ref.mode = 'idle';
          ref.armingStartTime = null;
        }
        ref.airStartTime ??= now;
        ref.breakRaf = requestAnimationFrame(tick);
        return;
      }

      // 准星落在可破坏方块上，重置「离开空气」计时。
      ref.airStartTime = null;

      if (ref.mode === 'idle') {
        ref.mode = 'arming';
        ref.armingStartTime = now;
        ref.breakTargetKey = targetKey;
        ref.breakStartTime = null;
      } else if (ref.mode === 'arming') {
        if (targetKey !== ref.breakTargetKey) {
          ref.breakTargetKey = targetKey;
          ref.armingStartTime = now;
        }
        if (ref.armingStartTime !== null && now - ref.armingStartTime >= ARMING_MS) {
          ref.mode = 'breaking';
          ref.breakTargetKey = targetKey;
          ref.breakStartTime = now;
        }
      } else if (ref.mode === 'breaking') {
        // 连续破坏：准星移到新的可破坏方块时立即开始破坏新方块，不重新武装。
        if (targetKey !== ref.breakTargetKey) {
          ref.breakTargetKey = targetKey;
          ref.breakStartTime = now;
        }
      }

      if (ref.mode === 'breaking') {
        const elapsed = now - (ref.breakStartTime ?? now);
        const progress = Math.min(elapsed / BLOCK_BREAK_DURATION_MS, 1);
        onBreakProgress(progress, ref.lastX, ref.lastY);

        if (progress >= 1) {
          onBreakBlock();
          // 保持 breaking 状态：准星若仍在可破坏方块上，下一帧开始破坏下一个；
          // 若已离开，进入 air 计时分支，RESET_MS 后回到 idle。
          ref.breakTargetKey = null;
          ref.breakStartTime = null;
          onBreakCancel();
        }
      }

      ref.breakRaf = requestAnimationFrame(tick);
    };
    ref.breakRaf = requestAnimationFrame(tick);
  }, [getBreakTargetKey, onBreakBlock, onBreakProgress, onBreakCancel]);

  // ── Right-half touch events ──────────────────────────────────────────────────
  const onRightTouchStart = useCallback((e: React.TouchEvent) => {
    if (rightTouchRef.current !== null) return;
    const touch = e.changedTouches[0];

    const ref: TouchState = {
      id: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startTime: Date.now(),
      mode: 'idle',
      armingStartTime: null,
      airStartTime: null,
      breakTargetKey: null,
      breakStartTime: null,
      breakRaf: null,
      cancelled: false,
    };
    rightTouchRef.current = ref;

    startBreakLoop(ref);
  }, [startBreakLoop]);

  const onRightTouchMove = useCallback((e: React.TouchEvent) => {
    const ref = rightTouchRef.current;
    if (!ref) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== ref.id) continue;

      const movX = touch.clientX - ref.lastX;
      const movY = touch.clientY - ref.lastY;
      ref.lastX = touch.clientX;
      ref.lastY = touch.clientY;

      const state = getPlayerState();
      if (!state) break;
      state.yaw -= movX * TOUCH_SENS;
      state.pitch -= movY * TOUCH_SENS;
      state.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, state.pitch));
      break;
    }
  }, [getPlayerState]);

  const onRightTouchEnd = useCallback((e: React.TouchEvent) => {
    const ref = rightTouchRef.current;
    if (!ref) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== ref.id) continue;

      if (ref.mode !== 'idle') {
        cancelBreak(ref);
      }

      const dx = touch.clientX - ref.startX;
      const dy = touch.clientY - ref.startY;
      const moved = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - ref.startTime;

      if (moved <= TAP_MAX_MOVE_PX && duration < TAP_MAX_MS) {
        onPlaceBlock();
      }

      rightTouchRef.current = null;
      break;
    }
  }, [onPlaceBlock, cancelBreak]);

  return {
    onJoystickMove,
    onJoystickRelease,
    onJump,
    onJumpRelease,
    onAscend,
    onAscendRelease,
    onDescend,
    onDescendRelease,
    onToggleFly,
    onRightTouchStart,
    onRightTouchMove,
    onRightTouchEnd,
  };
}
