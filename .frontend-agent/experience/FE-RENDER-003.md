# FE-RENDER-003: PC端时间轴交互：移动播放头定位，非移动端平移轨道

- **分类**: RENDER
- **问题现象**: 误将移动端剪映的交互模型（固定基准线 + 拖拽轨道平移）套用到 PC 端，导致：①时间轴整体消失（所有子元素 position:absolute，父元素高度塌陷为0）；②拖动播放头不更新视频画面；③scrub 时画面闪烁
- **正确交互模型（PC端）**:
  - 时间轴静止，有一根可拖动的红色播放头（竖线）
  - 拖动播放头 → setCurrentTime → 视频跳帧到对应位置
  - 点击标尺任意位置 → setCurrentTime → 播放头跳到该位置
  - 时间轴可横向滚动（内容超出时），但滚动的是内容，不是靠平移来定位时间
- **修复方式**:
  1. 时间轴父容器加 `height: 100%`，防止高度塌陷
  2. DragState 新增 `playhead` 类型；`handlePointerMove` 最开始先检查 `d.type === 'playhead'` 再 return（必须在 `tracks.find()` 前，否则找不到 track 就 return，播放头拖拽失效）
  3. 播放头 CSS 改 `pointer-events: all`，加 `cursor: ew-resize`，宽度 14px（扩大热区）
  4. 视频同步由 PreviewPanel/frameLoop 负责：非播放状态下 RAF 每帧对比 video.currentTime 与 store currentTime，偏差 >0.001s 时发起精确 seek
- **关键坑**: `handlePointerMove` 中 playhead 分支必须在 `const track = tracks.find(...)` 之前处理，否则 itemId 为空字符串，find 返回 undefined，提前 return，播放头无法拖动
- **确认次数**: 1
- **应用记录**: Timeline/index.tsx, Timeline.module.css
- **创建时间**: 2026-05-19T08:30:00Z
- **最后引用**: 2026-05-19T08:30:00Z
