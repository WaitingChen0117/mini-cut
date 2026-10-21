# FE-PERF-003: 60fps 时间显示禁止走 React state，必须直接操作 DOM ref

- **分类**: PERF
- **问题现象**: 用 setState 更新播放时间导致每帧触发 re-render，播放卡顿
- **修复方式**: 在 RAF 循环中用 ref 直接写 DOM：`timeRef.current.textContent = formatTC(t)`、`progressRef.current.style.width = ...`。涉及 ref：libTimeRef, textTimeRef, fsProgressFillRef, fsTimeCurRef, fsPlayBtnRef
- **确认次数**: 1
- **应用记录**: PreviewPanel RAF 循环
- **创建时间**: 2026-05-25T00:00:00Z
- **最后引用**: 2026-05-25T00:00:00Z
