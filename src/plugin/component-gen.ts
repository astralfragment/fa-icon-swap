import iconMap from "../data/icon-map.json";
import fa6Unicode from "../data/fa6-unicode.json";
import fa6Brands from "../data/fa6-brands.json";

var FA_PAGE_NAME = "\u21B3Font Awesome 6 Icons";
var ICON_SIZE = 25;
var GLYPH_SIZE = 20;
var ICON_COLOR: RGB = { r: 0, g: 0, b: 0 };

var FONT_PRO = { family: "Font Awesome 6 Pro", style: "Light" };
var FONT_BRANDS = { family: "Font Awesome 6 Brands", style: "Regular" };

var PRO_STYLES: Record<string, { family: string; style: string }> = {
  "Light": { family: "Font Awesome 6 Pro", style: "Light" },
  "Thin": { family: "Font Awesome 6 Pro", style: "Thin" },
  "Regular": { family: "Font Awesome 6 Pro", style: "Regular" },
  "Solid": { family: "Font Awesome 6 Pro", style: "Solid" },
};

type IconMapEntry = { fa: string; confidence: string };
type UnicodeMap = Record<string, string>;
type ProgressCallback = (progress: { current: number; total: number; phase: string }) => void;
type GenResult = { created: number; skipped: number; errors: number; errorDetails: string[] };

var brandsSet = new Set(fa6Brands as string[]);

function isBrandIcon(name: string): boolean {
  return brandsSet.has(name);
}

function getOrCreatePage(name: string): PageNode {
  var existing = figma.root.children.find(function (p) { return p.name === name; });
  if (existing) return existing;
  var page = figma.createPage();
  page.name = name;

  var pages = figma.root.children;
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].name.indexOf("Lucide") !== -1) {
      figma.root.insertChild(i + 1, page);
      return page;
    }
  }
  return page;
}

function yieldToFigma(): Promise<void> {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

function createIconComponent(
  faName: string,
  unicode: string,
  styleName: string,
  font: { family: string; style: string },
  index: number,
  page: PageNode
): void {
  var suffix = styleName === "Light" ? "" : " / " + styleName;
  var componentName = "FA6 Icons / " + faName + suffix;

  var component = figma.createComponent();
  component.name = componentName;
  component.resizeWithoutConstraints(ICON_SIZE, ICON_SIZE);
  component.layoutMode = "HORIZONTAL";
  component.primaryAxisAlignItems = "CENTER";
  component.counterAxisAlignItems = "CENTER";
  component.fills = [];

  var innerLabel = isBrandIcon(faName)
    ? "family=brands, style=regular, padding=square, scale=1.25x"
    : "family=classic, style=" + styleName.toLowerCase() + ", padding=square, scale=1.25x";

  var inner = figma.createFrame();
  inner.name = innerLabel;
  inner.resizeWithoutConstraints(ICON_SIZE, ICON_SIZE);
  inner.layoutMode = "HORIZONTAL";
  inner.primaryAxisAlignItems = "CENTER";
  inner.counterAxisAlignItems = "CENTER";
  inner.primaryAxisSizingMode = "FIXED";
  inner.counterAxisSizingMode = "FIXED";
  inner.fills = [];

  var text = figma.createText();
  text.fontName = font;
  text.fontSize = GLYPH_SIZE;
  text.characters = String.fromCodePoint(parseInt(unicode, 16));
  text.fills = [{ type: "SOLID", color: ICON_COLOR }];
  text.textAlignHorizontal = "CENTER";
  text.textAlignVertical = "CENTER";
  text.resizeWithoutConstraints(GLYPH_SIZE, GLYPH_SIZE - 1);
  text.textAutoResize = "NONE";

  inner.appendChild(text);
  component.appendChild(inner);

  component.x = (index % 20) * 36;
  component.y = Math.floor(index / 20) * 36;
  page.appendChild(component);
}

async function loadRequiredFonts(
  styles: string[],
  onProgress: ProgressCallback,
  result: GenResult
): Promise<boolean> {
  onProgress({ current: 0, total: 0, phase: "Loading fonts..." });

  try {
    await figma.loadFontAsync(FONT_BRANDS);
  } catch (e) {
    result.errorDetails.push("Font Awesome 6 Brands not found");
    result.errors++;
    onProgress({ current: 0, total: 0, phase: "ERROR: Font Awesome 6 Brands not installed" });
    return false;
  }

  for (var i = 0; i < styles.length; i++) {
    var font = PRO_STYLES[styles[i]];
    if (!font) continue;
    try {
      await figma.loadFontAsync(font);
    } catch (e) {
      result.errorDetails.push(font.family + " " + font.style + " not found");
      result.errors++;
      onProgress({ current: 0, total: 0, phase: "ERROR: " + font.family + " " + font.style + " not installed" });
      return false;
    }
  }
  return true;
}

async function generateFromNames(
  names: string[],
  unicodes: UnicodeMap,
  styles: string[],
  onProgress: ProgressCallback
): Promise<GenResult> {
  var result: GenResult = { created: 0, skipped: 0, errors: 0, errorDetails: [] };
  if (!(await loadRequiredFonts(styles, onProgress, result))) return result;

  var page = getOrCreatePage(FA_PAGE_NAME);
  var existingNames = new Set<string>();
  page.children.forEach(function (node) {
    if (node.type === "COMPONENT") existingNames.add(node.name);
  });

  var total = names.length * styles.length;
  onProgress({ current: 0, total: total, phase: "Creating " + total + " components..." });
  var processed = 0;

  for (var s = 0; s < styles.length; s++) {
    var styleName = styles[s];
    var proFont = PRO_STYLES[styleName];

    for (var i = 0; i < names.length; i++) {
      var faName = names[i];
      processed++;

      var isBrand = isBrandIcon(faName);
      if (isBrand && s > 0) { result.skipped++; continue; }

      var suffix = styleName === "Light" ? "" : " / " + styleName;
      var componentName = "FA6 Icons / " + faName + suffix;
      if (existingNames.has(componentName)) { result.skipped++; continue; }

      var unicode = unicodes[faName];
      if (!unicode) { result.skipped++; continue; }

      var font = isBrand ? FONT_BRANDS : proFont;

      try {
        createIconComponent(faName, unicode, styleName, font, result.created, page);
        result.created++;
      } catch (e) {
        result.errors++;
        result.errorDetails.push(faName + " (" + styleName + "): " + String(e));
      }

      if (processed % 10 === 0) {
        onProgress({ current: processed, total: total, phase: processed + "/" + total + " (" + styleName + ")" });
        await yieldToFigma();
      }
    }
  }

  onProgress({ current: total, total: total, phase: "Done" });
  return result;
}

export async function generateFAComponents(onProgress: ProgressCallback, styles: string[]): Promise<GenResult> {
  var map = iconMap as Record<string, IconMapEntry>;
  var unicodes = fa6Unicode as UnicodeMap;
  var faNames = new Set<string>();
  for (var key in map) { faNames.add(map[key].fa); }
  return generateFromNames(Array.from(faNames), unicodes, styles, onProgress);
}

export async function generateAllFAComponents(onProgress: ProgressCallback, styles: string[]): Promise<GenResult> {
  var unicodes = fa6Unicode as UnicodeMap;
  return generateFromNames(Object.keys(unicodes), unicodes, styles, onProgress);
}

export function getExistingComponentCount(): number {
  var page = figma.root.children.find(function (p) { return p.name === FA_PAGE_NAME; });
  if (!page) return 0;
  var count = 0;
  page.children.forEach(function (n) { if (n.type === "COMPONENT") count++; });
  return count;
}

export function findFAComponent(faName: string): ComponentNode | null {
  var page = figma.root.children.find(function (p) { return p.name === FA_PAGE_NAME; });
  if (!page) return null;
  var found = page.children.find(function (n) {
    return n.type === "COMPONENT" && n.name === "FA6 Icons / " + faName;
  });
  return (found as ComponentNode) || null;
}

export { isBrandIcon, FONT_PRO, FONT_BRANDS };
