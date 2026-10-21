import { useState, useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { useMediaImport } from '@/hooks/useMediaImport'
import { formatTimecode } from '@/utils/time'
import styles from './MediaLibrary.module.css'

interface MediaLibraryProps {
  hideHeader?: boolean
}

interface ContextMenu {
  mediaId: string
  x: number
  y: number
}

export function MediaLibrary({ hideHeader }: MediaLibraryProps) {
  const {
    mediaList, tracks, removeMedia,
    libraryPreviewMediaId, libraryPreviewTime, libraryPreviewPlaying,
    setLibraryPreviewMediaId, setLibraryPreviewTime, setLibraryPreviewPlaying,
  } = useEditorStore()
  const { addToTimeline } = useMediaImport()

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const usedMediaIds = new Set(tracks.map((t) => t.mediaId))

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  const handleDragStart = (e: React.DragEvent, mediaId: string) => {
    e.dataTransfer.setData('text/media-id', mediaId)
  }

  const handleThumbClick = (e: React.MouseEvent<HTMLDivElement>, mediaId: string, duration: number) => {
    if (libraryPreviewMediaId === mediaId) {
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setLibraryPreviewTime(ratio * duration)
      setLibraryPreviewPlaying(false)
    } else {
      setLibraryPreviewMediaId(mediaId)
      setLibraryPreviewTime(0)
      setLibraryPreviewPlaying(true)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, mediaId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ mediaId, x: e.clientX, y: e.clientY })
  }

  const handleMenuAdd = (mediaId: string, duration: number) => {
    addToTimeline(mediaId, duration)
    setContextMenu(null)
  }

  const handleMenuDelete = (mediaId: string) => {
    if (libraryPreviewMediaId === mediaId) setLibraryPreviewMediaId(null)
    removeMedia(mediaId)
    setContextMenu(null)
  }

  const contextMediaItem = contextMenu
    ? mediaList.find((m) => m.id === contextMenu.mediaId)
    : null

  return (
    <div className={styles.library}>
      {!hideHeader && <div className={styles.library__header}>素材库</div>}
      <div className={styles.library__grid}>
        {mediaList.length === 0 && (
          <div className={styles.library__empty}>
            <div>还没有素材</div>
            <div style={{ marginTop: 6 }}>点击上方"+ 导入"添加文件</div>
          </div>
        )}
        {mediaList.map((media) => {
          const isSelected = libraryPreviewMediaId === media.id
          const progressPct = isSelected && media.duration > 0
            ? (libraryPreviewTime / media.duration) * 100
            : 0
          return (
            <div
              key={media.id}
              className={styles.library__item}
              draggable
              onDragStart={(e) => handleDragStart(e, media.id)}
              onContextMenu={(e) => handleContextMenu(e, media.id)}
              title={media.name}
            >
              <div
                className={`${styles.library__thumb} ${isSelected ? styles['library__thumb--selected'] : ''}`}
                onClick={(e) => handleThumbClick(e, media.id, media.duration)}
              >
                {media.type === 'video' ? (
                  <video src={media.url} muted playsInline preload="metadata" />
                ) : media.type === 'audio' ? (
                  <div className={styles.library__thumb_icon}>🎵</div>
                ) : (
                  <img src={media.url} alt={media.name} />
                )}

                <span className={styles.library__duration}>
                  {formatTimecode(media.duration)}
                </span>

                {usedMediaIds.has(media.id) && (
                  <div className={styles.library__added_badge} />
                )}

                {isSelected && (
                  <div className={styles.library__progress_line} style={{ left: `${progressPct}%` }} />
                )}

                {isSelected && (
                  <div className={styles.library__playing_icon}>
                    {libraryPreviewPlaying ? '⏸' : '▶'}
                  </div>
                )}

                {/* Hover add button — bottom-right, no overlay */}
                <button
                  className={styles.library__btn_add}
                  onClick={(e) => { e.stopPropagation(); addToTimeline(media.id, media.duration) }}
                  title="添加到时间轴"
                >+</button>
              </div>

              <div className={styles.library__name}>{media.name}</div>
            </div>
          )
        })}
      </div>

      {/* Context menu */}
      {contextMenu && contextMediaItem && (
        <div
          ref={menuRef}
          className={styles.library__context_menu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className={styles.library__menu_item}
            onClick={() => handleMenuAdd(contextMediaItem.id, contextMediaItem.duration)}
          >
            添加到时间轴
          </button>
          <div className={styles.library__menu_divider} />
          <button
            className={`${styles.library__menu_item} ${styles['library__menu_item--danger']}`}
            onClick={() => handleMenuDelete(contextMediaItem.id)}
          >
            删除素材
          </button>
        </div>
      )}
    </div>
  )
}
