# MiniCut

浏览器里的迷你视频编辑器，布局参考剪映：左侧素材、中间预览、右侧属性、底部时间轴。

技术栈：React 18、TypeScript、Vite、Zustand。

## 功能

- 导入本地视频、音频、图片，拖到时间轴
- 片段可移动、换轨道、两端裁剪；按 `B` 或工具栏按钮在播放头处分割
- 文字预设可预览并加到时间轴，支持拖动、缩放、旋转
- 左右面板和时间轴高度可拖拽调整
- 导出为 `minicut-export.webm`（用画布录制，时长与时间轴一致）

贴纸、特效、转场目前是占位入口。

## 本地运行

需要 Node.js 18 及以上。

```bash
npm install
npm run dev
```

其他命令：

```bash
npm run build    # 类型检查并构建
npm run preview  # 预览构建结果
npm test         # 跑单元测试
```
