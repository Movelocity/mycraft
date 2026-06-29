# 纹理 Atlas UV 镜像 Bug 排查记录

## 问题现象

Web Minecraft 项目中，方块纹理渲染出现大面积错乱：

| 方块 | 预期 | 实际 |
|------|------|------|
| Grass | 绿色草地 | Snow 的白色纹理 |
| Dirt / Stone | 棕色/灰色 | 全黑 |
| Glass | 半透明边框 | 正确 ✓ |
| Wood / Leaves | 木纹/树叶 | 默认黄色 |

## 根本原因

`renderer.ts` 中 `buildAtlas()` 构建纹理图集时，UV 坐标的计算方式与 Three.js 纹理的 `flipY` 默认行为冲突。

```typescript
// UV 计算（假设 v=0 对应 canvas 顶部）
const v0 = row / rows;
const v1 = (row + 1) / rows;

// 但 THREE.CanvasTexture 默认 flipY = true
// 导致 v=0 实际对应 canvas 底部，UV 发生垂直镜像
const tex = new THREE.CanvasTexture(atlasCanvas);
```

### 镜像规则

Atlas 共 7 行，`flipY = true` 使得读取 Row R 时实际命中 Row (6 - R)：

```
Row 0 (grass, dirt, stone)  ←→  Row 6 (snow + 空白)
Row 1 (cobblestone, sand)   ←→  Row 5 (diamond_ore, gravel)
Row 2 (wood, planks, leaves)←→  Row 4 (coal_ore, iron_ore)
Row 3 (glass, water)        ←→  Row 3 (自身，中间行不变)
```

### 症状逻辑链

1. **Grass → Snow**：grass 在 Row 0 col 0-2，镜像后读到 Row 6 col 0-2（snow）
2. **Dirt/Stone → 黑色**：dirt/stone 在 Row 0 col 3-7，镜像后读到 Row 6 col 3-7（atlas 空白区，canvas 未绘制区域默认为 `rgba(0,0,0,0)`）
3. **Glass → 正确**：glass 在 Row 3（中间行），镜像后仍是 Row 3
4. **Wood/Leaves → 黄色**：它们在 Row 1-2，镜像后读到 Row 4-5（排查时注释掉了那些 case，所以也是默认黄色）

## 修复

一行代码：

```typescript
const tex = new THREE.CanvasTexture(atlasCanvas);
tex.flipY = false;  // UV 已按 canvas 从上到下的顺序计算，无需翻转
```

## 排查经验总结

### 1. 症状矛盾时寻找「第三因素」

用户通过注释排除法发现 "grass=snow, dirt=black, wood=yellow" 看似不统一，说明问题不在纹理生成本身（否则所有未匹配的 case 应该一致表现为 default 黄色）。矛盾的症状暗示存在 **中间层映射错误**。

### 2. 抓住「一个正确、其他错误」的线索

Glass 正确是关键线索。如果是纹理代码本身的问题，很难解释为什么唯独 glass 幸存。结合 atlas 布局分析，glass 恰好在中间行 → 镜像不变 → 立刻指向 **垂直对称性问题**。

### 3. Three.js Texture Atlas 常见陷阱

| 陷阱 | 说明 |
|------|------|
| `flipY` 默认值 | `CanvasTexture` 和 `ImageTexture` 默认 `flipY = true`，手工计算 UV 时几乎总需要关闭 |
| Atlas 空白区域 | Canvas 未绘制区域为透明黑 `(0,0,0,0)`，在不透明材质上表现为纯黑 |
| HMR 缓存 | 模块级缓存的 Texture/Atlas 需要手动添加 `import.meta.hot.dispose()` 清理 |

### 4. 排查「镜像」类 bug 的快捷验证法

如果怀疑存在 UV 或纹理翻转问题，可在 atlas 第一个 tile (0,0) 绘制一个明显不对称的标记（如字母 "F"），然后观察它出现在哪个方块的哪个面上，即可快速确认是否存在翻转/镜像。
