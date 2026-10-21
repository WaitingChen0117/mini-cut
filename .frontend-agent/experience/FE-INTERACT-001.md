# FE-INTERACT-001: 时间轴吸附（Snap）功能实现

- **分类**: INTERACT
- **需求**: 拖拽片段时，自动吸附到其他片段的起点/终点，方便片段首尾精确衔接。
- **实现方式**:
  1. 定义吸附阈值：`SNAP_PX = 8`（像素），换算为时间 `SNAP_S = SNAP_PX / PX_PER_SEC`
  2. `getSnapPoints(excludeId)`: 收集所有片段（视频+文字）的 `startTime` 和 `endTime`，以及时间轴原点 0，排除被拖拽的片段自身
  3. `snapTo(t, points)`: 遍历所有 snap 点，返回距离最近且 < SNAP_S 的点，否则返回原值
  4. 移动片段时：分别检测起点和终点两端，起点优先，哪端先进入阈值就吸附哪端
  5. 缩放左端/右端时：只检测被拖拽的那一端
- **关键代码**:
  ```ts
  // 移动时（检测两端）
  const snappedStart = snapTo(newStart, pts)
  const snappedEnd = snapTo(newStart + dur, pts)
  if (snappedStart !== newStart) newStart = snappedStart
  else if (snappedEnd !== newStart + dur) newStart = snappedEnd - dur
  ```
- **注意**: 吸附逻辑在 clamp 之后执行，防止吸附到合法范围外的点。文字片段和视频片段都是彼此的 snap 点来源。
- **确认次数**: 1
- **应用记录**: Timeline/index.tsx
- **创建时间**: 2026-05-19T09:00:00Z
- **最后引用**: 2026-05-19T09:00:00Z
