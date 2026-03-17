import { generateFAComponents, generateAllFAComponents, getExistingComponentCount } from "./component-gen";
import { autoSwapAll, removeLucideReferences, scanComponentCounts } from "./auto-swap";
import { handleSelectionSwap } from "./manual-swap";

figma.showUI(__html__, { width: 380, height: 600 });

var cachedCounts: { lucide: number; fa6: number } | null = null;

function runScan() {
  figma.ui.postMessage({ type: "init" });
  scanComponentCounts(function (info) {
    figma.ui.postMessage({
      type: "scan-progress",
      page: info.page,
      pageNum: info.pageNum,
      totalPages: info.totalPages,
      lucide: info.lucide,
      fa6: info.fa6,
    });
  }).then(function (counts) {
    cachedCounts = counts;
    figma.ui.postMessage({ type: "scan-complete", lucide: counts.lucide, fa6: counts.fa6 });
  });
}

runScan();

function sendProgress(progress: { current: number; total: number; phase: string; replaced?: number; flagged?: number; skipped?: number; lastSwap?: { from: string; to: string; confidence: string } }) {
  figma.ui.postMessage({
    type: "progress-update",
    current: progress.current,
    total: progress.total,
    phase: progress.phase,
    replaced: progress.replaced,
    flagged: progress.flagged,
    skipped: progress.skipped,
    lastSwap: progress.lastSwap,
  });
}

figma.ui.onmessage = async function (msg: { type: string; payload?: any }) {
  switch (msg.type) {
    case "generate-components": {
      var styles = (msg.payload && msg.payload.styles) || ["Light"];
      figma.ui.postMessage({ type: "progress", phase: "Starting..." });
      var genResult = await generateFAComponents(sendProgress, styles);
      var totalExisting = getExistingComponentCount();
      if (cachedCounts) cachedCounts.fa6 = totalExisting;
      figma.ui.postMessage({
        type: "generate-complete",
        created: genResult.created,
        skipped: genResult.skipped,
        errors: genResult.errors,
        errorDetails: genResult.errorDetails,
        totalExisting: totalExisting,
      });
      if (genResult.created > 0) {
        figma.notify("Created " + genResult.created + " FA6 components");
      } else if (genResult.skipped > 0 && genResult.errors === 0) {
        figma.notify("All components already exist");
      }
      break;
    }

    case "generate-all-components": {
      var allStyles = (msg.payload && msg.payload.styles) || ["Light"];
      figma.ui.postMessage({ type: "progress", phase: "Starting..." });
      var allResult = await generateAllFAComponents(sendProgress, allStyles);
      var totalExistingAll = getExistingComponentCount();
      if (cachedCounts) cachedCounts.fa6 = totalExistingAll;
      figma.ui.postMessage({
        type: "generate-all-complete",
        created: allResult.created,
        skipped: allResult.skipped,
        errors: allResult.errors,
        errorDetails: allResult.errorDetails,
        totalExisting: totalExistingAll,
      });
      if (allResult.created > 0) {
        figma.notify("Created " + allResult.created + " FA6 components");
      } else if (allResult.skipped > 0 && allResult.errors === 0) {
        figma.notify("All components already exist");
      }
      break;
    }

    case "auto-swap": {
      figma.ui.postMessage({ type: "progress", phase: "Scanning..." });
      var swapResult = await autoSwapAll(sendProgress);
      if (cachedCounts) {
        cachedCounts.lucide = cachedCounts.lucide - swapResult.replaced;
        cachedCounts.fa6 = cachedCounts.fa6 + swapResult.replaced;
      }
      figma.ui.postMessage({
        type: "swap-complete",
        replaced: swapResult.replaced,
        flagged: swapResult.flagged,
        skipped: swapResult.skipped,
        flaggedNodeIds: swapResult.flaggedNodeIds,
        skippedItems: swapResult.skippedItems,
      });
      figma.notify(swapResult.replaced + " components replaced. All instances updated.");
      break;
    }

    case "remove-lucide": {
      var removeResult = removeLucideReferences();
      cachedCounts = null;
      figma.ui.postMessage({ type: "remove-lucide-complete", removed: removeResult.removed });
      figma.notify("Removed " + removeResult.removed + " Lucide reference(s)");
      break;
    }

    case "rescan": {
      cachedCounts = null;
      runScan();
      break;
    }

    case "replace-selected": {
      var manualResult = await handleSelectionSwap(msg.payload && msg.payload.overrides);
      figma.ui.postMessage({
        type: "selection-swap-complete",
        replaced: manualResult.replaced,
        skipped: manualResult.skipped,
      });
      break;
    }

    case "select-flagged": {
      var nodeIds = msg.payload && msg.payload.nodeIds;
      if (nodeIds && nodeIds.length) {
        var nodes: SceneNode[] = [];
        for (var i = 0; i < nodeIds.length; i++) {
          var node = figma.getNodeById(nodeIds[i]);
          if (node) nodes.push(node as SceneNode);
        }
        if (nodes.length) {
          figma.currentPage.selection = nodes;
          figma.viewport.scrollAndZoomIntoView(nodes);
        }
      }
      break;
    }
  }
};

figma.on("selectionchange", function () {
  var selection = figma.currentPage.selection;
  var items = selection.map(function (node) {
    var isInstance = node.type === "INSTANCE";
    var mainComp = isInstance ? (node as InstanceNode).mainComponent : null;
    var mainName = mainComp ? mainComp.name : null;
    var isLucide = mainName ? mainName.indexOf("Lucide Icons / ") === 0 : false;
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      isLucide: isLucide,
      lucideName: isLucide && mainName ? mainName.replace("Lucide Icons / ", "") : null,
    };
  });
  figma.ui.postMessage({ type: "selection-changed", items: items });
});
