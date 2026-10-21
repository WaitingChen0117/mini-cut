import { create } from 'zustand'
import { generateId } from '@/utils/time'
import type { EditorState, EditorActions, MediaItem, TrackItem, TextItem, TextPreset } from '@/types/editor'

type EditorStore = EditorState & EditorActions

export const useEditorStore = create<EditorStore>((set, get) => ({
  mediaList: [],
  tracks: [],
  textItems: [],
  currentTime: 0,
  totalDuration: 0,
  isPlaying: false,
  selectedItemId: null,
  selectedTextId: null,
  libraryPreviewMediaId: null,
  libraryPreviewTime: 0,
  libraryPreviewPlaying: false,
  previewTextPreset: null,

  addMedia: (item: MediaItem) =>
    set((s) => ({ mediaList: [...s.mediaList, item] })),

  removeMedia: (id: string) =>
    set((s) => ({
      mediaList: s.mediaList.filter((m) => m.id !== id),
      tracks: s.tracks.filter((t) => t.mediaId !== id),
    })),

  addTrackItem: (item: TrackItem) =>
    set((s) => {
      const tracks = [...s.tracks, item]
      const total = tracks.reduce((max, t) => Math.max(max, t.endTime), 0)
      return { tracks, totalDuration: total }
    }),

  insertTrackItem: (item: TrackItem) =>
    set((s) => {
      const dur = item.endTime - item.startTime
      const at = item.startTime
      const tracks = [
        ...s.tracks.map((t) =>
          t.startTime >= at
            ? { ...t, startTime: t.startTime + dur, endTime: t.endTime + dur }
            : t,
        ),
        item,
      ]
      const textItems = s.textItems.map((t) =>
        t.startTime >= at
          ? { ...t, startTime: t.startTime + dur, endTime: t.endTime + dur }
          : t,
      )
      const total = tracks.reduce((max, t) => Math.max(max, t.endTime), 0)
      return { tracks, textItems, totalDuration: total }
    }),

  removeTrackItem: (id: string) =>
    set((s) => {
      const tracks = s.tracks.filter((t) => t.id !== id)
      const total = tracks.reduce((max, t) => Math.max(max, t.endTime), 0)
      return { tracks, totalDuration: total }
    }),

  updateTrackItem: (id: string, updates: Partial<TrackItem>) =>
    set((s) => {
      const tracks = s.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t))
      const total = tracks.reduce((max, t) => Math.max(max, t.endTime), 0)
      return { tracks, totalDuration: total }
    }),

  addTextItem: (item: TextItem) =>
    set((s) => ({ textItems: [...s.textItems, item] })),

  removeTextItem: (id: string) =>
    set((s) => ({ textItems: s.textItems.filter((t) => t.id !== id) })),

  updateTextItem: (id: string, updates: Partial<TextItem>) =>
    set((s) => ({
      textItems: s.textItems.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  setCurrentTime: (time: number) => set({ currentTime: time }),

  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),

  setSelectedItemId: (id: string | null) => set({ selectedItemId: id, selectedTextId: null }),

  setSelectedTextId: (id: string | null) => set({ selectedTextId: id, selectedItemId: null }),

  recalcDuration: () => {
    const { tracks } = get()
    const total = tracks.reduce((max, t) => Math.max(max, t.endTime), 0)
    set({ totalDuration: total })
  },

  splitAtTime: (time: number) => {
    const { tracks, textItems } = get()
    let newTracks = [...tracks]
    let newTextItems = [...textItems]
    let changed = false

    // Split video track items
    for (let i = newTracks.length - 1; i >= 0; i--) {
      const t = newTracks[i]
      if (time > t.startTime && time < t.endTime) {
        const clipOffset = time - t.startTime
        const left: TrackItem = { ...t, endTime: time, clipEnd: t.clipStart + clipOffset }
        const right: TrackItem = { ...t, id: generateId(), startTime: time, clipStart: t.clipStart + clipOffset }
        newTracks.splice(i, 1, left, right)
        changed = true
      }
    }

    // Split text items
    for (let i = newTextItems.length - 1; i >= 0; i--) {
      const tx = newTextItems[i]
      if (time > tx.startTime && time < tx.endTime) {
        const left: TextItem = { ...tx, endTime: time }
        const right: TextItem = { ...tx, id: generateId(), startTime: time }
        newTextItems.splice(i, 1, left, right)
        changed = true
      }
    }

    if (changed) {
      const total = newTracks.reduce((max, t) => Math.max(max, t.endTime), 0)
      set({ tracks: newTracks, textItems: newTextItems, totalDuration: total, selectedItemId: null, selectedTextId: null })
    }
  },

  setLibraryPreviewMediaId: (id: string | null) =>
    set({ libraryPreviewMediaId: id, previewTextPreset: null, isPlaying: id ? false : get().isPlaying }),

  setLibraryPreviewTime: (time: number) => set({ libraryPreviewTime: time }),

  setLibraryPreviewPlaying: (playing: boolean) => set({ libraryPreviewPlaying: playing }),

  setPreviewTextPreset: (preset: TextPreset | null) =>
    set({ previewTextPreset: preset, libraryPreviewMediaId: null, libraryPreviewPlaying: false }),
}))
