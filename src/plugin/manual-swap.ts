import iconMap from "../data/icon-map.json";
import fa7Unicode from "../data/fa7-unicode.json";
import { findFAComponent, isBrandIcon, FONT_PRO, FONT_BRANDS } from "./component-gen";
import { extractFillColor } from "./auto-swap";

type IconMapEntry = { fa: string; confidence: string };
type UnicodeMap = Record<string, string>;

type ManualSwapResult = {
  replaced: number;
  skipped: number;
};

export async function handleSelectionSwap(
  overrides?: Record<string, string>
): Promise<ManualSwapResult> {
  var map = iconMap as Record<string, IconMapEntry>;
  var unicodes = fa7Unicode as UnicodeMap;
  var selection = figma.currentPage.selection;
  var result: ManualSwapResult = { replaced: 0, skipped: 0 };

  await figma.loadFontAsync(FONT_PRO);
  await figma.loadFontAsync(FONT_BRANDS);

  for (var idx = 0; idx < selection.length; idx++) {
    var node = selection[idx];
    var faName: string | null = null;

    if (overrides && overrides[node.id]) {
      faName = overrides[node.id];
    } else if (node.type === "INSTANCE") {
      var inst = node as InstanceNode;
      var mainComp = inst.mainComponent;
      if (mainComp && mainComp.name && mainComp.name.indexOf("Lucide Icons / ") === 0) {
        var lucideName = mainComp.name.replace("Lucide Icons / ", "");
        var mapping = map[lucideName];
        if (mapping) faName = mapping.fa;
      }
    } else {
      var cleanName = node.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      var mapping2 = map[cleanName];
      if (mapping2) faName = mapping2.fa;
    }

    if (!faName) {
      result.skipped++;
      continue;
    }

    var faComponent = findFAComponent(faName);

    if (faComponent && node.parent) {
      var parentNode = node.parent;
      var childIndex = parentNode.children.indexOf(node as SceneNode);
      var origX = (node as SceneNode).x;
      var origY = (node as SceneNode).y;
      var origW = (node as SceneNode).width;
      var origH = (node as SceneNode).height;

      var instance = faComponent.createInstance();
      instance.x = origX;
      instance.y = origY;
      instance.resizeWithoutConstraints(origW, origH);

      parentNode.insertChild(childIndex, instance);
      (node as SceneNode).remove();

      result.replaced++;
    } else {
      var unicode = unicodes[faName];
      if (!unicode || !node.parent) {
        result.skipped++;
        continue;
      }

      var parentNode2 = node.parent;
      var childIndex2 = parentNode2.children.indexOf(node as SceneNode);
      var x2 = (node as SceneNode).x;
      var y2 = (node as SceneNode).y;
      var w2 = (node as SceneNode).width;
      var h2 = (node as SceneNode).height;

      var font = isBrandIcon(faName) ? FONT_BRANDS : FONT_PRO;

      var frame = figma.createFrame();
      frame.name = "FA7 / " + faName;
      frame.resizeWithoutConstraints(w2, h2);
      frame.x = x2;
      frame.y = y2;
      frame.layoutMode = "HORIZONTAL";
      frame.primaryAxisAlignItems = "CENTER";
      frame.counterAxisAlignItems = "CENTER";
      frame.fills = [];

      var color = extractFillColor(node) || { r: 0, g: 0, b: 0 };
      var text = figma.createText();
      text.fontName = font;
      text.fontSize = Math.round(Math.min(w2, h2) * 0.8);
      text.characters = String.fromCodePoint(parseInt(unicode, 16));
      text.fills = [{ type: "SOLID", color: color }];
      text.textAlignHorizontal = "CENTER";
      text.textAlignVertical = "CENTER";

      frame.appendChild(text);
      parentNode2.insertChild(childIndex2, frame);
      (node as SceneNode).remove();

      result.replaced++;
    }
  }

  return result;
}
