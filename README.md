# MyCraft

基于浏览器的 Minecraft 风格沙盒游戏，使用 React + Three.js 构建。支持程序化地形、方块挖掘与放置、本地存档，以及 PWA 安装。

## 功能

- 基于种子的程序化世界生成（树木、水流、沙滩、矿石）
- 16×64×16 区块按需加载，无限地图
- FPS 视角控制，支持行走与飞行模式
- IndexedDB 存档（3 槽位，种子 + 增量变更）
- 移动端触屏控制（虚拟摇杆、横屏全屏）
- PWA 支持（可安装到桌面 / 主屏幕，离线缓存与更新）

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 · Three.js · Tailwind CSS 4 · wouter |
| 后端 | Express（生产环境静态文件服务） |
| 构建 | Vite 7 · esbuild · TypeScript 5.6 |
| 包管理 | pnpm |

## 快速开始

```bash
pnpm install
pnpm dev      # 开发服务器 http://localhost:3011
pnpm build    # 生产构建
pnpm start    # 启动生产服务器
pnpm check    # TypeScript 类型检查
```

## 操作说明

### 桌面端

| 按键 | 功能 |
|------|------|
| WASD | 移动 |
| 鼠标 | 视角 |
| 空格 | 跳跃 / 飞行时上升 |
| Shift | 半蹲 / 飞行时下降 |
| Ctrl | 冲刺 |
| F | 切换飞行 |
| 左键 / 右键 | 破坏 / 放置方块 |
| 1–9 / 滚轮 | 选择快捷栏方块 |
| F5 | 快速保存 |
| ESC | 暂停菜单 |
| H | 帮助 |

### 移动端

左半屏虚拟摇杆移动，右半屏滑动视角；轻触放置、长按破坏；双击跳跃按钮进入飞行。

## 项目结构

```
client/src/
├── lib/minecraft/     # 游戏核心（区块、地形、渲染、玩家、存档）
├── components/        # React 组件（MinecraftGame 等）
└── pages/             # 路由页面
server/index.ts        # Express 生产服务器
docs/                  # 设计文档
```

## 许可证

MIT
