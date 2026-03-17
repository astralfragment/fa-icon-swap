import iconMap from "../data/icon-map.json";
import fa6Unicode from "../data/fa6-unicode.json";
import { isBrandIcon, FONT_PRO, FONT_BRANDS } from "./component-gen";

type IconMapEntry = { fa: string; confidence: string };
type UnicodeMap = Record<string, string>;
type ProgressCallback = (progress: {
  current: number;
  total: number;
  phase: string;
  replaced?: number;
  flagged?: number;
  skipped?: number;
  lastSwap?: { from: string; to: string; confidence: string };
}) => void;

type SkippedEntry = { name: string; reason: string };

type SwapResult = {
  replaced: number;
  flagged: number;
  skipped: number;
  flaggedNodeIds: string[];
  skippedItems: SkippedEntry[];
};

function yieldToFigma(): Promise<void> {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}

function findLucideMainComponents(): ComponentNode[] {
  var results: ComponentNode[] = [];
  for (var i = 0; i < figma.root.children.length; i++) {
    var components = figma.root.children[i].findAllWithCriteria({ types: ["COMPONENT"] });
    for (var j = 0; j < components.length; j++) {
      if (components[j].name.indexOf("Lucide Icons / ") === 0) {
        results.push(components[j] as ComponentNode);
      }
    }
  }
  return results;
}

var DEFAULT_COLOR: RGB = { r: 0, g: 0, b: 0 };

export function extractFillColor(node: BaseNode): RGB | null {
  if ("fills" in node) {
    var fills = (node as GeometryMixin).fills;
    if (Array.isArray(fills)) {
      for (var f = 0; f < fills.length; f++) {
        if (fills[f].type === "SOLID" && fills[f].visible !== false) {
          return (fills[f] as SolidPaint).color;
        }
      }
    }
  }
  if ("children" in node) {
    var children = (node as ChildrenMixin).children;
    for (var c = 0; c < children.length; c++) {
      var found = extractFillColor(children[c]);
      if (found) return found;
    }
  }
  return null;
}

function replaceComponentInternals(
  component: ComponentNode,
  faName: string,
  unicode: string
): void {
  var font = isBrandIcon(faName) ? FONT_BRANDS : FONT_PRO;
  var styleName = isBrandIcon(faName)
    ? "family=brands, style=regular, padding=square, scale=1.25x"
    : "family=classic, style=light, padding=square, scale=1.25x";

  var color = extractFillColor(component) || DEFAULT_COLOR;

  while (component.children.length > 0) {
    component.children[0].remove();
  }

  var lucideName = component.name.replace("Lucide Icons / ", "");
  component.name = "FA6 Icons / " + faName + " (was: " + lucideName + ")";
  component.layoutMode = "HORIZONTAL";
  component.primaryAxisAlignItems = "CENTER";
  component.counterAxisAlignItems = "CENTER";

  var inner = figma.createFrame();
  inner.name = styleName;
  inner.resize(component.width, component.height);
  inner.layoutMode = "HORIZONTAL";
  inner.primaryAxisAlignItems = "CENTER";
  inner.counterAxisAlignItems = "CENTER";
  inner.primaryAxisSizingMode = "FIXED";
  inner.counterAxisSizingMode = "FIXED";
  inner.fills = [];

  var glyphSize = Math.round(Math.min(component.width, component.height) * 0.8);
  var text = figma.createText();
  text.fontName = font;
  text.fontSize = glyphSize;
  text.characters = String.fromCodePoint(parseInt(unicode, 16));
  text.fills = [{ type: "SOLID", color: color }];
  text.textAlignHorizontal = "CENTER";
  text.textAlignVertical = "CENTER";
  text.resize(glyphSize, glyphSize);
  text.textAutoResize = "NONE";

  inner.appendChild(text);
  component.appendChild(inner);
}

type ScanCallback = (info: { page: string; pageNum: number; totalPages: number; lucide: number; fa6: number }) => void;

export async function scanComponentCounts(onProgress?: ScanCallback): Promise<{ lucide: number; fa6: number }> {
  var lucide = 0;
  var fa6 = 0;
  var totalPages = figma.root.children.length;

  for (var i = 0; i < totalPages; i++) {
    var page = figma.root.children[i];
    if (onProgress) {
      onProgress({ page: page.name, pageNum: i + 1, totalPages: totalPages, lucide: lucide, fa6: fa6 });
    }

    var components = page.findAllWithCriteria({ types: ["COMPONENT"] });
    for (var j = 0; j < components.length; j++) {
      var name = components[j].name;
      if (name.indexOf("Lucide Icons / ") === 0) {
        lucide++;
      } else if (name.indexOf("FA6 Icons / ") === 0) {
        fa6++;
      }
    }

    await yieldToFigma();
  }

  return { lucide: lucide, fa6: fa6 };
}

export async function autoSwapAll(onProgress: ProgressCallback): Promise<SwapResult> {
  var map = iconMap as Record<string, IconMapEntry>;
  var unicodes = fa6Unicode as UnicodeMap;
  var result: SwapResult = { replaced: 0, flagged: 0, skipped: 0, flaggedNodeIds: [], skippedItems: [] };

  onProgress({ current: 0, total: 0, phase: "Loading fonts..." });
  await figma.loadFontAsync(FONT_PRO);
  await figma.loadFontAsync(FONT_BRANDS);

  onProgress({ current: 0, total: 0, phase: "Finding Lucide components..." });
  var lucideComponents = findLucideMainComponents();
  var total = lucideComponents.length;

  onProgress({ current: 0, total: total, phase: "Found " + total + " Lucide main components" });

  for (var i = 0; i < lucideComponents.length; i++) {
    var component = lucideComponents[i];
    var lucideName = component.name.replace("Lucide Icons / ", "");
    var mapping = map[lucideName];

    if (!mapping) {
      result.skipped++;
      result.skippedItems.push({ name: lucideName, reason: "no mapping" });
      if ((i + 1) % 10 === 0) {
        onProgress({
          current: i + 1, total: total,
          phase: (i + 1) + "/" + total,
          replaced: result.replaced, flagged: result.flagged, skipped: result.skipped,
        });
        await yieldToFigma();
      }
      continue;
    }

    var unicode = unicodes[mapping.fa];
    if (!unicode) {
      result.skipped++;
      result.skippedItems.push({ name: lucideName, reason: "no unicode for " + mapping.fa });
      continue;
    }

    replaceComponentInternals(component, mapping.fa, unicode);
    result.replaced++;

    if (mapping.confidence === "low") {
      result.flagged++;
      result.flaggedNodeIds.push(component.id);
    }

    if ((i + 1) % 5 === 0 || i === lucideComponents.length - 1) {
      onProgress({
        current: i + 1, total: total,
        phase: (i + 1) + "/" + total,
        replaced: result.replaced, flagged: result.flagged, skipped: result.skipped,
        lastSwap: { from: lucideName, to: mapping.fa, confidence: mapping.confidence },
      });
      await yieldToFigma();
    }
  }

  onProgress({ current: total, total: total, phase: "Complete" });
  return result;
}

export function removeLucideReferences(): { removed: number } {
  var removed = 0;

  for (var p = 0; p < figma.root.children.length; p++) {
    var page = figma.root.children[p];
    var toRemove: SceneNode[] = [];

    function walkForRemoval(node: BaseNode) {
      if (node.type === "FRAME" || node.type === "GROUP") {
        var name = node.name;
        if (name === "Lucide Icon" || name === "Lucide Icons" || name.indexOf("Lucide Icons") === 0) {
          toRemove.push(node as SceneNode);
          return;
        }
      }
      if ("children" in node) {
        var children = (node as ChildrenMixin).children;
        for (var i = 0; i < children.length; i++) {
          walkForRemoval(children[i]);
        }
      }
    }

    walkForRemoval(page);

    for (var r = 0; r < toRemove.length; r++) {
      toRemove[r].remove();
      removed++;
    }
  }

  return { removed: removed };
}
