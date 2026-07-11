import { useCallback, useRef } from 'react';
import { InputState } from '@/lib/minecraft/player';

const TOUCH_SENS = 0.005;
const TAP_MAX_MS = 300;
const TAP_MAX_MOVE_PX = 10;
const LONG_PRESS_MS = 300;

interface TouchState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

interface UseMobileControlsOptions {
  getInput: () => InputState | null;
  getPlayerState: () => { yaw: number; pitch: number; flying: boolean } | null;
  onPlaceBlock: () => void;
  onBreakBlock: () => void;
}

export function useMobileControls({
  getInput,
  getPlayerState,
  onPlaceBlock,
  onBreakBlock,
}: UseMobileControlsOptions) {
  const rightTouchRef = useRef<TouchState | null>(null);

  // Joystick callbacks
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

  // Jump / fly controls
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

  // Right-half touch: view look + tap/long-press gestures
  const onRightTouchStart = useCallback((e: React.TouchEvent) => {
    if (rightTouchRef.current !== null) return;
    const touch = e.changedTouches[0];
    const longPressTimer = setTimeout(() => {
      onBreakBlock();
      if (rightTouchRef.current) rightTouchRef.current.longPressTimer = null;
    }, LONG_PRESS_MS);

    rightTouchRef.current = {
      id: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startTime: Date.now(),
      longPressTimer,
    };
  }, [onBreakBlock]);

  const onRightTouchMove = useCallback((e: React.TouchEvent) => {
    const ref = rightTouchRef.current;
    if (!ref) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== ref.id) continue;

      const dx = touch.clientX - ref.startX;
      const dy = touch.clientY - ref.startY;
      const moved = Math.sqrt(dx * dx + dy * dy);

      // Cancel long-press if finger moved significantly
      if (moved > TAP_MAX_MOVE_PX && ref.longPressTimer !== null) {
        clearTimeout(ref.longPressTimer);
        ref.longPressTimer = null;
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
  }, [getPlayerState]);

  const onRightTouchEnd = useCallback((e: React.TouchEvent) => {
    const ref = rightTouchRef.current;
    if (!ref) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== ref.id) continue;

      if (ref.longPressTimer !== null) {
        clearTimeout(ref.longPressTimer);
        ref.longPressTimer = null;
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
  }, [onPlaceBlock]);

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
