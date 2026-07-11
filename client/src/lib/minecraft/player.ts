// Player controller for Web Minecraft Demo
// First-person movement with WASD + mouse look + pointer lock

import * as THREE from 'three';
import { BLOCKS } from './blocks';
import { ChunkManager } from './chunk';

const PLAYER_HEIGHT = 1.7;
const PLAYER_SPEED = 5.0;
const SPRINT_MULTIPLIER = 1.6;
const JUMP_VELOCITY = 8.0;
const GRAVITY = -20.0;
const PLAYER_RADIUS = 0.3;
const JUMP_DOUBLE_TAP_WINDOW = 300; // ms for double-jump to fly
const SNEAK_SPEED_MULTIPLIER = 0.5;
const SNEAK_EYE_OFFSET = 0.3;

export interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;   // horizontal rotation (radians)
  pitch: number; // vertical rotation (radians)
  onGround: boolean;
  flying: boolean;
  sneaking: boolean;
  wasJumpPressed: boolean;
  lastSneakTime: number;
  wasSneakPressed: boolean;
}

export function createPlayerState(spawnX: number, spawnY: number, spawnZ: number): PlayerState {
  return {
    position: new THREE.Vector3(spawnX, spawnY, spawnZ),
    velocity: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    pitch: 0,
    onGround: false,
    flying: false,
    sneaking: false,
    wasJumpPressed: false,
    lastSneakTime: 0,
    wasSneakPressed: false,
  };
}

function isSolid(manager: ChunkManager, x: number, y: number, z: number): boolean {
  const block = manager.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  if (block === 'air') return false;
  return BLOCKS[block].solid;
}

function checkCollisionY(manager: ChunkManager, pos: THREE.Vector3, dy: number): { blocked: boolean; correction: number } {
  const newY = pos.y + dy;
  const feet = newY - PLAYER_HEIGHT;
  const head = newY;

  const x0 = Math.floor(pos.x - PLAYER_RADIUS);
  const x1 = Math.floor(pos.x + PLAYER_RADIUS);
  const z0 = Math.floor(pos.z - PLAYER_RADIUS);
  const z1 = Math.floor(pos.z + PLAYER_RADIUS);

  if (dy < 0) {
    // Moving down — check feet
    const fy = Math.floor(feet);
    for (let bx = x0; bx <= x1; bx++) {
      for (let bz = z0; bz <= z1; bz++) {
        if (isSolid(manager, bx, fy, bz)) {
          return { blocked: true, correction: fy + 1 + PLAYER_HEIGHT };
        }
      }
    }
  } else if (dy > 0) {
    // Moving up — check head
    const hy = Math.floor(head);
    for (let bx = x0; bx <= x1; bx++) {
      for (let bz = z0; bz <= z1; bz++) {
        if (isSolid(manager, bx, hy, bz)) {
          return { blocked: true, correction: hy - 0.01 };
        }
      }
    }
  }

  return { blocked: false, correction: newY };
}

function checkCollisionXZ(manager: ChunkManager, pos: THREE.Vector3, dx: number, dz: number): { nx: number; nz: number } {
  let nx = pos.x + dx;
  let nz = pos.z + dz;

  const yFeet = Math.floor(pos.y - PLAYER_HEIGHT);
  const yHead = Math.floor(pos.y - 0.1);

  // Check X
  const testX = nx + Math.sign(dx) * PLAYER_RADIUS;
  const z0 = Math.floor(pos.z - PLAYER_RADIUS);
  const z1 = Math.floor(pos.z + PLAYER_RADIUS);
  for (let by = yFeet; by <= yHead; by++) {
    for (let bz = z0; bz <= z1; bz++) {
      if (isSolid(manager, testX, by, bz)) {
        nx = pos.x;
        break;
      }
    }
  }

  // Check Z
  const testZ = nz + Math.sign(dz) * PLAYER_RADIUS;
  const x0 = Math.floor(nx - PLAYER_RADIUS);
  const x1 = Math.floor(nx + PLAYER_RADIUS);
  for (let by = yFeet; by <= yHead; by++) {
    for (let bx = x0; bx <= x1; bx++) {
      if (isSolid(manager, bx, by, testZ)) {
        nz = pos.z;
        break;
      }
    }
  }

  return { nx, nz };
}

function checkSneakEdge(manager: ChunkManager, pos: THREE.Vector3, dx: number, dz: number): boolean {
  const newX = pos.x + dx;
  const newZ = pos.z + dz;
  const feetY = Math.floor(pos.y - PLAYER_HEIGHT);
  const checkY = feetY - 1;

  const corners = [
    { x: newX - PLAYER_RADIUS, z: newZ - PLAYER_RADIUS },
    { x: newX + PLAYER_RADIUS, z: newZ - PLAYER_RADIUS },
    { x: newX - PLAYER_RADIUS, z: newZ + PLAYER_RADIUS },
    { x: newX + PLAYER_RADIUS, z: newZ + PLAYER_RADIUS },
  ];

  for (const corner of corners) {
    const bx = Math.floor(corner.x);
    const bz = Math.floor(corner.z);
    if (isSolid(manager, bx, checkY, bz)) {
      return true;
    }
  }
  return false;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  sneak: boolean;
  fly: boolean;
  flyDown: boolean;
  // Analog joystick override: range [-1, 1]; null = use boolean keys above
  joystickX: number | null;
  joystickY: number | null;
}

export function updatePlayer(
  state: PlayerState,
  input: InputState,
  manager: ChunkManager,
  dt: number
): void {
  // Jump or enter flying
  const jumpJustPressed = input.jump && !state.wasJumpPressed;
  if (jumpJustPressed && !state.flying) {
    if (state.onGround) {
      // On ground: normal jump
      state.velocity.y = JUMP_VELOCITY;
      state.onGround = false;
    } else {
      // In air: enter flying mode
      state.flying = true;
      state.velocity.y = 0;
    }
  }
  state.wasJumpPressed = input.jump;

  // Double-shift to exit flying
  const sneakJustPressed = input.sneak && !state.wasSneakPressed;
  if (sneakJustPressed && state.flying) {
    const now = performance.now();
    if (now - state.lastSneakTime < JUMP_DOUBLE_TAP_WINDOW) {
      state.flying = false;
      state.lastSneakTime = 0;
    } else {
      state.lastSneakTime = now;
    }
  }
  state.wasSneakPressed = input.sneak;

  const speed = PLAYER_SPEED
    * (input.sprint ? SPRINT_MULTIPLIER : 1.0)
    * (state.sneaking ? SNEAK_SPEED_MULTIPLIER : 1.0);

  // Joystick analog input takes priority over boolean keys
  let moveX: number;
  let moveZ: number;
  if (input.joystickX !== null && input.joystickY !== null) {
    moveX = input.joystickX;
    moveZ = input.joystickY;
  } else {
    moveX = 0;
    moveZ = 0;
    if (input.forward) moveZ -= 1;
    if (input.backward) moveZ += 1;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;
  }

  // Rotate movement by yaw to world space
  const cos = Math.cos(state.yaw);
  const sin = Math.sin(state.yaw);
  const worldX = moveX * cos + moveZ * sin;
  const worldZ = -moveX * sin + moveZ * cos;

  // Normalize only boolean input; joystick already provides magnitude
  const moveLen = Math.sqrt(worldX * worldX + worldZ * worldZ);
  const hasAnalog = input.joystickX !== null;
  const normalizedX = moveLen > 0 ? (hasAnalog ? worldX : worldX / moveLen) : 0;
  const normalizedZ = moveLen > 0 ? (hasAnalog ? worldZ : worldZ / moveLen) : 0;

  if (state.flying) {
    // Flying mode: Space = up, Shift = down (2x walk speed)
    const flySpeed = speed * 1.6;
    state.velocity.x = normalizedX * flySpeed;
    state.velocity.z = normalizedZ * flySpeed;
    state.velocity.y = 0;
    if (input.jump) state.velocity.y = flySpeed;
    if (input.sneak) state.velocity.y = -flySpeed;
    state.sneaking = false;
  } else {
    // Normal mode
    state.sneaking = input.sneak;

    // Sneak edge protection
    let dxMove = normalizedX * speed * dt;
    let dzMove = normalizedZ * speed * dt;
    if (state.sneaking && (dxMove !== 0 || dzMove !== 0)) {
      if (!checkSneakEdge(manager, state.position, dxMove, dzMove)) {
        dxMove = 0;
        dzMove = 0;
      }
    }

    state.velocity.x = dxMove / dt;
    state.velocity.z = dzMove / dt;

    // Gravity
    state.velocity.y += GRAVITY * dt;

    // Jump
    if (jumpJustPressed && state.onGround) {
      state.velocity.y = JUMP_VELOCITY;
      state.onGround = false;
    }
  }

  // Apply Y movement with collision
  const dy = state.velocity.y * dt;
  const yResult = checkCollisionY(manager, state.position, dy);
  if (yResult.blocked) {
    if (state.velocity.y < 0) {
      state.onGround = true;
    }
    state.velocity.y = 0;
    state.position.y = yResult.correction;
  } else {
    state.position.y = yResult.correction;
    if (state.velocity.y < 0) {
      state.onGround = false;
    }
  }

  // Apply XZ movement with collision
  const dx = state.velocity.x * dt;
  const dz = state.velocity.z * dt;
  const xzResult = checkCollisionXZ(manager, state.position, dx, dz);
  state.position.x = xzResult.nx;
  state.position.z = xzResult.nz;
}

export function applyPlayerToCamera(state: PlayerState, camera: THREE.PerspectiveCamera): void {
  camera.position.copy(state.position);
  if (state.sneaking) {
    camera.position.y -= SNEAK_EYE_OFFSET;
  }
  camera.rotation.order = 'YXZ';
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
}

// Check if the player's body AABB overlaps a block at (bx, by, bz)
export function isPlayerOverlappingBlock(
  state: PlayerState,
  bx: number,
  by: number,
  bz: number,
): boolean {
  const feetY = state.position.y - PLAYER_HEIGHT;
  const headY = state.position.y;
  const playerXMin = state.position.x - PLAYER_RADIUS;
  const playerXMax = state.position.x + PLAYER_RADIUS;
  const playerZMin = state.position.z - PLAYER_RADIUS;
  const playerZMax = state.position.z + PLAYER_RADIUS;

  return (
    playerXMax > bx && playerXMin < bx + 1 &&
    playerZMax > bz && playerZMin < bz + 1 &&
    headY > by && feetY < by + 1
  );
}

// Raycasting for block targeting
export function getTargetBlock(
  camera: THREE.PerspectiveCamera,
  manager: ChunkManager,
  maxDistance: number = 6
): { hit: boolean; blockPos: THREE.Vector3; faceNormal: THREE.Vector3 } | null {
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyEuler(camera.rotation);

  const pos = camera.position.clone();
  const step = 0.05;

  let prevPos = pos.clone();

  for (let d = 0; d < maxDistance; d += step) {
    const bx = Math.floor(pos.x);
    const by = Math.floor(pos.y);
    const bz = Math.floor(pos.z);

    const block = manager.getBlock(bx, by, bz);
    if (block !== 'air' && !BLOCKS[block].liquid) {
      // Compute face normal from previous position
      const pbx = Math.floor(prevPos.x);
      const pby = Math.floor(prevPos.y);
      const pbz = Math.floor(prevPos.z);
      const normal = new THREE.Vector3(pbx - bx, pby - by, pbz - bz);

      return {
        hit: true,
        blockPos: new THREE.Vector3(bx, by, bz),
        faceNormal: normal,
      };
    }

    prevPos.copy(pos);
    pos.addScaledVector(direction, step);
  }

  return null;
}
