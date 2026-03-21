import fa7Unicode from "../data/fa7-unicode.json";
import fa6ToFa7Renames from "../data/fa6-to-fa7-renames.json";
import { isBrandIcon, FONT_PRO, FONT_BRANDS } from "./component-gen";
import { extractFillColor } from "./auto-swap";

type UnicodeMap = Record<string, string>;
type RenameMap = Record<string, string>;

type UpgradeProgressCallback = (progress: {
  current: number;
  total: number;
  phase: string;
  upgraded?: number;
  skipped?: number;
  renamed?: number;
}) => void;

type UpgradeResult = {
  upgraded: number;
  skipped: number;
  renamed: number;
  skippedItems: { name: string; reason: string }[];
};

function yieldToFigma(): Promise<void> {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

async function findFA6Components(onProgress?: UpgradeProgressCallback): Promise<ComponentNode[]> {
  var results: ComponentNode[] = [];
  for (var i = 0; i < figma.root.children.length; i++) {
    if (onProgress) {
      onProgress({ current: i, total: figma.root.children.length, phase: "Scanning page " + (i + 1) + "..." });
    }
    var components = figma.root.children[i].findAllWithCriteria({ types: ["COMPONENT"] });
    for (var j = 0; j < components.length; j++) {
      if (components[j].name.indexOf("FA6 Icons / ") === 0) {
        results.push(components[j] as ComponentNode);
      }
    }
    await yieldToFigma();
  }
  return results;
}

function extractFaNameFromComponent(name: string): string {
  var stripped = name.replace("FA6 Icons / ", "");
  stripped = stripped.replace(/ \(was: [^)]+\)$/, "");
  stripped = stripped.replace(/ \/ (Light|Thin|Regular|Solid)$/, "");
  return stripped;
}

export async function upgradeFa6ToFa7(onProgress: UpgradeProgressCallback): Promise<UpgradeResult> {
  var unicodes = fa7Unicode as UnicodeMap;
  var renames = fa6ToFa7Renames as RenameMap;
  var result: UpgradeResult = { upgraded: 0, skipped: 0, renamed: 0, skippedItems: [] };

  onProgress({ current: 0, total: 0, phase: "Loading fonts..." });
  await Promise.all([figma.loadFontAsync(FONT_PRO), figma.loadFontAsync(FONT_BRANDS)]);

  var fa6Components = await findFA6Components(onProgress);
  var total = fa6Components.length;
  onProgress({ current: 0, total: total, phase: "Found " + total + " FA6 components" });

  for (var i = 0; i < fa6Components.length; i++) {
    try {
      var component = fa6Components[i];
      var fa6Name = extractFaNameFromComponent(component.name);
      var fa7Name = renames[fa6Name] || fa6Name;
      var wasRenamed = fa7Name !== fa6Name;

      var unicode = unicodes[fa7Name];
      if (!unicode) {
        result.skipped++;
        result.skippedItems.push({ name: fa6Name, reason: "no FA7 unicode for " + fa7Name });
        continue;
      }

      var font = isBrandIcon(fa7Name) ? FONT_BRANDS : FONT_PRO;
      var color = extractFillColor(component) || { r: 0, g: 0, b: 0 };
      var styleSuffix = "";
      var styleMatch = component.name.match(/ \/ (Light|Thin|Regular|Solid)$/);
      if (styleMatch) styleSuffix = " / " + styleMatch[1];

      while (component.children.length > 0) {
        component.children[0].remove();
      }

      var newName = "FA7 Icons / " + fa7Name + styleSuffix;
      if (wasRenamed) {
        newName += " (was: FA6/" + fa6Name + ")";
        result.renamed++;
      }
      component.name = newName;
      component.layoutMode = "HORIZONTAL";
      component.primaryAxisAlignItems = "CENTER";
      component.counterAxisAlignItems = "CENTER";

      var innerLabel = isBrandIcon(fa7Name)
        ? "family=brands, style=regular, padding=square, scale=1.25x"
        : "family=classic, style=light, padding=square, scale=1.25x";

      var inner = figma.createFrame();
      inner.name = innerLabel;
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
      result.upgraded++;
    } catch (e) {
      result.skipped++;
      result.skippedItems.push({ name: "node-" + i, reason: "error: " + String(e) });
    }

    if ((i + 1) % 5 === 0 || i === fa6Components.length - 1) {
      onProgress({
        current: i + 1, total: total,
        phase: (i + 1) + "/" + total,
        upgraded: result.upgraded, skipped: result.skipped, renamed: result.renamed,
      });
      await yieldToFigma();
    }
  }

  onProgress({ current: total, total: total, phase: "Complete" });
  return result;
}
