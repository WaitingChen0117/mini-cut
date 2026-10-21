# FE-RENDER-001: Timeline组件禁止在事件处理器内调用Hook

- **分类**: RENDER
- **问题现象**: handleDrop内调用useEditorStoreExternal导致react-hooks/rules-of-hooks报错
- **修复方式**: 将addTrackItem直接从组件顶层useEditorStore解构，删除辅助hook函数
- **确认次数**: 1
- **应用记录**: （空）
- **创建时间**: 2026-05-19T06:24:10Z
- **最后引用**: 2026-05-19T06:24:10Z
