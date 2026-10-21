# FE-BUILD-001: Vite非TTY环境无法交互式初始化

- **分类**: BUILD
- **问题现象**: npm create vite@latest 在非TTY环境下报Operation cancelled
- **修复方式**: 手动创建package.json/tsconfig.json/vite.config.ts，跳过create-vite交互流程
- **确认次数**: 1
- **应用记录**: （空）
- **创建时间**: 2026-05-19T06:24:04Z
- **最后引用**: 2026-05-19T06:24:04Z
