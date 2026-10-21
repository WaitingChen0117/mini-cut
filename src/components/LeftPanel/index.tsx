import { useState } from 'react'
import { MediaLibrary } from '@/components/MediaLibrary'
import { useEditorStore } from '@/store/editorStore'
import { useMediaImport } from '@/hooks/useMediaImport'
import { generateId } from '@/utils/time'
import styles from './LeftPanel.module.css'

const TABS = [
  { id: 'media', icon: '🎬', label: '媒体' },
  { id: 'text', icon: 'T', label: '文字' },
  { id: 'sticker', icon: '✨', label: '贴纸' },
  { id: 'effect', icon: '🎨', label: '特效' },
  { id: 'transition', icon: '⚡', label: '转场' },
] as const

type TabId = (typeof TABS)[number]['id']

const TEXT_PRESETS = [
  { label: '默认文字', fontSize: 48, color: '#ffffff', fontWeight: 'normal' as const },
  { label: '标题文字', fontSize: 72, color: '#ffffff', fontWeight: 'bold' as const },
  { label: '字幕文字', fontSize: 36, color: '#ffe066', fontWeight: 'normal' as const },
  { label: '小字说明', fontSize: 28, color: '#aaaaaa', fontWeight: 'normal' as const },
]

export function LeftPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('media')
  const { addTextItem, totalDuration, currentTime, setPreviewTextPreset, previewTextPreset, setIsPlaying } = useEditorStore()
  const { importFiles } = useMediaImport()

  const handleAddText = (preset: typeof TEXT_PRESETS[number]) => {
    const startTime = currentTime
    const endTime = Math.min(startTime + 5, totalDuration > 0 ? totalDuration : startTime + 5)
    addTextItem({
      id: generateId(),
      text: preset.label,
      startTime,
      endTime: endTime > startTime ? endTime : startTime + 5,
      x: 0.5,
      y: 0.8,
      fontSize: preset.fontSize,
      color: preset.color,
      fontWeight: preset.fontWeight,
      scale: 1,
      rotation: 0,
      trackIndex: 0,
    })
    setPreviewTextPreset(null)
  }

  const handlePreviewText = (preset: typeof TEXT_PRESETS[number]) => {
    setPreviewTextPreset({ text: preset.label, fontSize: preset.fontSize, color: preset.color, fontWeight: preset.fontWeight })
    if (totalDuration > 0) setIsPlaying(true)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/*,audio/*,image/*'
    input.multiple = true
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files?.length) await importFiles(files)
    }
    input.click()
  }

  return (
    <div className={styles.panel}>
      {/* Icon nav on left edge */}
      <nav className={styles.panel__nav}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.panel__nav_btn} ${activeTab === tab.id ? styles['panel__nav_btn--active'] : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <span className={styles.panel__nav_icon}>{tab.icon}</span>
            <span className={styles.panel__nav_label}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Content area */}
      <div className={styles.panel__content}>
        {activeTab === 'media' && (
          <div className={styles.panel__media}>
            <div className={styles.panel__media_header}>
              <span>素材库</span>
              <button className={styles.panel__import_btn} onClick={handleImport}>
                + 导入
              </button>
            </div>
            <MediaLibrary hideHeader />
          </div>
        )}

        {activeTab === 'text' && (
          <div className={styles.panel__text}>
            <div className={styles.panel__section_title}>文字预设</div>
            <div className={styles.panel__text_grid}>
              {TEXT_PRESETS.map((preset) => (
                <div key={preset.label} className={styles.panel__text_preset_wrap}>
                  <button
                    className={`${styles.panel__text_preset} ${previewTextPreset?.text === preset.label ? styles['panel__text_preset--active'] : ''}`}
                    onClick={() => handlePreviewText(preset)}
                    style={{ fontSize: Math.min(preset.fontSize / 4, 20) }}
                  >
                    <span style={{ fontWeight: preset.fontWeight, color: preset.color }}>
                      {preset.label}
                    </span>
                  </button>
                  <button
                    className={styles.panel__text_add_btn}
                    onClick={() => handleAddText(preset)}
                    title="添加到时间轴"
                  >+</button>
                </div>
              ))}
            </div>
            <div className={styles.panel__section_title} style={{ marginTop: 16 }}>提示</div>
            <div className={styles.panel__hint}>
              点击预设预览效果，点击右下角"+"添加到时间轴
            </div>
          </div>
        )}

        {activeTab === 'sticker' && (
          <div className={styles.panel__placeholder}>
            <div className={styles.panel__placeholder_icon}>✨</div>
            <div>贴纸功能</div>
            <div className={styles.panel__placeholder_sub}>即将推出</div>
          </div>
        )}

        {activeTab === 'effect' && (
          <div className={styles.panel__placeholder}>
            <div className={styles.panel__placeholder_icon}>🎨</div>
            <div>特效功能</div>
            <div className={styles.panel__placeholder_sub}>即将推出</div>
          </div>
        )}

        {activeTab === 'transition' && (
          <div className={styles.panel__placeholder}>
            <div className={styles.panel__placeholder_icon}>⚡</div>
            <div>转场功能</div>
            <div className={styles.panel__placeholder_sub}>即将推出</div>
          </div>
        )}
      </div>
    </div>
  )
}
