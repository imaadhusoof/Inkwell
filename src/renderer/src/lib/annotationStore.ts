import { useSyncExternalStore } from 'react'
import { api } from './api'
import { strokeHit } from './ink'
import { emptyDocumentAnnotations, type DocumentAnnotations, type Stroke } from './types'

type Action =
  | { type: 'add'; page: number; stroke: Stroke }
  | { type: 'remove'; page: number; strokes: Stroke[] }

const SAVE_DELAY = 400
const EMPTY: Stroke[] = []

/**
 * Annotation state for one document. Lives outside React so each page can subscribe to
 * just its own strokes; drawing on one page doesn't re-render the others.
 */
export class AnnotationStore {
  private pages = new Map<number, Stroke[]>()
  private pageListeners = new Map<number, Set<() => void>>()
  private historyListeners = new Set<() => void>()
  private undoStack: Action[] = []
  private redoStack: Action[] = []
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private history = { canUndo: false, canRedo: false }
  // Bumped on every change so exports and thumbnails know when to refresh
  version = 0

  constructor(private readonly pdfPath: string) {}

  async load(): Promise<void> {
    const data = (await api.loadAnnotations(this.pdfPath)) as DocumentAnnotations | null
    const doc = data ?? emptyDocumentAnnotations()
    for (const [page, { strokes }] of Object.entries(doc.pages)) {
      this.pages.set(Number(page), strokes)
      this.emitPage(Number(page))
    }
  }

  getStrokes = (page: number): Stroke[] => this.pages.get(page) ?? EMPTY

  pagesWithInk(): number[] {
    return [...this.pages.entries()].filter(([, s]) => s.length > 0).map(([p]) => p)
  }

  subscribePage(page: number, listener: () => void): () => void {
    let set = this.pageListeners.get(page)
    if (!set) this.pageListeners.set(page, (set = new Set()))
    set.add(listener)
    return () => set.delete(listener)
  }

  subscribeHistory = (listener: () => void): (() => void) => {
    this.historyListeners.add(listener)
    return () => this.historyListeners.delete(listener)
  }

  getHistory = (): { canUndo: boolean; canRedo: boolean } => this.history

  addStroke(page: number, stroke: Stroke): void {
    this.setPage(page, [...this.getStrokes(page), stroke])
    this.record({ type: 'add', page, stroke })
  }

  /** Removes every stroke on the page that the eraser circle touches. */
  eraseAt(page: number, x: number, y: number, radius: number): void {
    const strokes = this.getStrokes(page)
    const removed = strokes.filter((s) => strokeHit(s, x, y, radius))
    if (removed.length === 0) return
    this.setPage(page, strokes.filter((s) => !removed.includes(s)))
    this.record({ type: 'remove', page, strokes: removed })
  }

  clearPage(page: number): void {
    const strokes = this.getStrokes(page)
    if (strokes.length === 0) return
    this.setPage(page, [])
    this.record({ type: 'remove', page, strokes })
  }

  undo(): void {
    const action = this.undoStack.pop()
    if (!action) return
    this.redoStack.push(action)
    this.apply(action, true)
  }

  redo(): void {
    const action = this.redoStack.pop()
    if (!action) return
    this.undoStack.push(action)
    this.apply(action, false)
  }

  /** Writes any pending changes straight away, e.g. before the tab is closed. */
  flush(): void {
    if (!this.saveTimer) return
    clearTimeout(this.saveTimer)
    this.saveTimer = undefined
    this.save()
  }

  private apply(action: Action, reverse: boolean): void {
    const strokes = this.getStrokes(action.page)
    const adding = (action.type === 'add') !== reverse
    const affected = action.type === 'add' ? [action.stroke] : action.strokes
    this.setPage(
      action.page,
      adding ? [...strokes, ...affected] : strokes.filter((s) => !affected.includes(s))
    )
    this.updateHistory()
  }

  private record(action: Action): void {
    this.undoStack.push(action)
    this.redoStack = []
    this.updateHistory()
  }

  private setPage(page: number, strokes: Stroke[]): void {
    this.pages.set(page, strokes)
    this.version++
    this.emitPage(page)
    this.scheduleSave()
  }

  private emitPage(page: number): void {
    this.pageListeners.get(page)?.forEach((l) => l())
  }

  private updateHistory(): void {
    this.history = { canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 }
    this.historyListeners.forEach((l) => l())
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined
      this.save()
    }, SAVE_DELAY)
  }

  private save(): void {
    const doc: DocumentAnnotations = { pages: {} }
    for (const [page, strokes] of this.pages) {
      if (strokes.length > 0) doc.pages[page] = { strokes }
    }
    void api.saveAnnotations(this.pdfPath, doc)
  }
}

export function usePageStrokes(store: AnnotationStore, page: number): Stroke[] {
  return useSyncExternalStore(
    (listener) => store.subscribePage(page, listener),
    () => store.getStrokes(page)
  )
}

export function useHistory(store: AnnotationStore | null): { canUndo: boolean; canRedo: boolean } {
  return useSyncExternalStore(
    (listener) => (store ? store.subscribeHistory(listener) : () => {}),
    () => (store ? store.getHistory() : NO_HISTORY)
  )
}

const NO_HISTORY = { canUndo: false, canRedo: false }
