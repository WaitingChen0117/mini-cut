import { useEditorStore } from '@/store/editorStore'
import { formatTimecode } from '@/utils/time'
import styles from './PropertiesPanel.module.css'

// Show at most the last 24 chars of a filename to avoid overflow
const shortName = (name: string) =>
  name.length > 24 ? '…' + name.slice(-22) : name

export function PropertiesPanel() {
  const {
    selectedItemId,
    selectedTextId,
    tracks,
    mediaList,
    textItems,
    removeTrackItem,
    updateTextItem,
    removeTextItem,
  } = useEditorStore()

  const selectedTrack = tracks.find((t) => t.id === selectedItemId)
  const selectedMedia = selectedTrack
    ? mediaList.find((m) => m.id === selectedTrack.mediaId)
    : null
  const selectedText = textItems.find((t) => t.id === selectedTextId)

  if (selectedTrack && selectedMedia) {
    return (
      <div className={styles.props}>
        <div className={styles.props__header}>片段属性</div>
        <div className={styles.props__body}>
          <div className={styles.props__field}>
            <span className={styles.props__label}>文件名</span>
            <span className={styles.props__value} title={selectedMedia.name}>{shortName(selectedMedia.name)}</span>
          </div>
          <div className={styles.props__row}>
            <div className={styles.props__field}>
              <span className={styles.props__label}>入点</span>
              <span className={styles.props__value}>{formatTimecode(selectedTrack.startTime)}</span>
            </div>
            <div className={styles.props__field}>
              <span className={styles.props__label}>出点</span>
              <span className={styles.props__value}>{formatTimecode(selectedTrack.endTime)}</span>
            </div>
          </div>
          <div className={styles.props__row}>
            <div className={styles.props__field}>
              <span className={styles.props__label}>素材入点</span>
              <span className={styles.props__value}>{formatTimecode(selectedTrack.clipStart)}</span>
            </div>
            <div className={styles.props__field}>
              <span className={styles.props__label}>素材出点</span>
              <span className={styles.props__value}>{formatTimecode(selectedTrack.clipEnd)}</span>
            </div>
          </div>
          <div className={styles.props__field}>
            <span className={styles.props__label}>时长</span>
            <span className={styles.props__value}>
              {formatTimecode(selectedTrack.endTime - selectedTrack.startTime)}
            </span>
          </div>
          <button
            className={styles.props__delete_btn}
            onClick={() => removeTrackItem(selectedTrack.id)}
          >
            🗑 删除片段
          </button>
        </div>
      </div>
    )
  }

  if (selectedText) {
    return (
      <div className={styles.props}>
        <div className={styles.props__header}>文字属性</div>
        <div className={styles.props__body}>
          <div className={styles.props__field}>
            <span className={styles.props__label}>文字内容</span>
            <input
              className={styles.props__input}
              value={selectedText.text}
              onChange={(e) => updateTextItem(selectedText.id, { text: e.target.value })}
            />
          </div>
          <div className={styles.props__row}>
            <div className={styles.props__field}>
              <span className={styles.props__label}>字号</span>
              <input
                className={styles.props__input}
                type="number"
                min={12}
                max={120}
                value={selectedText.fontSize}
                onChange={(e) =>
                  updateTextItem(selectedText.id, { fontSize: Number(e.target.value) })
                }
              />
            </div>
            <div className={styles.props__field}>
              <span className={styles.props__label}>颜色</span>
              <input
                className={styles.props__input}
                type="color"
                value={selectedText.color}
                onChange={(e) => updateTextItem(selectedText.id, { color: e.target.value })}
                style={{ padding: 2, height: 34, cursor: 'pointer' }}
              />
            </div>
          </div>
          <div className={styles.props__row}>
            <div className={styles.props__field}>
              <span className={styles.props__label}>缩放 %</span>
              <input
                className={styles.props__input}
                type="number"
                min={10}
                max={1000}
                step={5}
                value={Math.round(selectedText.scale * 100)}
                onChange={(e) =>
                  updateTextItem(selectedText.id, { scale: Number(e.target.value) / 100 })
                }
              />
            </div>
            <div className={styles.props__field}>
              <span className={styles.props__label}>旋转 °</span>
              <input
                className={styles.props__input}
                type="number"
                min={-180}
                max={180}
                step={1}
                value={Math.round(selectedText.rotation)}
                onChange={(e) =>
                  updateTextItem(selectedText.id, { rotation: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className={styles.props__row}>
            <div className={styles.props__field}>
              <span className={styles.props__label}>出现时间</span>
              <input
                className={styles.props__input}
                type="number"
                min={0}
                step={0.1}
                value={selectedText.startTime.toFixed(1)}
                onChange={(e) =>
                  updateTextItem(selectedText.id, { startTime: Number(e.target.value) })
                }
              />
            </div>
            <div className={styles.props__field}>
              <span className={styles.props__label}>消失时间</span>
              <input
                className={styles.props__input}
                type="number"
                min={0}
                step={0.1}
                value={selectedText.endTime.toFixed(1)}
                onChange={(e) =>
                  updateTextItem(selectedText.id, { endTime: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <button
            className={styles.props__delete_btn}
            onClick={() => removeTextItem(selectedText.id)}
          >
            🗑 删除文字
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.props}>
      <div className={styles.props__header}>属性</div>
      <div className={styles.props__empty}>
        <div className={styles.props__empty_icon}>✦</div>
        <div>选择时间轴上的片段</div>
        <div style={{ fontSize: 11, color: '#1e2a3a', marginTop: 2 }}>查看或编辑属性</div>
      </div>
    </div>
  )
}
