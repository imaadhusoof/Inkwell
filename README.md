# Inkwell

A desktop app for annotating PDFs and taking notes alongside them, built with Electron, React and TypeScript. Everything is saved locally on your own machine, with no account or cloud.

You can download the Windows installer from the [latest release](https://github.com/imaadhusoof/Inkwell/releases/latest).

## What it does

- **Open PDFs:** you can open several PDFs and switch between them from the sidebar. Every page is rendered in one scrollable view.
- **Pen:** freehand drawing in five colours, with an adjustable size from 1 to 40. With a stylus, the stroke width follows your pen pressure. With a mouse, the width is simulated from how fast you move instead.
- **Highlighter:** a wider stroke (18) at 35% opacity with an even width, so it doesn't taper like the pen.
- **Eraser:** removes any stroke you drag over, within a 12 px radius.
- **Undo and redo:** covers both drawing and erasing.
- **Notes panel:** a rich-text editor beside the PDF that saves your notes as Markdown.
- **Auto-save:** annotations and notes save automatically and load again when you reopen the same PDF.

## How it's built

The app is split into the usual three Electron layers.

- **Main process (`src/main`):** opens the file dialog, reads the PDF from disk, and saves your work. Annotations are saved as JSON and notes as Markdown in the app's user data folder. Each file is named after a SHA-256 hash of the PDF's path, so the original PDF is never modified.
- **Preload script (`src/preload`):** exposes a small, typed `window.inkwell` API to the renderer through `contextBridge`. The renderer talks to the main process only through this API, using IPC.
- **Renderer (`src/renderer`):** the React app itself.

Each page is two canvases stacked on top of each other. The bottom one shows the page as rendered by PDF.js at 1.4× scale. The top one handles pointer events and draws the annotations.

Strokes are stored in page coordinates, which means dividing by the zoom scale. This keeps them lined up with the PDF at any zoom level. Each stroke is turned into a filled outline with `perfect-freehand`, which is what gives the pen its smooth, pressure-sensitive look.

Annotation state lives in a React context. Undo and redo use two stacks of add and remove actions, so undoing an erase puts back exactly the strokes it removed. Changes are debounced before saving to disk: 400 ms for annotations and 500 ms for notes. That way you're not writing a file on every stroke or keystroke.

The notes editor is Tiptap, with its starter kit and the `tiptap-markdown` extension.

The tooling is electron-vite for development and bundling, and electron-builder to package the Windows NSIS installer.

## Running it

You'll need Node.js.

```
npm install
npm run dev
```

To type-check and build, run `npm run build`. To package the Windows installer into `dist/`, run `npm run dist`.
