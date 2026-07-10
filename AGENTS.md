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
├── lib/minecraft/     # 核心游戏逻辑
│   ├── blocks.ts      # 方块类型定义 (18种)
│   ├── world.ts       # 程序化地形生成
│   ├── renderer.ts    # Three.js 网格/场景构建
│   └── player.ts      # 玩家物理与摄像机控制
├── components/
│   └── MinecraftGame.tsx  # 主游戏组件与HUD
├── pages/             # 路由页面 (Home, NotFound)
└── contexts/          # React 上下文 (Theme)
server/index.ts        # Express 服务器 (仅生产环境)
shared/const.ts        # 共享常量
```

## 关键架构决策
- 世界数据存储为 `Map<string, BlockType>` (键 = "x,y,z")
- 区块大小: 16, 世界高度: 64, 海平面: 32
- 地形使用基于种子的八度噪声生成
- 方块变更时完整重建网格 (替换整个 worldGroup)
- 使用指针锁定实现 FPS 控制，WASD + 鼠标视角

## 游戏控制
- WASD: 移动 | 鼠标: 视角 | 空格: 跳跃 | Shift: 冲刺
- 左键: 破坏方块 | 右键: 放置方块
- 1-9 / 滚轮: 选择快捷栏方块 | F: 切换飞行 | H: 帮助

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
- 目标方块高亮线框
- 快捷栏支持9种方块，等距方块图标
- 调试覆盖层 (FPS、坐标、目标方块)
- Minecraft 风格的开始界面

## 已知限制
- 无存档/读档功能
- 无多人游戏支持
- 任何方块变更都需完整重建网格
- 固定渲染距离 (半径=30 区块)
