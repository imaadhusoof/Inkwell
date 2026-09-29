import { BlendMode, PDFDocument, rgb } from 'pdf-lib'
import type { PDFDocumentProxy } from './pdfjs'
import type { AnnotationStore } from './annotationStore'
import { strokeOutline } from './ink'

function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const value = parseInt(hex.replace('#', ''), 16)
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255)
}

/**
 * Returns a copy of the PDF with every stroke drawn into its pages as vector paths,
 * so the annotations show up in any PDF reader.
 */
export async function exportAnnotatedPdf(
  original: ArrayBuffer,
  pdfDoc: PDFDocumentProxy,
  store: AnnotationStore
): Promise<Uint8Array> {
  const out = await PDFDocument.load(original.slice(0), { ignoreEncryption: true })
  const pages = out.getPages()

  for (const pageNumber of store.pagesWithInk()) {
    const target = pages[pageNumber - 1]
    if (!target) continue
    // Strokes live in pdf.js viewport space (rotation and crop box applied), so map each
    // outline point back to the page's own coordinate system
    const viewport = (await pdfDoc.getPage(pageNumber)).getViewport({ scale: 1 })

    for (const stroke of store.getStrokes(pageNumber)) {
      const outline = strokeOutline(stroke)
      if (outline.length < 3) continue
      const path =
        outline
          .map(([x, y], i) => {
            const [px, py] = viewport.convertToPdfPoint(x, y)
            // drawSvgPath flips the y axis, so negate it to land at the right spot
            return `${i === 0 ? 'M' : 'L'}${px.toFixed(2)} ${(-py).toFixed(2)}`
          })
          .join(' ') + ' Z'

      target.drawSvgPath(path, {
        x: 0,
        y: 0,
        color: hexToRgb(stroke.color),
        opacity: stroke.opacity,
        borderWidth: 0,
        blendMode: stroke.tool === 'highlighter' ? BlendMode.Multiply : BlendMode.Normal
      })
    }
  }

  return out.save()
}
