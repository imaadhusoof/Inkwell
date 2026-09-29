# Inkwell

A desktop app for annotating PDFs and taking notes alongside them, built with Electron, React and TypeScript. Everything is saved locally on your own machine, with no account or cloud.

You can download the Windows installer from the [latest release](https://github.com/imaadhusoof/Inkwell/releases/latest).

## What it does

- **Tabs and a start screen:** open several PDFs at once as tabs. The start screen shows your recent files with a cover thumbnail, when you last opened them and how many pages they have. You can open files with Ctrl+O or by dragging them into the window, and each PDF reopens on the page and zoom level you left it at.
- **Pen:** freehand drawing in six colours or any custom colour, with three size presets. `[` and `]` fine-tune the size. With a stylus, the stroke width follows your pen pressure. With a mouse, the width is simulated from how fast you move. Hold Shift for a straight line.
- **Highlighter:** a flat, even-width stroke that's blended with multiply, so it tints the text underneath instead of covering it, like a real highlighter.
- **Eraser:** removes any stroke it touches, and shows a circle for its size.
- **Select and hand tools:** select and copy the PDF's text, or drag to pan. Holding space or dragging with the middle mouse button also pans.
- **Zoom:** Ctrl+scroll or a trackpad pinch zooms around your cursor. Fit-width mode keeps the page fitted as you resize the window or open panels.
- **Page thumbnails:** a sidebar of page thumbnails that includes your annotations and follows along as you scroll. Click one to jump to that page.
- **Notes panel:** a rich-text editor beside the PDF with headings, lists, quotes and code blocks, saved as Markdown. You can drag to resize it.
- **Export:** saves a copy of the PDF with your annotations baked in as vector paths, so they show up in any PDF reader.
- **Undo and redo** for both drawing and erasing, plus light and dark themes that can follow your system setting.

**Shortcuts:**
- **Tools:** V select, H hand, P pen, M highlighter, E eraser
- **Editing:** Ctrl+Z undo, Ctrl+Shift+Z redo
- **Zoom:** Ctrl+= and Ctrl+- to zoom in and out, Ctrl+0 to fit width
- **Files and tabs:** Ctrl+O open, Ctrl+W close tab, Ctrl+Tab switch tabs, Ctrl+Shift+E export

## How it's built

The app is split into the usual three Electron layers.

- **Main process (`src/main`):** handles the file dialogs, reading and writing PDFs, and saving everything to the app's user data folder: annotations as JSON, notes as Markdown, the last page and zoom for each file, and the recent files list. Each file is named after a SHA-256 hash of the PDF's path, so the original PDF is never modified. The window uses a custom title bar so the document tabs can sit in it.
- **Preload script (`src/preload`):** exposes a small, typed `window.inkwell` API to the renderer through `contextBridge`. The renderer talks to the main process only through this API, using IPC.
- **Renderer (`src/renderer`):** the React app itself.

Most of the work went into making drawing feel smooth, even on long documents.

- **Three canvas layers per page:** the PDF rendered by PDF.js, the finished strokes, and a separate layer for the stroke you're currently drawing. While you draw, only that small live layer is redrawn, once per animation frame, instead of every stroke on the page.
- **Every pen sample is used:** input comes from pointer events with `getCoalescedEvents()`, which gives every sample the pen reports rather than just one per frame, so fast strokes stay smooth.
- **Strokes:** each stroke is turned into a filled outline with `perfect-freehand` and drawn as a smoothed `Path2D`. Paths are cached, so redrawing at a new zoom is cheap.
- **Only nearby pages render:** pages are rendered lazily. Only pages within a screen's height of what you're looking at are mounted, so a 300-page PDF opens as quickly as a 3-page one.
- **Sharp on high-DPI screens:** pages render at the screen's pixel ratio. While you zoom, the old render is stretched, and a sharp one replaces it once you stop.
- **Per-page updates:** annotation state lives in a small store outside React, and each page subscribes only to its own strokes through `useSyncExternalStore`. Drawing on one page doesn't re-render the others.
- **Text selection:** the text layer comes from PDF.js's `TextLayer`. It's rendered once and scaled with a CSS variable, so it stays lined up with the page at any zoom.
- **Palm rejection:** once a stylus has been used, touch input scrolls instead of drawing.

Strokes are stored in PDF page coordinates, which keeps them lined up at any zoom. Export uses `pdf-lib` to draw each stroke outline into the original PDF. It maps the points back through PDF.js's viewport, which handles rotated and cropped pages, and draws highlighter strokes with a multiply blend mode.

Undo and redo use two stacks of add and remove actions, so undoing an erase puts back exactly the strokes it removed. Saves are debounced: 400 ms for annotations and 500 ms for notes. Pending saves are flushed straight away when you close a tab or switch documents.

The notes editor is Tiptap, with its starter kit and the `tiptap-markdown` extension.

The tooling is electron-vite for development and bundling, and electron-builder to package the Windows NSIS installer.

## Running it

You'll need Node.js.

```
npm install
npm run dev
```

To type-check and build, run `npm run build`. To package the Windows installer into `dist/`, run `npm run dist`.
