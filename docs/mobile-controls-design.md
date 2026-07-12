# 移动端全屏与手势交互设计文档

## 1. 概述

为 Web Minecraft Demo 添加移动端支持，包括全屏模式和触屏手势交互。

## 2. 设计决策（已确认）

| 决策项 | 方案 | 说明 |
|--------|------|------|
| 检测方式 | UA 检测 | 检测到移动设备时显示切换按钮，用户决定是否启用 |
| 全屏方案 | Fullscreen API + 强制横屏 | 进入全屏时**自动切换到 landscape**，禁止以 portrait 半屏渲染；不考虑 iOS 兼容 |
| 移动摇杆 | 浮动摇杆 | 左半屏触摸任意位置出现，拖动控制方向 |
| 视角控制 | 右半屏滑动 | 右半屏滑动控制 yaw/pitch |
| 交互方式 | 触摸手势 | 轻触=放置，长按命中方块时破坏，滑动=视角 |

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
│                      ┌──┐          │
│                      │跳│ ← 距右边界留空隙 │
│                      └──┘          │
└─────────────────────────────────────┘
```

跳跃按钮位于右下角，与右侧渲染边界保持一定内边距（建议 16–24px），避免贴边导致误触或难以点击。

### 3.2 触摸状态机

```
触摸开始
    │
    ├─ 左半屏 → 出现浮动摇杆 → 拖动控制移动
    │
    └─ 右半屏 → 启动破坏循环
           │
           ├─ 短按抬起 (< 300ms) → 放置/交互
           │
           └─ 长按 → 三态破坏状态机
                 │
                 ├─ idle: 准星未命中可破坏方块
                 │
                 ├─ arming: 准星命中可破坏方块，开始累计 ARMING_MS (300ms)
                 │    若中途离开可破坏方块，回到 idle
                 │    若中途换到另一个可破坏方块，重新累计 ARMING_MS
                 │
                 └─ breaking: 累计满 ARMING_MS 后进入，开始破坏
                      准星移到新的可破坏方块 → 立即开始破坏新方块（连续破坏）
                      准星离开所有可破坏方块 → 起 RESET_MS (350ms) 计时
                          期间回到任意可破坏方块 → 继续连续破坏
                          计时结束仍无目标 → 回到 idle（必须重新武装）
```

破坏状态机专门用于解决「普通移动视角时误破坏沿途方块」的问题：扫视视角时准星在每个方块上的停留时间通常 < 300ms，因此不会触发武装；只有刻意停留才进入 breaking。

### 3.3 飞行模式切换

- **双击跳跃按钮**：进入飞行模式（间隔 < 400ms）
- **飞行模式下**：跳跃按钮变为两个按钮
  - 上方：上升
  - 下方：下降
- **退出飞行**：飞行时按住下降并落到方块上，自动退出飞行模式；单纯落地不退出

### 3.4 跳跃按钮视觉规范

| 属性 | 规范 |
|------|------|
| 形状 | 正方形（等边，非圆形） |
| 透明度 | 半透明（如 `rgba(255,255,255,0.25)` 背景 + 细边框） |
| 位置 | 右下角，距右边界与底边界均留空隙（见 3.1） |
| 尺寸 | 建议 48–56px 边长，满足触屏最小点击区域 |

按下时短暂提高不透明度作为视觉反馈；飞行模式下的上升/下降按钮沿用同一正方形样式。

### 3.5 按钮状态

| 模式 | 右下角按钮 |
|------|-----------|
| 普通模式 | [跳跃] |
| 飞行模式 | [上升] [下降] |

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

### 4.2 全屏 + 强制横屏

进入全屏后必须处于 **landscape** 方向，游戏画面占满横屏视口。若保持 portrait 打开，Canvas 往往只渲染在屏幕一侧（半屏），体验不可接受。

实现顺序：
1. 请求全屏
2. 调用 `screen.orientation.lock('landscape')` 锁定横屏
3. 若方向 API 不可用，提示用户手动旋转设备至横屏后再继续

```typescript
export async function enterFullscreen(): Promise<void> {
  await document.documentElement.requestFullscreen();
  if (screen.orientation?.lock) {
    await screen.orientation.lock('landscape');
  }
  // 可选：监听 orientationchange，portrait 时显示「请旋转至横屏」遮罩
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
│       └── JumpButton.tsx      # 跳跃/飞行按钮
```

> **注意**：存档界面（Home.tsx 中的存档槽位选择）移动端和桌面端共用一套 UI，
> 通过响应式样式适配不同屏幕，不单独拆分移动端存档组件。

---

## 6. TODO List

### 阶段一：基础检测与全屏
- [x] **8.1** 创建移动端检测工具
  - [x] 8.1.1 实现 `isMobileUA()` UA 检测
  - [x] 8.1.2 实现 `enterFullscreen()` + 方向锁定
- [x] **8.2** 开始界面集成
  - [x] 8.2.1 检测到移动 UA 时显示"移动端模式"按钮
  - [x] 8.2.2 点击后进入全屏 + 启用触屏控制

### 阶段二：浮动摇杆
- [x] **8.3** 实现浮动摇杆组件
  - [x] 8.3.1 左半屏触摸时在触摸点显示摇杆
  - [x] 8.3.2 拖动控制移动方向
  - [x] 8.3.3 松开后摇杆消失
- [x] **8.4** 接入游戏移动系统
  - [x] 8.4.1 摇杆输出转换为 InputState
  - [x] 8.4.2 支持 8 方向移动

### 阶段三：视角控制
- [x] **8.5** 右半屏视角滑动
  - [x] 8.5.1 检测右半屏触摸
  - [x] 8.5.2 滑动转换为 yaw/pitch
  - [x] 8.5.3 灵敏度设置

### 阶段四：跳跃与飞行按钮
- [x] **8.6** 实现跳跃按钮
  - [x] 8.6.1 右下角显示半透明正方形跳跃按钮，距右/底边界留空隙
  - [x] 8.6.2 点击触发跳跃
- [x] **8.7** 飞行模式切换
  - [x] 8.7.1 双击跳跃按钮进入飞行
  - [x] 8.7.2 飞行模式下显示两按钮（上升/下降）
  - [x] 8.7.3 按住下降并落到方块时自动退出飞行

### 阶段五：触摸交互
- [x] **8.8** 触摸手势识别
  - [x] 8.8.1 区分轻触、长按、滑动
  - [x] 8.8.2 轻触 → 放置/交互方块
  - [x] 8.8.3 长按 → 破坏方块
- [x] **8.9** 快捷栏
  - [x] 8.9.1 底部显示可点击快捷栏
  - [x] 8.9.2 点击切换选中方块

### 阶段六：集成与优化
- [x] **8.10** MinecraftGame 集成
  - [x] 8.10.1 移动端模式下加载 MobileControls
  - [x] 8.10.2 隐藏 PC 端元素（指针锁定提示等）
  - [x] 8.10.3 存档 UI 统一：Home.tsx 存档界面共用一套，响应式适配移动端
- [x] **8.11** 体验优化
  - [x] 8.11.1 按钮视觉反馈
  - [x] 8.11.2 防误触处理（破坏方块需要 ARMING_MS 武装 + RESET_MS 离开重置，详见 §3.2）
  - [x] 8.11.3 全屏后强制 landscape，portrait 时提示旋转
  - [x] 8.11.4 跳跃按钮半透明正方形样式与触屏边距

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
