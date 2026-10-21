export interface MediaItem {
  id: string
  name: string
  type: 'video' | 'audio' | 'image'
  url: string
  duration: number
  width?: number
  height?: number
  thumbnail?: string
}

export interface TrackItem {
  id: string
  mediaId: string
  trackIndex: number
  startTime: number
  endTime: number
  clipStart: number
  clipEnd: number
  x?: number
  y?: number
}

export interface TextItem {
  id: string
  text: string
  startTime: number
  endTime: number
  x: number
  y: number
  fontSize: number
  color: string
  fontWeight: 'normal' | 'bold'
  scale: number
  rotation: number
  trackIndex: number
}

export interface TextPreset {
  text: string
  fontSize: number
  color: string
  fontWeight: 'normal' | 'bold'
}

export interface EditorState {
  mediaList: MediaItem[]
  tracks: TrackItem[]
  textItems: TextItem[]
  currentTime: number
  totalDuration: number
  isPlaying: boolean
  selectedItemId: string | null
  selectedTextId: string | null
  // Library preview
  libraryPreviewMediaId: string | null
  libraryPreviewTime: number
  libraryPreviewPlaying: boolean
  previewTextPreset: TextPreset | null
}

export interface EditorActions {
  addMedia: (item: MediaItem) => void
  removeMedia: (id: string) => void
  addTrackItem: (item: TrackItem) => void
  insertTrackItem: (item: TrackItem) => void
  removeTrackItem: (id: string) => void
  updateTrackItem: (id: string, updates: Partial<TrackItem>) => void
  addTextItem: (item: TextItem) => void
  removeTextItem: (id: string) => void
  updateTextItem: (id: string, updates: Partial<TextItem>) => void
  setCurrentTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  setSelectedItemId: (id: string | null) => void
  setSelectedTextId: (id: string | null) => void
  recalcDuration: () => void
  splitAtTime: (time: number) => void
  setLibraryPreviewMediaId: (id: string | null) => void
  setLibraryPreviewTime: (time: number) => void
  setLibraryPreviewPlaying: (playing: boolean) => void
  setPreviewTextPreset: (preset: TextPreset | null) => void
}
