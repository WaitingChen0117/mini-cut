# FE-RENDER-005: 文字条目添加后无法选中编辑、拖拽、实时预览

- **分类**: RENDER
- **问题现象**: 三个关联问题：①文字添加后再也无法点击选中进行二次编辑；②右侧属性面板编辑内容后，canvas 预览区不更新，必须拖动或播放才刷新；③时间轴文字条目无法拖拽移动或调整时长。
- **根本原因**:
  1. 文字是用 `ctx.fillText` 画在 canvas 上的，不是 DOM 元素，无法点击选中。没有提供任何文字选中入口。
  2. canvas 只在播放（RAF）或 seek（`seeked` 事件）时重绘，store 里 textItems 变化不触发重绘。
  3. 时间轴文字色块只绑定了 `setSelectedTextId`，没有 drag state 注册，`handlePointerMove` 收不到文字拖拽事件。
- **修复方式**:
  1. 在时间轴新增"文字"轨道行，文字片段渲染为色块，单击调用 `setSelectedTextId` 选中，右侧属性面板随即展示编辑控件；双击删除改为只用属性面板删除按钮（防误触）。
  2. PreviewPanel 新增 `useEffect(() => { drawToCanvas() }, [textItems, drawToCanvas])`，textItems 变化时立即重绘。
  3. DragState 新增 `text-move` / `text-resize-left` / `text-resize-right` 类型；`handlePointerDown` 对文字条目设置 dragRef；`handlePointerMove` 对三种类型调用 `updateTextItem`。
- **注意**: 双击文字色块不要绑定删除，太容易误触；删除操作应限于属性面板的显式按钮。
- **确认次数**: 1
- **应用记录**: Timeline/index.tsx, PreviewPanel/index.tsx
- **创建时间**: 2026-05-19T09:00:00Z
- **最后引用**: 2026-05-19T09:00:00Z
