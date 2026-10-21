# FE-PERF-002: 拖动播放头画面一跳一跳：fastSeek跳关键帧是根因

- **分类**: PERF
- **问题现象**: 拖动播放头（scrub）时画面一跳一跳，中间跳过了很多帧，不够丝滑。不是闪烁，是内容"跳帧"——相邻位置显示的是同一关键帧，然后突然跳到下一个关键帧。
- **根本原因**: `fastSeek(t)` 的语义是跳到 ≤t 的最近关键帧，而非 t 本身。H.264 视频关键帧间隔通常 2~5s，导致拖动时显示的是关键帧处的画面，而非播放头精确位置的帧。另外 RAF 每帧都强行调用 ctx.drawImage，在 seek 解码期间画出的是前一帧（旧帧），造成"画旧帧→画关键帧→画旧帧→画关键帧"的跳跃视觉。
- **修复方式**:
  1. 去掉 `fastSeek()`，改用精确 seek：`video.currentTime = expected`
  2. canvas 绘制从 RAF 驱动改为 `seeked` 事件驱动：在 `registerLocalVideo` 中 `el.addEventListener('seeked', drawToCanvas)`，浏览器解码完成才画，不画"解码中的旧帧"
  3. RAF 循环改为双职责：playing=true 时每帧绘制（正常播放，快）；playing=false 时只负责发起精确 seek，不负责绘制
  4. 保留 `!video.seeking` 节流，防止 seek 队列积压：前一次 seek 未完成时不发新 seek
- **效果**: 每次显示的帧都是播放头精确位置的画面；画面"hold住"等待解码再更新，而不是跳到错误关键帧
- **关键代码**:
  ```ts
  // registerLocalVideo 中
  el.addEventListener('seeked', drawToCanvas)

  // frameLoop（RAF）中
  if (playing) {
    drawToCanvas()
  } else if (activeTrack) {
    const video = videoRefs.current.get(activeTrack.mediaId)
    if (video) {
      const expected = activeTrack.clipStart + (t - activeTrack.startTime)
      if (!video.seeking && Math.abs(video.currentTime - expected) > 0.001) {
        video.currentTime = expected  // 精确 seek，非 fastSeek
      }
    }
  }
  ```
- **注意**: fastSeek 适合"跳转到大致位置快速播放"的场景，不适合"scrub 精确定帧"场景
- **确认次数**: 1
- **应用记录**: PreviewPanel/index.tsx
- **创建时间**: 2026-05-19T08:30:00Z
- **最后引用**: 2026-05-19T08:30:00Z
