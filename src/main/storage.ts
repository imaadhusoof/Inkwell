import { app } from 'electron'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

function dataRoot(): string {
  const root = join(app.getPath('userData'), 'inkwell-data')
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  return root
}

function idFor(pdfPath: string): string {
  return createHash('sha256').update(pdfPath).digest('hex').slice(0, 16)
}

function ensureDir(sub: string): string {
  const dir = join(dataRoot(), sub)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function loadAnnotations(pdfPath: string): unknown | null {
  const file = join(ensureDir('annotations'), `${idFor(pdfPath)}.json`)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

export function saveAnnotations(pdfPath: string, data: unknown): void {
  const file = join(ensureDir('annotations'), `${idFor(pdfPath)}.json`)
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

export function loadNotes(pdfPath: string): string | null {
  const file = join(ensureDir('notes'), `${idFor(pdfPath)}.md`)
  if (!existsSync(file)) return null
  return readFileSync(file, 'utf-8')
}

export function saveNotes(pdfPath: string, markdown: string): void {
  const file = join(ensureDir('notes'), `${idFor(pdfPath)}.md`)
  writeFileSync(file, markdown, 'utf-8')
}
