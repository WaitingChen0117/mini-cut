# FE-PERF-001: 视频播放闪烁：RAF依赖stale闭包+每帧seek是根因

- **分类**: PERF
- **问题现象**: 播放时画面一闪一闪。原因有三：①useCallback依赖currentTime，每帧都重建tick函数，导致useEffect重跑、RAF cancel+重启产生帧间隙；②syncVideos每0.1秒强制seek一次video.currentTime，seek期间readyState下降，drawFrame画出黑帧；③drawFrame读stateRef存在useEffect异步延迟，可能读到stale值
- **修复方式**: 三处联合修复：①usePlayback改为video.play()真正播放，用getState()读当前时间避免stale闭包，从video.currentTime反向同步store，彻底消除重复seek；②drawFrame改用useEditorStore.getState()直接读最新状态；③视频帧未就绪时（readyState<2）跳过clearRect+draw，保留上一帧，不画黑底；④视频容器改visibility:hidden替代display:none，确保浏览器不暂停帧解码
- **确认次数**: 1
- **应用记录**: （空）
- **创建时间**: 2026-05-19T06:55:27Z
- **最后引用**: 2026-05-19T06:55:27Z
