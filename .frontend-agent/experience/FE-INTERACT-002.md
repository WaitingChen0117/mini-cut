# FE-INTERACT-002: 标尺点击位置与播放头偏移 + 素材库悬停添加按钮

- **分类**: INTERACT
- **问题一：标尺点击偏移**
  - **现象**: 点击时间轴标尺某处，播放头跳到的位置比鼠标点击处偏右约 0.75 秒。
  - **根因**: 标尺行左侧有 `LABEL_W = 60px` 的标签列。`handleRulerClick` 用 `e.clientX - rect.left` 计算，没有减去这 60px，相当于把标签列宽度也算进了时间里（60/80 = 0.75s 的误差）。播放头定位时用了 `LABEL_W + currentTime * PX_PER_SEC`（正确），两者不对称。
  - **修复**: `(e.clientX - rect.left - LABEL_W) / PX_PER_SEC`，点击标签列区域时直接 return。
- **问题二：素材库悬停添加按钮（波纹插入）**
  - **需求**: hover 素材时出现"+"按钮，点击后将素材插入到基准线（播放头）之后，且不与已有片段重叠。
  - **实现**:
    1. CSS hover 显隐按钮（`opacity: 0` → `opacity: 1`），参考已有的删除按钮做法
    2. `addAfterPlayhead`: 找到播放头所在片段，取其 `endTime` 作为插入点；播放头在空白处则取所有片段的 maxEnd
    3. Store 新增 `insertTrackItem` 原子操作：将 `startTime >= insertAt` 的所有视频片段和文字条目的时间整体右移 `duration` 秒（波纹插入），然后追加新片段——一次 `set` 完成，避免多次 re-render
  - **注意**: 普通的 `addTrackItem` 不会移动已有片段，会导致重叠。需要专门的 `insertTrackItem`。
- **确认次数**: 1
- **应用记录**: Timeline/index.tsx, MediaLibrary/index.tsx, useMediaImport.ts, editorStore.ts, editor.ts
- **创建时间**: 2026-05-19T09:00:00Z
- **最后引用**: 2026-05-19T09:00:00Z
