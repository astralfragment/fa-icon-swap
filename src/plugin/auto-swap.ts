import iconMap from "../data/icon-map.json";
import fa7Unicode from "../data/fa7-unicode.json";
import { isBrandIcon, FONT_PRO, FONT_BRANDS } from "./component-gen";

type IconMapEntry = { fa: string; confidence: string };
type UnicodeMap = Record<string, string>;

var faNameList: string[] = Object.keys(fa7Unicode as UnicodeMap);
var faNameSet: Set<string> = new Set(faNameList);
var fuzzyCache: Record<string, { fa: string; confidence: string } | null> = {};

var faWordIndex: Record<string, string[]> = {};
for (var _i = 0; _i < faNameList.length; _i++) {
  var _words = faNameList[_i].split("-");
  for (var _w = 0; _w < _words.length; _w++) {
    if (!faWordIndex[_words[_w]]) faWordIndex[_words[_w]] = [];
    faWordIndex[_words[_w]].push(faNameList[_i]);
  }
}

function wordOverlapScore(a: string[], b: string[]): number {
  var matches = 0;
  for (var i = 0; i < a.length; i++) {
    for (var j = 0; j < b.length; j++) {
      if (a[i] === b[j]) { matches++; break; }
    }
  }
  if (a.length === 0 && b.length === 0) return 0;
  return matches / Math.max(a.length, b.length);
}

function editDistance(a: string, b: string): number {
  var m = a.length;
  var n = b.length;
  if (Math.abs(m - n) > Math.max(m, n) * 0.4) return Math.max(m, n);
  var prev = new Array(n + 1);
  var curr = new Array(n + 1);
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    curr[0] = i;
    for (var j2 = 1; j2 <= n; j2++) {
      var cost = a[i - 1] === b[j2 - 1] ? 0 : 1;
      curr[j2] = Math.min(prev[j2] + 1, curr[j2 - 1] + 1, prev[j2 - 1] + cost);
    }
    var tmp = prev; prev = curr; curr = tmp;
  }
  return prev[n];
}

function findBestMatch(lucideName: string): { fa: string; confidence: string } | null {
  if (fuzzyCache[lucideName] !== undefined) return fuzzyCache[lucideName];

  if (faNameSet.has(lucideName)) {
    fuzzyCache[lucideName] = { fa: lucideName, confidence: "high" };
    return fuzzyCache[lucideName];
  }

  var lucideWords = lucideName.split("-").filter(function (w) { return w.length > 0; });

  var candidates: Record<string, boolean> = {};
  for (var w = 0; w < lucideWords.length; w++) {
    var matches = faWordIndex[lucideWords[w]];
    if (matches) {
      for (var ci = 0; ci < matches.length; ci++) candidates[matches[ci]] = true;
    }
  }

  var candidateList = Object.keys(candidates);
  var bestName = "";
  var bestScore = -1;
  for (var i = 0; i < candidateList.length; i++) {
    var faWords = candidateList[i].split("-");
    var overlap = wordOverlapScore(lucideWords, faWords);
    if (overlap > bestScore) { bestScore = overlap; bestName = candidateList[i]; }
  }

  if (bestScore >= 0.5) {
    fuzzyCache[lucideName] = { fa: bestName, confidence: "low" };
    return fuzzyCache[lucideName];
  }

  var closestDist = Infinity;
  var closestName = "";
  for (var i2 = 0; i2 < faNameList.length; i2++) {
    var dist = editDistance(lucideName, faNameList[i2]);
    if (dist < closestDist) { closestDist = dist; closestName = faNameList[i2]; }
  }

  var maxLen = Math.max(lucideName.length, closestName.length);
  if (maxLen > 0 && closestDist / maxLen <= 0.4) {
    fuzzyCache[lucideName] = { fa: closestName, confidence: "low" };
  } else {
    fuzzyCache[lucideName] = null;
  }
  return fuzzyCache[lucideName];
}

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

async function findLucideMainComponents(onProgress?: ProgressCallback): Promise<ComponentNode[]> {
  var results: ComponentNode[] = [];
  for (var i = 0; i < figma.root.children.length; i++) {
    if (onProgress) {
      onProgress({ current: i, total: figma.root.children.length, phase: "Scanning page " + (i + 1) + "/" + figma.root.children.length + "..." });
    }
    var components = figma.root.children[i].findAllWithCriteria({ types: ["COMPONENT"] });
    for (var j = 0; j < components.length; j++) {
      if (components[j].name.indexOf("Lucide Icons / ") === 0) {
        results.push(components[j] as ComponentNode);
      }
    }
    await yieldToFigma();
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
  component.name = "FA7 Icons / " + faName + " (was: " + lucideName + ")";
  component.layoutMode = "HORIZONTAL";
  component.primaryAxisAlignItems = "CENTER";
  component.counterAxisAlignItems = "CENTER";

  var inner = figma.createFrame();
  inner.name = styleName;
  inner.resizeWithoutConstraints(component.width, component.height);
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
  text.resizeWithoutConstraints(glyphSize, glyphSize);
  text.textAutoResize = "NONE";

  inner.appendChild(text);
  component.appendChild(inner);
}

type ScanCallback = (info: { page: string; pageNum: number; totalPages: number; lucide: number; fa6: number; fa7: number }) => void;

export async function scanComponentCounts(onProgress?: ScanCallback): Promise<{ lucide: number; fa6: number; fa7: number }> {
  var lucideNames = new Set<string>();
  var fa6Names = new Set<string>();
  var fa7Names = new Set<string>();
  var totalPages = figma.root.children.length;

  for (var i = 0; i < totalPages; i++) {
    var page = figma.root.children[i];
    if (onProgress) {
      onProgress({ page: page.name, pageNum: i + 1, totalPages: totalPages, lucide: lucideNames.size, fa6: fa6Names.size, fa7: fa7Names.size });
    }

    var components = page.findAllWithCriteria({ types: ["COMPONENT"] });
    for (var j = 0; j < components.length; j++) {
      var name = components[j].name;
      if (name.indexOf("Lucide Icons / ") === 0) {
        lucideNames.add(name.replace("Lucide Icons / ", ""));
      } else if (name.indexOf("FA7 Icons / ") === 0) {
        var baseName7 = name.replace("FA7 Icons / ", "").replace(/ \/ (Light|Thin|Regular|Solid)$/, "").replace(/ \(was: [^)]+\)$/, "");
        fa7Names.add(baseName7);
      } else if (name.indexOf("FA6 Icons / ") === 0) {
        var baseName6 = name.replace("FA6 Icons / ", "").replace(/ \/ (Light|Thin|Regular|Solid)$/, "").replace(/ \(was: [^)]+\)$/, "");
        fa6Names.add(baseName6);
      }
    }

    await yieldToFigma();
  }

  return { lucide: lucideNames.size, fa6: fa6Names.size, fa7: fa7Names.size };
}

export async function autoSwapAll(onProgress: ProgressCallback): Promise<SwapResult> {
  var map = iconMap as Record<string, IconMapEntry>;
  var unicodes = fa7Unicode as UnicodeMap;
  var result: SwapResult = { replaced: 0, flagged: 0, skipped: 0, flaggedNodeIds: [], skippedItems: [] };

  onProgress({ current: 0, total: 0, phase: "Loading fonts..." });
  await Promise.all([figma.loadFontAsync(FONT_PRO), figma.loadFontAsync(FONT_BRANDS)]);

  var lucideComponents = await findLucideMainComponents(onProgress);
  var total = lucideComponents.length;

  onProgress({ current: 0, total: total, phase: "Found " + total + " Lucide main components" });

  for (var i = 0; i < lucideComponents.length; i++) {
    try {
      var component = lucideComponents[i];
      var lucideName = component.name.replace("Lucide Icons / ", "");
      var mapping: IconMapEntry | null = map[lucideName] || null;

      if (!mapping) {
        mapping = findBestMatch(lucideName);
      }

      if (!mapping) {
        result.skipped++;
        result.skippedItems.push({ name: lucideName, reason: "no match found" });
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
    } catch (e) {
      result.skipped++;
      result.skippedItems.push({ name: "node-" + i, reason: "error: " + String(e) });
    }

    if ((i + 1) % 5 === 0 || i === lucideComponents.length - 1) {
      onProgress({
        current: i + 1, total: total,
        phase: (i + 1) + "/" + total,
        replaced: result.replaced, flagged: result.flagged, skipped: result.skipped,
      });
      await yieldToFigma();
    }
  }

  onProgress({ current: total, total: total, phase: "Complete" });
  return result;
}

export async function removeLucideReferences(
  onProgress: (info: { page: string; pageNum: number; totalPages: number; cleaned: number }) => void
): Promise<{ cleaned: number }> {
  var cleaned = 0;
  var totalPages = figma.root.children.length;
  var wasPattern = / \(was: [^)]+\)$/;

  for (var p = 0; p < totalPages; p++) {
    var page = figma.root.children[p];
    onProgress({ page: page.name, pageNum: p + 1, totalPages: totalPages, cleaned: cleaned });

    var components = page.findAllWithCriteria({ types: ["COMPONENT"] });
    for (var j = 0; j < components.length; j++) {
      var comp = components[j];
      if (wasPattern.test(comp.name)) {
        comp.name = comp.name.replace(wasPattern, "");
        cleaned++;
      }
    }

    await yieldToFigma();
  }

  return { cleaned: cleaned };
}
