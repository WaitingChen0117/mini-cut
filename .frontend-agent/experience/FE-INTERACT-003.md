# FE-INTERACT-003: 面板分割线 hover 不变色，用圆角区分模块边界

- **分类**: INTERACT
- **问题现象**: 分割线加 hover 高亮后用户觉得视觉噪音过多
- **修复方式**: divider 不加 :hover 样式，保持 `background: var(--bg-primary)` 黑色不变；各模块自身加 border-radius 区分边界（左侧 `0 8px 8px 0`，中间 `8px`，右侧 `8px 0 0 8px`，时间轴 `8px 8px 0 0`）
- **确认次数**: 1
- **应用记录**: App.module.css divider 样式
- **创建时间**: 2026-05-25T00:00:00Z
- **最后引用**: 2026-05-25T00:00:00Z
