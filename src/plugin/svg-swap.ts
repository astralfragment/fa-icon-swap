import fa7Unicode from "../data/fa7-unicode.json";
import { isBrandIcon, FONT_PRO, FONT_BRANDS } from "./component-gen";
import { extractFillColor } from "./auto-swap";

type UnicodeMap = Record<string, string>;

var fa7Names = new Set(Object.keys(fa7Unicode as UnicodeMap));

type SvgSwapProgressCallback = (progress: {
  current: number;
  total: number;
  phase: string;
  replaced?: number;
  skipped?: number;
}) => void;

type SvgSwapResult = {
  replaced: number;
  skipped: number;
  skippedItems: { name: string; reason: string }[];
};

function yieldToFigma(): Promise<void> {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

function normalizeFaName(raw: string): string {
  var name = raw.toLowerCase().trim();
  name = name.replace(/^(fa[srltkbd]?|fa-solid|fa-regular|fa-light|fa-thin|fa-brands|fa-duotone)[-_ ]?/i, "");
  name = name.replace(/^(fa[-_ ])/i, "");
  name = name.replace(/[^a-z0-9-]/g, "-");
  name = name.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return name;
}

function hasOnlyVectorChildren(node: SceneNode & ChildrenMixin): boolean {
  if (node.children.length === 0) return false;
  for (var i = 0; i < node.children.length; i++) {
    var child = node.children[i];
    if (child.type === "TEXT") return false;
    if (child.type !== "VECTOR" && child.type !== "BOOLEAN_OPERATION" && child.type !== "LINE" && child.type !== "ELLIPSE" && child.type !== "RECTANGLE" && child.type !== "POLYGON" && child.type !== "STAR") {
      if ("children" in child) {
        if (!hasOnlyVectorChildren(child as SceneNode & ChildrenMixin)) return false;
      } else {
        return false;
      }
    }
  }
  return true;
}

function matchNodeToFaIcon(node: SceneNode): string | null {
  var normalized = normalizeFaName(node.name);
  if (normalized && fa7Names.has(normalized)) return normalized;

  var parts = node.name.split("/");
  for (var i = parts.length - 1; i >= 0; i--) {
    var part = normalizeFaName(parts[i].trim());
    if (part && fa7Names.has(part)) return part;
  }

  return null;
}

async function findSvgFaNodes(onProgress?: SvgSwapProgressCallback): Promise<{ node: SceneNode; faName: string }[]> {
  var results: { node: SceneNode; faName: string }[] = [];
  for (var p = 0; p < figma.root.children.length; p++) {
    if (onProgress) {
      onProgress({ current: p, total: figma.root.children.length, phase: "Scanning page " + (p + 1) + "..." });
    }
    var page = figma.root.children[p];
    if (page.name.indexOf("\u21B3Font Awesome") === 0) continue;

    var nodes = page.findAll(function (n) {
      if (n.type !== "FRAME" && n.type !== "GROUP" && n.type !== "COMPONENT") return false;
      if (n.name.indexOf("FA7 Icons / ") === 0 || n.name.indexOf("FA6 Icons / ") === 0) return false;
      if (n.name.indexOf("Lucide Icons / ") === 0) return false;
      if (!("children" in n)) return false;
      return hasOnlyVectorChildren(n as SceneNode & ChildrenMixin);
    });

    for (var j = 0; j < nodes.length; j++) {
      var faName = matchNodeToFaIcon(nodes[j]);
      if (faName) {
        results.push({ node: nodes[j], faName: faName });
      }
    }

    await yieldToFigma();
  }
  return results;
}

export async function replaceSvgIcons(onProgress: SvgSwapProgressCallback): Promise<SvgSwapResult> {
  var unicodes = fa7Unicode as UnicodeMap;
  var result: SvgSwapResult = { replaced: 0, skipped: 0, skippedItems: [] };

  onProgress({ current: 0, total: 0, phase: "Loading fonts..." });
  await Promise.all([figma.loadFontAsync(FONT_PRO), figma.loadFontAsync(FONT_BRANDS)]);

  var svgNodes = await findSvgFaNodes(onProgress);
  var total = svgNodes.length;
  onProgress({ current: 0, total: total, phase: "Found " + total + " SVG FA icons" });

  for (var i = 0; i < svgNodes.length; i++) {
    try {
      var entry = svgNodes[i];
      var node = entry.node;
      var faName = entry.faName;
      var unicode = unicodes[faName];

      if (!unicode) {
        result.skipped++;
        result.skippedItems.push({ name: node.name, reason: "no unicode for " + faName });
        continue;
      }

      var font = isBrandIcon(faName) ? FONT_BRANDS : FONT_PRO;
      var color = extractFillColor(node) || { r: 0, g: 0, b: 0 };
      var w = (node as SceneNode).width;
      var h = (node as SceneNode).height;

      if (node.type === "COMPONENT") {
        while ((node as ComponentNode).children.length > 0) {
          (node as ComponentNode).children[0].remove();
        }

        node.name = "FA7 Icons / " + faName + " (was: svg/" + normalizeFaName(node.name) + ")";
        (node as ComponentNode).layoutMode = "HORIZONTAL";
        (node as ComponentNode).primaryAxisAlignItems = "CENTER";
        (node as ComponentNode).counterAxisAlignItems = "CENTER";

        var inner = figma.createFrame();
        inner.name = "family=classic, style=light, padding=square, scale=1.25x";
        inner.resizeWithoutConstraints(w, h);
        inner.layoutMode = "HORIZONTAL";
        inner.primaryAxisAlignItems = "CENTER";
        inner.counterAxisAlignItems = "CENTER";
        inner.primaryAxisSizingMode = "FIXED";
        inner.counterAxisSizingMode = "FIXED";
        inner.fills = [];

        var glyphSize = Math.round(Math.min(w, h) * 0.8);
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
        (node as ComponentNode).appendChild(inner);
      } else {
        var parentNode = node.parent;
        if (!parentNode) {
          result.skipped++;
          result.skippedItems.push({ name: node.name, reason: "no parent" });
          continue;
        }
        var childIndex = parentNode.children.indexOf(node as SceneNode);
        var x = (node as SceneNode).x;
        var y = (node as SceneNode).y;

        var frame = figma.createFrame();
        frame.name = "FA7 / " + faName;
        frame.resizeWithoutConstraints(w, h);
        frame.x = x;
        frame.y = y;
        frame.layoutMode = "HORIZONTAL";
        frame.primaryAxisAlignItems = "CENTER";
        frame.counterAxisAlignItems = "CENTER";
        frame.fills = [];

        var gSize = Math.round(Math.min(w, h) * 0.8);
        var textNode = figma.createText();
        textNode.fontName = font;
        textNode.fontSize = gSize;
        textNode.characters = String.fromCodePoint(parseInt(unicode, 16));
        textNode.fills = [{ type: "SOLID", color: color }];
        textNode.textAlignHorizontal = "CENTER";
        textNode.textAlignVertical = "CENTER";

        frame.appendChild(textNode);
        parentNode.insertChild(childIndex, frame);
        (node as SceneNode).remove();
      }

      result.replaced++;
    } catch (e) {
      result.skipped++;
      result.skippedItems.push({ name: "node-" + i, reason: "error: " + String(e) });
    }

    if ((i + 1) % 5 === 0 || i === svgNodes.length - 1) {
      onProgress({
        current: i + 1, total: total,
        phase: (i + 1) + "/" + total,
        replaced: result.replaced, skipped: result.skipped,
      });
      await yieldToFigma();
    }
  }

  onProgress({ current: total, total: total, phase: "Complete" });
  return result;
}

export async function countSvgFaIcons(): Promise<number> {
  var count = 0;
  for (var p = 0; p < figma.root.children.length; p++) {
    var page = figma.root.children[p];
    if (page.name.indexOf("\u21B3Font Awesome") === 0) continue;
    var nodes = page.findAll(function (n) {
      if (n.type !== "FRAME" && n.type !== "GROUP" && n.type !== "COMPONENT") return false;
      if (n.name.indexOf("FA7 Icons / ") === 0 || n.name.indexOf("FA6 Icons / ") === 0) return false;
      if (n.name.indexOf("Lucide Icons / ") === 0) return false;
      if (!("children" in n)) return false;
      if (!hasOnlyVectorChildren(n as SceneNode & ChildrenMixin)) return false;
      return matchNodeToFaIcon(n) !== null;
    });
    count += nodes.length;
  }
  return count;
}
