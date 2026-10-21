import { useEditorStore } from '@/store/editorStore'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  onExport: () => void
}

export function Toolbar({ onExport }: ToolbarProps) {
  const { tracks } = useEditorStore()

  return (
    <header className={styles.toolbar}>
      <span className={styles.toolbar__logo}>✂ MiniCut</span>
      <div className={styles.toolbar__divider} />
      <span className={styles.toolbar__version}>视频编辑器</span>
      <div className={styles.toolbar__spacer} />
      <button
        className={`${styles.toolbar__btn} ${styles['toolbar__btn--primary']}`}
        onClick={onExport}
        disabled={tracks.length === 0}
      >
        ⬇ 导出视频
      </button>
    </header>
  )
}
