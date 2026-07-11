# AGENTS.md — Web Minecraft Demo

## 项目概述
基于浏览器的 Minecraft 克隆游戏，使用 React + Three.js 构建。玩家可以挖掘、放置方块，并探索程序化生成的地形。

## 技术栈
- **前端**: React 19, Three.js, Tailwind CSS 4, wouter (路由)
- **后端**: Express (仅静态文件服务)
- **构建**: Vite 7, esbuild, TypeScript 5.6
- **包管理**: pnpm

## 项目结构
```
client/src/
├── lib/minecraft/        # 核心游戏逻辑
│   ├── blocks.ts         # 方块类型定义 (18种)
│   ├── chunk.ts          # 区块管理器 (ChunkManager)，按需加载/卸载
│   ├── world.ts          # 程序化地形生成 (种子噪声)
│   ├── renderer.ts       # Three.js 网格/场景/天空盒构建
│   ├── player.ts         # 玩家物理与摄像机控制
│   ├── save.ts           # IndexedDB 存档系统 (3 槽位)
│   └── textures.ts       # 方块纹理图集
├── components/
│   └── MinecraftGame.tsx  # 主游戏组件与HUD
├── pages/                # 路由页面 (Home, NotFound)
└── contexts/             # React 上下文 (Theme)
server/index.ts           # Express 服务器 (仅生产环境)
shared/const.ts           # 共享常量
docs/                     # 设计文档
```

## 关键架构决策
- 世界按 16×64×16 区块管理，`ChunkManager` 根据玩家位置按需生成/卸载
- 地形使用基于种子的八度噪声生成，相同种子 → 相同地形
- 方块变更标记区块为 dirty，仅重建脏区块网格
- 使用指针锁定实现 FPS 控制，WASD + 鼠标视角
- 存档使用 IndexedDB，保存种子 + 增量方块变更（非全量世界）
- 存档 UI 移动端和桌面端共用一套，响应式适配不同屏幕

## 游戏控制（桌面端）
- WASD: 移动 | 鼠标: 视角 | 空格: 跳跃 | Shift: 冲刺
- 左键: 破坏方块 | 右键: 放置方块
- 1-9 / 滚轮: 选择快捷栏方块 | F: 切换飞行 | H: 帮助
- F5: 快速保存 | ESC: 暂停菜单

## 游戏控制（移动端，计划中）
- 左半屏: 浮动摇杆移动 | 右半屏: 滑动视角
- 轻触: 放置方块 | 长按: 破坏方块
- 双击跳跃按钮: 切换飞行 | 飞行时显示上升/下降按钮
- UA 检测 → 全屏 + 横屏锁定 (Fullscreen API，不考虑 iOS)
- 详见 `docs/mobile-controls-design.md`

## 常用命令
```bash
pnpm dev        # 启动开发服务器 (端口 3000)
pnpm build      # 生产环境构建
pnpm check      # TypeScript 类型检查
pnpm format     # Prettier 格式化
```

## 编码规范
- 使用 `@/` 路径别名导入 client/src
- 方块颜色使用十六进制整数 (如 `0x8B5E3C`)
- 除非解释非显而易见的逻辑，否则不写注释
- 游戏逻辑放在 `lib/minecraft/`，UI 放在 `components/`

## 当前功能
- 程序化世界生成，包含矿石 (煤矿、铁矿、金矿、钻石)
- 基于地形高度的树木、水流、沙滩
- 区块按需加载，支持无限地图
- 目标方块高亮线框
- 快捷栏支持9种方块，等距方块图标
- 调试覆盖层 (FPS、坐标、目标方块、区块数)
- Minecraft 风格的开始界面
- IndexedDB 存档/读档 (3 槽位，种子+增量变更)
- 自动存档 (方块变更后 30 秒去抖) + F5 快速保存
- 暂停菜单 (继续游戏 / 保存并退出)

## 已知限制
- 无多人游戏支持
- 无移动端触屏控制 (设计已完成，待实现)
- 无数据压缩 (存档为纯 JSON)
