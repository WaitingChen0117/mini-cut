# FE-STATE-002: 多段视频无法顺序连续播放

- **分类**: STATE
- **问题现象**: 时间轴上有两段或更多视频片段，播放到第一段结尾后停止，不会自动衔接第二段。
- **根本原因**: `usePlayback` 的 `tick` 函数检测到 `video.currentTime >= clipEnd` 时直接调用 `setIsPlaying(false)` + `setCurrentTime(0)`，没有查找是否有下一个片段可以继续播放。
- **修复方式**: 在 `tick` 检测到当前片段结束时，计算 `storeTime = trackStartTime + (clipEnd - clipStart)`（即当前片段在时间轴上的出点），用 `storeTime` 去 `tracksRef.current.find(t => storeTime >= t.startTime && storeTime < t.endTime)` 查找下一片段。找到则立即 seek 下一片段对应视频并调用 `play()`，继续 RAF；找不到才停止并重置。
- **关键代码**:
  ```ts
  const storeTime = trackStartTime + (clipEnd - clipStart)
  const nextTrack = tracksRef.current.find(
    (t) => storeTime >= t.startTime && storeTime < t.endTime,
  )
  if (nextTrack) {
    const nextVideo = videoRefs.current.get(nextTrack.mediaId)
    // seek + play nextVideo, return without stopping
  } else {
    setIsPlaying(false); setCurrentTime(0)
  }
  ```
- **注意**: 同一个 mediaId 的两段片段（相邻）共享同一个 `<video>` 元素，切换时需要 seek 回第二段的 `clipStart`，这是正常行为。
- **确认次数**: 1
- **应用记录**: hooks/usePlayback.ts
- **创建时间**: 2026-05-19T09:00:00Z
- **最后引用**: 2026-05-19T09:00:00Z
