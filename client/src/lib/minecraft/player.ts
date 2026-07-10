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

export interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;   // horizontal rotation (radians)
  pitch: number; // vertical rotation (radians)
  onGround: boolean;
  flying: boolean;
}

export function createPlayerState(spawnX: number, spawnY: number, spawnZ: number): PlayerState {
  return {
    position: new THREE.Vector3(spawnX, spawnY, spawnZ),
    velocity: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    pitch: 0,
    onGround: false,
    flying: false,
  };
}

function isSolid(manager: ChunkManager, x: number, y: number, z: number): boolean {
  const block = manager.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  if (block === 'air') return false;
  const def = BLOCKS[block];
  return !def.transparent && !def.liquid;
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

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  fly: boolean;
}

export function updatePlayer(
  state: PlayerState,
  input: InputState,
  manager: ChunkManager,
  dt: number
): void {
  const speed = PLAYER_SPEED * (input.sprint ? SPRINT_MULTIPLIER : 1.0);

  // Movement direction in camera space (forward = -Z, right = +X)
  let moveX = 0;
  let moveZ = 0;
  if (input.forward) moveZ -= 1;
  if (input.backward) moveZ += 1;
  if (input.left) moveX -= 1;
  if (input.right) moveX += 1;

  // Rotate movement by yaw to world space
  const cos = Math.cos(state.yaw);
  const sin = Math.sin(state.yaw);
  const worldX = moveX * cos + moveZ * sin;
  const worldZ = -moveX * sin + moveZ * cos;

  // Normalize if moving
  const moveLen = Math.sqrt(worldX * worldX + worldZ * worldZ);
  const normalizedX = moveLen > 0 ? worldX / moveLen : 0;
  const normalizedZ = moveLen > 0 ? worldZ / moveLen : 0;

  if (state.flying) {
    // Flying mode
    state.velocity.x = normalizedX * speed;
    state.velocity.z = normalizedZ * speed;
    state.velocity.y = 0;
    if (input.jump) state.velocity.y = speed;
    if (input.fly) state.velocity.y = -speed;
  } else {
    // Normal physics
    state.velocity.x = normalizedX * speed;
    state.velocity.z = normalizedZ * speed;

    // Gravity
    state.velocity.y += GRAVITY * dt;

    // Jump
    if (input.jump && state.onGround) {
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
  camera.rotation.order = 'YXZ';
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
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
