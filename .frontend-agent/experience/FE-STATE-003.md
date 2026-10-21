# FE-STATE-003: splitAtTime 倒序遍历数组再 splice，避免索引错位

- **分类**: STATE
- **问题现象**: 正序遍历时 splice 插入新元素后，后续索引偏移，导致部分片段未被切割或重复切割
- **修复方式**: `for (let i = arr.length - 1; i >= 0; i--)` 倒序遍历，splice 只影响已处理的高索引，不影响待处理的低索引
- **确认次数**: 1
- **应用记录**: editorStore.splitAtTime（同时处理 tracks 和 textItems）
- **创建时间**: 2026-05-25T00:00:00Z
- **最后引用**: 2026-05-25T00:00:00Z
