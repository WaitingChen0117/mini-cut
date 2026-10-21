# FE-RENDER-004: canvas.width 赋值会清空画布，标尺内容消失

- **分类**: RENDER
- **问题现象**: 时间轴标尺上的刻度线和时间标签消失，只剩空白背景。原因是两个 useEffect 都依赖同一个变量 `contentWidth`：第一个先绘制标尺，第二个设置 `canvas.width = contentWidth`——设置宽度会自动清空 canvas 内容，导致刚画完就被擦掉。
- **根本原因**: 浏览器规范：对 `HTMLCanvasElement.width` 赋值（即使值相同）会立即清空整个画布。React `useEffect` 同依赖的执行顺序：按声明顺序依次执行，第二个 effect 清空了第一个 effect 的绘制结果。
- **修复方式**: 将"设置尺寸"和"绘制内容"合并到同一个 `useEffect` 中，先设置 `canvas.width/height`，再执行绘制逻辑，两步之间不能被其他 effect 打断。
- **关键代码**:
  ```ts
  useEffect(() => {
    canvas.width = contentWidth   // 1. 先设置尺寸（会清空）
    canvas.height = 24
    // 2. 立即绘制
    ctx.fillRect(...)
    for (...) { ctx.strokeLine(...) }
  }, [contentWidth])
  ```
- **推广规则**: 凡是 canvas 绘制逻辑，必须在同一个 effect 内先 resize 再 draw；永远不要把 resize 和 draw 分成两个 effect。
- **确认次数**: 1
- **应用记录**: Timeline/index.tsx
- **创建时间**: 2026-05-19T09:00:00Z
- **最后引用**: 2026-05-19T09:00:00Z
