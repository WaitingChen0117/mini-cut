import { useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { generateId } from '@/utils/time'
import styles from './TextOverlay.module.css'

interface TextOverlayProps {
  onClose: () => void
}

export function TextOverlay({ onClose }: TextOverlayProps) {
  const { currentTime, totalDuration, addTextItem } = useEditorStore()
  const [text, setText] = useState('输入文字')
  const [fontSize, setFontSize] = useState(36)
  const [color, setColor] = useState('#ffffff')
  const [duration, setDuration] = useState(3)

  const handleConfirm = () => {
    if (!text.trim()) return
    addTextItem({
      id: generateId(),
      text: text.trim(),
      startTime: currentTime,
      endTime: Math.min(currentTime + duration, totalDuration || currentTime + duration),
      x: 0.1,
      y: 0.8,
      fontSize,
      color,
      fontWeight: 'bold',
      scale: 1,
      rotation: 0,
      trackIndex: 0,
    })
    onClose()
  }

  return (
    <div className={styles.text_overlay_modal} onClick={onClose}>
      <div
        className={styles.text_overlay__dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="添加文字"
      >
        <div className={styles.text_overlay__title}>添加文字</div>

        <div className={styles.text_overlay__field}>
          <label className={styles.text_overlay__label}>文字内容</label>
          <input
            className={styles.text_overlay__input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          />
        </div>

        <div className={styles.text_overlay__row}>
          <div className={styles.text_overlay__field}>
            <label className={styles.text_overlay__label}>字号</label>
            <input
              className={styles.text_overlay__input}
              type="number"
              min={12}
              max={120}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </div>
          <div className={styles.text_overlay__field}>
            <label className={styles.text_overlay__label}>颜色</label>
            <input
              className={styles.text_overlay__input}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ padding: 2, height: 36, cursor: 'pointer' }}
            />
          </div>
          <div className={styles.text_overlay__field}>
            <label className={styles.text_overlay__label}>持续(秒)</label>
            <input
              className={styles.text_overlay__input}
              type="number"
              min={0.5}
              step={0.5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
        </div>

        <div className={styles.text_overlay__actions}>
          <button
            className={`${styles.text_overlay__btn} ${styles['text_overlay__btn--cancel']}`}
            onClick={onClose}
          >
            取消
          </button>
          <button
            className={`${styles.text_overlay__btn} ${styles['text_overlay__btn--confirm']}`}
            onClick={handleConfirm}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
