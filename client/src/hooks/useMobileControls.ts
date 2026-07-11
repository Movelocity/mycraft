import { useCallback, useRef } from 'react';
import { InputState } from '@/lib/minecraft/player';

const TOUCH_SENS = 0.005;
const TAP_MAX_MS = 300;
const TAP_MAX_MOVE_PX = 10;
const BREAK_DURATION_MS = 400; // time to fill the ring and break
const BREAK_COOLDOWN_MS = TAP_MAX_MS/2;

interface TouchState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  // long-press break state
  breaking: boolean;
  breakTargetKey: string | null;
  breakStartTime: number | null;
  breakCooldownUntil: number | null;
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
    ref.breaking = false;
    ref.breakTargetKey = null;
    ref.breakStartTime = null;
    ref.breakCooldownUntil = null;
    ref.cancelled = true;
    onBreakCancel();
  }, [onBreakCancel]);

  const startBreakLoop = useCallback((ref: TouchState) => {
    ref.breaking = true;
    ref.breakTargetKey = null;
    ref.breakStartTime = null;
    ref.breakCooldownUntil = null;

    const tick = (now: number) => {
      if (!ref.breaking || ref.cancelled) return;
      if (ref.breakCooldownUntil !== null) {
        if (now < ref.breakCooldownUntil) {
          ref.breakRaf = requestAnimationFrame(tick);
          return;
        }
        ref.breakCooldownUntil = null;
      }

      const targetKey = getBreakTargetKey();
      if (!targetKey) {
        if (ref.breakTargetKey !== null) {
          onBreakCancel();
        }
        ref.breakTargetKey = null;
        ref.breakStartTime = null;
        ref.breakRaf = requestAnimationFrame(tick);
        return;
      }

      if (targetKey !== ref.breakTargetKey) {
        ref.breakTargetKey = targetKey;
        ref.breakStartTime = now;
      }

      const elapsed = now - (ref.breakStartTime ?? now);
      const progress = Math.min(elapsed / BREAK_DURATION_MS, 1);
      onBreakProgress(progress, ref.lastX, ref.lastY);

      if (progress >= 1) {
        ref.breakTargetKey = null;
        ref.breakStartTime = null;
        ref.breakCooldownUntil = now + BREAK_COOLDOWN_MS;
        onBreakBlock();
        onBreakCancel();
        ref.breakRaf = requestAnimationFrame(tick);
        return;
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
      breaking: false,
      breakTargetKey: null,
      breakStartTime: null,
      breakCooldownUntil: null,
      breakRaf: null,
      cancelled: false,
    };
    rightTouchRef.current = ref;

    // Start break progress after TAP_MAX_MS (finger still held)
    setTimeout(() => {
      const cur = rightTouchRef.current;
      if (!cur || cur.id !== ref.id || cur.cancelled) return;
      startBreakLoop(cur);
    }, TAP_MAX_MS);
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

      if (ref.breaking) {
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
