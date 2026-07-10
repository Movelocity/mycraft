# 移动端全屏与手势交互设计文档

## 1. 概述

为 Web Minecraft Demo 添加移动端支持，包括全屏模式和触屏手势交互。

## 2. 设计决策（已确认）

| 决策项 | 方案 | 说明 |
|--------|------|------|
| 检测方式 | UA 检测 | 检测到移动设备时显示切换按钮，用户决定是否启用 |
| 全屏方案 | Fullscreen API | 锁定横屏方向，不考虑 iOS 兼容 |
| 移动摇杆 | 浮动摇杆 | 左半屏触摸任意位置出现，拖动控制方向 |
| 视角控制 | 右半屏滑动 | 右半屏滑动控制 yaw/pitch |
| 交互方式 | 触摸手势 | 轻触=放置，长按=破坏，滑动=视角 |

## 3. 触摸交互设计

### 3.1 屏幕分区

```
┌─────────────────────────────────────┐
│                          [暂停]    │
│                                     │
│  ┌─────────┐           ┌─────────┐ │
│  │  左半屏  │           │  右半屏  │ │
│  │ 浮动摇杆 │           │ 滑动视角 │ │
│  └─────────┘           └─────────┘ │
│                                     │
│ [快捷栏1][2][3][4][5][6][7][8][9]  │
│                                     │
│                         [跳跃]     │
└─────────────────────────────────────┘
```

### 3.2 触摸状态机

```
触摸开始
    │
    ├─ 左半屏 → 出现浮动摇杆 → 拖动控制移动
    │
    └─ 右半屏 → 等待判断
           │
           ├─ 滑动超过阈值 → 视角控制
           │
           ├─ 短按抬起 (< 300ms) → 放置/交互
           │
           └─ 长按 (> 300ms) → 破坏方块
```

### 3.3 飞行模式切换

- **双击跳跃按钮**：切换飞行模式（间隔 < 400ms）
- **飞行模式下**：跳跃按钮变为三个按钮
  - 上方：上升
  - 中间：退出飞行（双击）
  - 下方：下降

### 3.4 按钮状态

| 模式 | 右下角按钮 |
|------|-----------|
| 普通模式 | [跳跃] |
| 飞行模式 | [上升] [退出飞行] [下降] |

---

## 4. 技术方案

### 4.1 移动端检测

```typescript
// utils/mobile.ts
export function isMobileUA(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
    .test(navigator.userAgent);
}
```

### 4.2 全屏 + 方向锁定

```typescript
export async function enterFullscreen(): Promise<void> {
  await document.documentElement.requestFullscreen();
  // 锁定横屏
  if (screen.orientation?.lock) {
    await screen.orientation.lock('landscape');
  }
}
```

### 4.3 浮动摇杆

```typescript
interface FloatingJoystickProps {
  onMove: (dx: number, dy: number) => void;
  onRelease: () => void;
}

// 触摸左半屏时在触摸点显示摇杆
// 拖动控制方向，松开后摇杆消失
// 输出归一化向量 (-1 ~ 1)
```

### 4.4 触摸手势识别

```typescript
// 区分轻触、长按、滑动
const TAP_THRESHOLD = 300;      // ms
const LONG_PRESS_THRESHOLD = 300; // ms
const MOVE_THRESHOLD = 10;       // px

function classifyTouch(touch: TouchState): 'tap' | 'longpress' | 'swipe' {
  const duration = touch.endTime - touch.startTime;
  const distance = Math.hypot(touch.endX - touch.startX, touch.endY - touch.startY);
  
  if (distance > MOVE_THRESHOLD) return 'swipe';
  if (duration > LONG_PRESS_THRESHOLD) return 'longpress';
  return 'tap';
}
```

---

## 5. 文件结构

```
client/src/
├── utils/
│   └── mobile.ts              # UA 检测 + 全屏 API
├── hooks/
│   └── useMobileControls.ts   # 移动端控制逻辑
├── components/
│   └── mobile/
│       ├── MobileControls.tsx  # 移动端控制容器
│       ├── FloatingJoystick.tsx # 浮动摇杆
│       ├── JumpButton.tsx      # 跳跃/飞行按钮
│       └── MobileHotbar.tsx    # 移动端快捷栏
```

---

## 6. TODO List

### 阶段一：基础检测与全屏
- [ ] **8.1** 创建移动端检测工具
  - [ ] 8.1.1 实现 `isMobileUA()` UA 检测
  - [ ] 8.1.2 实现 `enterFullscreen()` + 方向锁定
- [ ] **8.2** 开始界面集成
  - [ ] 8.2.1 检测到移动 UA 时显示"移动端模式"按钮
  - [ ] 8.2.2 点击后进入全屏 + 启用触屏控制

### 阶段二：浮动摇杆
- [ ] **8.3** 实现浮动摇杆组件
  - [ ] 8.3.1 左半屏触摸时在触摸点显示摇杆
  - [ ] 8.3.2 拖动控制移动方向
  - [ ] 8.3.3 松开后摇杆消失
- [ ] **8.4** 接入游戏移动系统
  - [ ] 8.4.1 摇杆输出转换为 InputState
  - [ ] 8.4.2 支持 8 方向移动

### 阶段三：视角控制
- [ ] **8.5** 右半屏视角滑动
  - [ ] 8.5.1 检测右半屏触摸
  - [ ] 8.5.2 滑动转换为 yaw/pitch
  - [ ] 8.5.3 灵敏度设置

### 阶段四：跳跃与飞行按钮
- [ ] **8.6** 实现跳跃按钮
  - [ ] 8.6.1 右下角显示跳跃按钮
  - [ ] 8.6.2 点击触发跳跃
- [ ] **8.7** 飞行模式切换
  - [ ] 8.7.1 双击跳跃按钮切换飞行
  - [ ] 8.7.2 飞行模式下显示三按钮（上升/退出/下降）

### 阶段五：触摸交互
- [ ] **8.8** 触摸手势识别
  - [ ] 8.8.1 区分轻触、长按、滑动
  - [ ] 8.8.2 轻触 → 放置/交互方块
  - [ ] 8.8.3 长按 → 破坏方块
- [ ] **8.9** 快捷栏
  - [ ] 8.9.1 底部显示可点击快捷栏
  - [ ] 8.9.2 点击切换选中方块

### 阶段六：集成与优化
- [ ] **8.10** MinecraftGame 集成
  - [ ] 8.10.1 移动端模式下加载 MobileControls
  - [ ] 8.10.2 隐藏 PC 端元素
- [ ] **8.11** 体验优化
  - [ ] 8.11.1 按钮视觉反馈
  - [ ] 8.11.2 防误触处理
  - [ ] 8.11.3 横屏锁定

---

## 7. 难度评估

| 模块 | 难度 | 说明 |
|------|------|------|
| UA 检测 + 全屏 | 低 | 标准 API |
| 浮动摇杆 | 中 | 触摸事件处理 |
| 视角滑动 | 中 | 与摇杆分区 |
| 跳跃/飞行按钮 | 中 | 双击检测 + 状态切换 |
| 触摸手势识别 | 中高 | 轻触/长按/滑动区分 |
| 集成调试 | 中 | 多设备测试 |

**整体难度：中等偏上**，主要挑战在触摸状态机的准确性。
