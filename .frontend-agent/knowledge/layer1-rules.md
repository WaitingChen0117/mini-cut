# Layer 1 编码规范 — Demo2 视频编辑器

## 颜色规范

所有背景色必须使用 CSS 变量，禁止硬编码蓝色调（#0a0e18, #1a2235, #1e2a3a 等）：

| 场景 | 变量 | 值 |
|------|------|----|
| App 背景 / divider | `--bg-primary` | `#000000` |
| 模块主体背景 | `--module-bg` | `#1c1c1c` |
| 模块头部 / toolbar | `--module-header-bg` | `#141414` |
| 边框 / 分割线 | `--border` | `#2a2a2a` |
| hover 态 | `--bg-hover` | `#252525` |
| 强调色 | `--accent` | `#e94560` |

来源：[[FE-STYLE-001]]

---

## 60fps 动画禁止走 React state

播放时间、进度条等需要每帧更新的 UI，必须用 ref 直接操作 DOM，不走 setState：

```tsx
// ✅ 正确
timeRef.current.textContent = formatTC(t)
progressRef.current.style.width = `${pct * 100}%`

// ❌ 错误
setCurrentTimeDisplay(formatTC(t))
```

来源：[[FE-PERF-003]]

---

## 全屏覆盖层居中

`:fullscreen` 上下文中禁止用 `left: 50% + transform`，必须用：

```css
left: 0; right: 0; margin: 0 auto; width: <目标宽度>;
```

来源：[[FE-RENDER-006]]

---

## 数组原地 splice 时倒序遍历

对数组做 splice 插入/删除时，必须从末尾向前遍历，避免索引错位：

```ts
for (let i = arr.length - 1; i >= 0; i--) {
  if (shouldSplit(arr[i])) arr.splice(i, 1, left, right)
}
```

来源：[[FE-STATE-003]]

---

## 面板分割线不加 hover 样式

App 内各模块间的拖拽 divider 不加 `:hover` 颜色变化，保持黑色背景。模块边界通过各自的 `border-radius` 区分。

来源：[[FE-INTERACT-003]]
