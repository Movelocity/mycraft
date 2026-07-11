import { useCallback, useRef } from 'react';
import { InputState } from '@/lib/minecraft/player';

const TOUCH_SENS = 0.005;
const TAP_MAX_MS = 300;
const TAP_MAX_MOVE_PX = 10;
const BREAK_DURATION_MS = 350; // time to fill the ring and break

interface TouchState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  // long-press break state
  breaking: boolean;
  breakStartTime: number | null;
  breakRaf: number | null;
  cancelled: boolean;
}

interface UseMobileControlsOptions {
  getInput: () => InputState | null;
  getPlayerState: () => { yaw: number; pitch: number; flying: boolean } | null;
  onPlaceBlock: () => void;
  onBreakBlock: () => void;
  onBreakProgress: (progress: number, x: number, y: number) => void;
  onBreakCancel: () => void;
}

export function useMobileControls({
  getInput,
  getPlayerState,
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
    ref.cancelled = true;
    onBreakCancel();
  }, [onBreakCancel]);

  const startBreakLoop = useCallback((ref: TouchState) => {
    ref.breaking = true;
    ref.breakStartTime = performance.now();

    const tick = (now: number) => {
      if (!ref.breaking || ref.cancelled) return;
      const elapsed = now - (ref.breakStartTime ?? now);
      const progress = Math.min(elapsed / BREAK_DURATION_MS, 1);
      onBreakProgress(progress, ref.startX, ref.startY);

      if (progress >= 1) {
        ref.breaking = false;
        ref.breakRaf = null;
        onBreakBlock();
        onBreakCancel();
        rightTouchRef.current = null;
        return;
      }
      ref.breakRaf = requestAnimationFrame(tick);
    };
    ref.breakRaf = requestAnimationFrame(tick);
  }, [onBreakBlock, onBreakProgress, onBreakCancel]);

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
      breakStartTime: null,
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

      const dx = touch.clientX - ref.startX;
      const dy = touch.clientY - ref.startY;
      const moved = Math.sqrt(dx * dx + dy * dy);

      // Cancel break ring if finger moved too far
      if (moved > TAP_MAX_MOVE_PX && ref.breaking) {
        cancelBreak(ref);
      }

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
  }, [getPlayerState, cancelBreak]);

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
