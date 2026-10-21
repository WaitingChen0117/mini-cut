# FE-RENDER-006: 全屏覆盖层水平居中禁用 left:50%+transform，改用 left:0;right:0;margin:0 auto

- **分类**: RENDER
- **问题现象**: 全屏模式下 `left: 50%; transform: translateX(-50%)` 导致覆盖层偏向右侧，无法真正居中
- **修复方式**: 改为 `left: 0; right: 0; margin: 0 auto; width: 55%`，在 :fullscreen 上下文中稳定居中
- **确认次数**: 1
- **应用记录**: PreviewPanel 全屏覆盖层 (.preview__fs_overlay)
- **创建时间**: 2026-05-25T00:00:00Z
- **最后引用**: 2026-05-25T00:00:00Z
