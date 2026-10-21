# FE-STATE-001: 播放结束未重置时间+播放头不可拖拽

- **分类**: STATE
- **问题现象**: 视频播放完毕后 currentTime 停在末尾，再次点播放无响应；时间轴红色播放头 pointer-events:none 无法拖拽定位
- **修复方式**: ①tick检测到播放结束时追加 setCurrentTime(0) 回到起点；②DragState 新增 playhead 类型，handlePointerMove 增加分支计算新时间并 setCurrentTime；③playhead CSS 从 pointer-events:none 改为 all，加 padding 扩大热区，inline style 设 cursor:ew-resize
- **确认次数**: 1
- **应用记录**: （空）
- **创建时间**: 2026-05-19T06:59:33Z
- **最后引用**: 2026-05-19T06:59:33Z
