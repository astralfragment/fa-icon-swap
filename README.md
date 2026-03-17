# FA Icon Swap

Figma plugin that batch-replaces Lucide icon components with Font Awesome 6 Pro equivalents. Modifies main `ComponentNode` definitions so all instances across your file update automatically via Figma's component system.

## Features

- **Auto Swap** - Scans all pages for Lucide icon components, maps them to FA6 equivalents, and replaces the component internals. Every instance in the file updates automatically.
- **Manual Swap** - Select specific icons on canvas and replace them individually with FA6 components or inline glyphs.
- **Component Generation** - Creates FA6 Pro components in your Figma file:
  - ~800 mapped icons (Lucide to FA6 equivalents)
  - All 1,895 FA6 Pro + Brands icons
  - Multiple weight styles: Light, Thin, Regular, Solid
- **Color Preservation** - Extracts the fill color from existing Lucide icons and applies it to the FA6 replacement.
- **Confidence Scoring** - Each mapping has a confidence rating. Low-confidence swaps are flagged so you can review them.
- **Live Progress** - Real-time progress bar with swap log showing each icon replacement as it happens.
- **Scan Caching** - Component counts are cached and updated incrementally to avoid full rescans.
- **Cleanup** - Remove original Lucide icon frames after replacing.

## Prerequisites

- **Font Awesome 6 Pro** installed on your machine (Light, Thin, Regular, and/or Solid)
- **Font Awesome 6 Brands** installed for brand icons (e.g. GitHub, Twitter, etc.)
- Lucide icons in your Figma file must be **component instances** (not flattened vectors)
- Back up your file before running

## How It Works

1. **Generate** FA6 components in your file (creates them on a dedicated page)
2. **Replace** Lucide main components with FA6 glyphs - all instances update automatically
3. **Review** flagged items (low-confidence mappings)
4. **Cleanup** by removing leftover Lucide reference frames

The plugin replaces the internals of each Lucide `ComponentNode` with an FA6 text glyph (unicode codepoint rendered via the FA6 font family). Since Figma's component system propagates changes to all `InstanceNode` references, every usage of that icon updates in place.

## Data

- `src/data/icon-map.json` - Mapping of ~800 Lucide icon names to FA6 equivalents with confidence ratings
- `src/data/fa6-unicode.json` - Unicode codepoints for all 1,895 FA6 icons
- `src/data/fa6-brands.json` - List of FA6 brand icon names (use Brands font family instead of Pro)

## Project Structure

```
fa-icon-swap/
  manifest.json          # Figma plugin manifest
  esbuild.config.js      # Build config - bundles plugin + UI
  src/
    plugin/
      main.ts            # Plugin entry point, message handling
      component-gen.ts   # FA6 component creation
      auto-swap.ts       # Automatic Lucide-to-FA6 replacement
      manual-swap.ts     # Selection-based manual replacement
    ui/
      index.html         # Plugin UI (HTML + CSS)
      ui.ts              # UI logic and message handling
    data/
      icon-map.json      # Lucide -> FA6 name mapping
      fa6-unicode.json   # FA6 icon unicode codepoints
      fa6-brands.json    # FA6 brand icon list
```

## Build

```bash
npm install
npm run build
```

The build produces:
- `dist/code.js` - Plugin sandbox code (ES2017, IIFE)
- `dist/ui.html` - UI with inlined JS (ES2020)

For development with auto-rebuild:

```bash
npm run watch
```

## Install in Figma

1. Build the plugin
2. In Figma: Plugins > Development > Import plugin from manifest
3. Select `manifest.json` from this repo

## Technical Notes

- Plugin code runs in Figma's sandbox (restricted JS, no optional chaining, ES2017 target)
- UI code runs in an iframe, bundled and inlined into the HTML
- Uses `setTimeout(resolve, 0)` yield pattern to prevent Figma UI freezing during batch operations
- Progress updates are batched (every 5 swaps) to avoid message flooding
- Font Awesome icons are rendered as text nodes using unicode codepoints, not SVG paths
