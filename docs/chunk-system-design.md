# 区块生成系统设计文档

## 1. 概述

将当前的一次性世界生成改为基于区块的按需生成系统，提升性能和可扩展性。

## 2. 当前系统分析

### 现有架构
```
世界数据: Map<string, BlockType>  (所有方块存于一个 Map)
生成方式: generateWorld(seed, radius) 一次性生成整个区域
网格更新: 每次方块变更都完整重建 worldGroup
```

### 存在的问题
| 问题 | 影响 |
|------|------|
| 一次性生成 | 启动慢，radius=30 时生成 ~3600 列 |
| 全局 Map | 无法按区域管理，内存连续增长 |
| 全量重建网格 | 任何方块变更都重建所有几何体 |
| 固定渲染距离 | 无法动态调整 |
| 树木用 Math.random() | 不确定性，与种子无关 |

---

## 3. 核心概念

### 区块 (Chunk)
- 水平尺寸: 16×16 (已有 `CHUNK_SIZE = 16`)
- 垂直: 贯穿整个世界高度 (0 ~ WORLD_HEIGHT)
- 坐标: `(chunkX, chunkZ)` 表示一个区块

### 区块坐标转换
```typescript
// 世界坐标 → 区块坐标
chunkX = Math.floor(worldX / CHUNK_SIZE)
chunkZ = Math.floor(worldZ / CHUNK_SIZE)

// 区块内本地坐标
localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
```

---

## 4. 关键决策点

### 决策 1：区块存储结构

| 方案 | 结构 | 优点 | 缺点 |
|------|------|------|------|
| **A. 分层 Map** | `Map<chunkKey, Map<blockKey, BlockType>>` | 简单，与现有代码兼容 | 两层 Map 查找开销 |
| B. 扁平 Map + 索引 | 一个大 Map + 区块索引 Map | 查找快 | 结构复杂 |
| C. 三维数组 | `BlockType[16][64][16]` per chunk | 内存紧凑，访问快 | 空区块也占内存 |

**已确认：方案 A（分层 Map）**

### 决策 2：生成距离 vs 渲染距离

| 参数 | 值 | 说明 |
|------|------|------|
| 生成距离 | 4 个区块 | 预生成玩家周围区块 |
| 渲染距离 | 3 个区块 | 实际渲染的区块范围 |
| 卸载距离 | 6 个区块 | 超出此距离的区块被卸载 |

**已确认：按建议值设计**

### 决策 3：区块加载策略

| 方案 | 说明 | 优点 | 缺点 |
|------|------|------|------|
| A. 同步加载 | 主线程生成区块 | 简单 | 阻塞渲染 |
| **B. 分帧加载** | 每帧最多生成 1 个区块 | 不卡顿 | 加载慢 |
| C. Web Worker | 后台线程生成 | 不阻塞 | 复杂 |

**已确认：方案 B（分帧加载）**

### 决策 4：网格更新策略

| 方案 | 说明 | 优点 | 缺点 |
|------|------|------|------|
| A. 全局重建 | 当前方案 | 简单 | 性能差 |
| **B. 区块级重建** | 只重建变更区块的网格 | 快速 | 需要区块边界处理 |
| C. 增量更新 | 只更新变更的面 | 最快 | 复杂 |

**已确认：方案 B（区块级重建）**

### 决策 5：与存档系统的集成

| 方案 | 说明 | 优点 | 缺点 |
|------|------|------|------|
| A. 保存所有区块 | 序列化所有已加载区块 | 完整 | 数据量大 |
| **B. 只保存变更** | 当前方案，种子 + diff | 数据小 | 需要重新生成 |
| C. 混合方案 | 保存变更 + 缓存已生成区块 | 平衡 | 复杂 |

**已确认：方案 B（只保存变更）**

### 决策 6：树木生成确定性

| 方案 | 说明 |
|------|------|
| A. 保持随机 | 当前方案，每次生成不同 |
| **B. 基于种子** | 使用 hash(x, z, seed) 决定是否生成树 |

**已确认：方案 B（基于种子）**

---

## 5. 数据结构设计

```typescript
// 区块数据
interface Chunk {
  x: number;           // 区块坐标 X
  z: number;           // 区块坐标 Z
  blocks: Map<string, BlockType>;  // 本地坐标 → 方块类型
  mesh?: THREE.Group;  // 区块的渲染网格
  dirty: boolean;      // 是否需要重建网格
}

// 区块管理器
class ChunkManager {
  chunks: Map<string, Chunk>;      // chunkKey → Chunk
  seed: number;
  renderDistance: number;           // 渲染距离（区块数）
  generateDistance: number;         // 生成距离
  unloadDistance: number;           // 卸载距离
  
  // 核心方法
  getBlock(x: number, y: number, z: number): BlockType;
  setBlock(x: number, y: number, z: number, type: BlockType): void;
  update(playerPos: THREE.Vector3): void;  // 每帧调用
  
  // 区块操作
  getChunk(chunkX: number, chunkZ: number): Chunk;
  generateChunk(chunkX: number, chunkZ: number): Chunk;
  unloadChunk(chunkX: number, chunkZ: number): void;
  rebuildChunkMesh(chunk: Chunk): void;
}
```

---

## 6. TODO List

### 阶段一：基础区块系统
- [x] **6.1** 创建 `lib/minecraft/chunk.ts` 区块管理器
  - [x] 6.1.1 区块坐标转换函数 (`worldToChunk`, `chunkToWorld`)
  - [x] 6.1.2 区块存储结构 `Map<chunkKey, Map<blockKey, BlockType>>`
  - [x] 6.1.3 `getBlock` / `setBlock` 接口实现
- [x] **6.2** 区块生成函数
  - [x] 6.2.1 将 `generateWorld` 逻辑改为 `generateChunk(chunkX, chunkZ, seed)`
  - [x] 6.2.2 修复树木确定性（`shouldPlaceTree` 改用 hash）

### 阶段二：按需加载
- [x] **6.3** 区块加载调度
  - [x] 6.3.1 计算玩家所在区块坐标
  - [x] 6.3.2 确定需要加载的区块列表（生成距离=4）
  - [x] 6.3.3 按距离排序，优先加载近的
  - [x] 6.3.4 分帧加载（每帧最多 1 个区块）

### 阶段三：网格优化
- [x] **6.4** 区块级网格重建
  - [x] 6.4.1 每个区块独立 Mesh 对象
  - [x] 6.4.2 方块变更时只重建所属区块 Mesh
  - [x] 6.4.3 边界区块面剔除（检查相邻区块）

### 阶段四：区块卸载
- [x] **6.5** 区块卸载
  - [x] 6.5.1 检测超出卸载距离（=6）的区块
  - [x] 6.5.2 清理区块数据和 Mesh
  - [x] 6.5.3 保留有玩家变更的区块（有 diff）

### 阶段五：集成与优化
- [x] **6.6** 与存档系统集成
  - [x] 6.6.1 存档时保存变更列表（已有）
  - [x] 6.6.2 读档时将变更应用到生成的区块
- [x] **6.7** MinecraftGame 集成
  - [x] 6.7.1 替换 `generateWorld` 为 ChunkManager
  - [x] 6.7.2 更新 `rebuildWorld` 为区块级重建
  - [x] 6.7.3 游戏循环中调用 `chunkManager.update(playerPos)`
- [x] **6.8** 性能优化
  - [x] 6.8.1 区块生成帧率控制
  - [x] 6.8.2 内存使用监控

---

## 7. 风险与注意事项

- **边界处理**：区块边界方块的面剔除需要检查相邻区块
- **并发生成**：分帧加载时避免同时生成多个区块
- **存档兼容**：需要迁移现有存档格式
- **内存管理**：及时卸载不再需要的区块
