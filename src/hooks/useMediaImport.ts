import { useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import type { MediaItem, TrackItem } from '@/types/editor'

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function useMediaImport() {
  const { addMedia, addTrackItem, insertTrackItem, tracks } = useEditorStore()

  const importFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file)
        const isVideo = file.type.startsWith('video/')
        const isAudio = file.type.startsWith('audio/')

        const duration = await new Promise<number>((resolve) => {
          if (isVideo || isAudio) {
            const el = document.createElement(isVideo ? 'video' : 'audio')
            el.src = url
            el.onloadedmetadata = () => resolve(el.duration)
            el.onerror = () => resolve(0)
          } else {
            resolve(5)
          }
        })

        const media: MediaItem = {
          id: generateId(),
          name: file.name,
          type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
          url,
          duration,
        }
        addMedia(media)
      }
    },
    [addMedia],
  )

  const addToTimeline = useCallback(
    (mediaId: string, duration: number) => {
      const maxEnd = tracks.reduce((m, t) => Math.max(m, t.endTime), 0)
      const item: TrackItem = {
        id: generateId(),
        mediaId,
        trackIndex: 0,
        startTime: maxEnd,
        endTime: maxEnd + duration,
        clipStart: 0,
        clipEnd: duration,
      }
      addTrackItem(item)
    },
    [tracks, addTrackItem],
  )

  // Insert after the clip that contains the playhead; fall back to end of timeline
  const addAfterPlayhead = useCallback(
    (mediaId: string, duration: number) => {
      const { currentTime } = useEditorStore.getState()
      const activeTrack = tracks.find(
        (t) => currentTime >= t.startTime && currentTime < t.endTime,
      )
      const insertAt = activeTrack
        ? activeTrack.endTime
        : tracks.reduce((max, t) => Math.max(max, t.endTime), 0)
      insertTrackItem({
        id: generateId(),
        mediaId,
        trackIndex: 0,
        startTime: insertAt,
        endTime: insertAt + duration,
        clipStart: 0,
        clipEnd: duration,
      })
    },
    [tracks, insertTrackItem],
  )

  return { importFiles, addToTimeline, addAfterPlayhead }
}
