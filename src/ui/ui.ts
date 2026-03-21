document.querySelectorAll(".tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
    document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("active"); });
    tab.classList.add("active");
    var panel = document.getElementById((tab as HTMLElement).dataset.tab + "-panel");
    if (panel) panel.classList.add("active");
  });
});

var componentsGenerated = false;
var flaggedNodeIds: string[] = [];
var selectionItems: any[] = [];
var overrides: Record<string, string> = {};

function esc(str: string): string {
  var d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

var btnGenerate = document.getElementById("btn-generate") as HTMLButtonElement;
var btnGenerateAll = document.getElementById("btn-generate-all") as HTMLButtonElement;
var btnSwap = document.getElementById("btn-swap") as HTMLButtonElement;
var btnRemoveLucide = document.getElementById("btn-remove-lucide") as HTMLButtonElement;
var btnUpgradeFa6 = document.getElementById("btn-upgrade-fa6") as HTMLButtonElement;
var btnSvgSwap = document.getElementById("btn-svg-swap") as HTMLButtonElement;
var progressCard = document.getElementById("progress-card") as HTMLDivElement;
var progressLabel = document.getElementById("progress-label") as HTMLSpanElement;
var progressPct = document.getElementById("progress-pct") as HTMLSpanElement;
var progressFill = document.getElementById("progress-fill") as HTMLDivElement;
var progressPhase = document.getElementById("progress-phase") as HTMLParagraphElement;
var liveCounts = document.getElementById("live-counts") as HTMLDivElement;
var liveReplaced = document.getElementById("live-replaced") as HTMLElement;
var liveFlagged = document.getElementById("live-flagged") as HTMLElement;
var liveSkipped = document.getElementById("live-skipped") as HTMLElement;
var resultsCard = document.getElementById("results-card") as HTMLDivElement;
var btnSelectFlagged = document.getElementById("btn-select-flagged") as HTMLButtonElement;
var selectionList = document.getElementById("selection-list") as HTMLDivElement;
var btnReplaceSelected = document.getElementById("btn-replace-selected") as HTMLButtonElement;
var existingBanner = document.getElementById("existing-banner") as HTMLDivElement;
var existingCountText = document.getElementById("existing-count-text") as HTMLSpanElement;
var swapLog = document.getElementById("swap-log") as HTMLDivElement;
var btnRescan = document.getElementById("btn-rescan") as HTMLButtonElement;
var upgradeResults = document.getElementById("upgrade-results") as HTMLDivElement;

function getSelectedStyles(): string[] {
  var styles = ["Light"];
  var chkThin = document.getElementById("chk-thin") as HTMLInputElement;
  var chkRegular = document.getElementById("chk-regular") as HTMLInputElement;
  var chkSolid = document.getElementById("chk-solid") as HTMLInputElement;
  if (chkThin && chkThin.checked) styles.push("Thin");
  if (chkRegular && chkRegular.checked) styles.push("Regular");
  if (chkSolid && chkSolid.checked) styles.push("Solid");
  return styles;
}

function showProgress(label: string, showCounts?: boolean) {
  progressCard.classList.add("active");
  progressLabel.textContent = label;
  progressLabel.classList.add("pulse");
  progressPct.textContent = "0%";
  progressFill.style.width = "0%";
  progressPhase.textContent = "";
  progressPhase.classList.remove("error");
  liveCounts.style.display = showCounts ? "flex" : "none";
  liveReplaced.textContent = "0";
  liveFlagged.textContent = "0";
  liveSkipped.textContent = "0";
  swapLog.style.display = "none";
  swapLog.innerHTML = "";
  resultsCard.classList.remove("active");
  upgradeResults.classList.remove("active");
}

function updateProgress(current: number, total: number, phase: string) {
  if (total > 0) {
    var pct = Math.round((current / total) * 100);
    progressPct.textContent = pct + "%";
    progressFill.style.width = pct + "%";
  }
  if (phase) {
    progressPhase.textContent = phase;
    if (phase.indexOf("ERROR") === 0) {
      progressPhase.classList.add("error");
      progressLabel.classList.remove("pulse");
      progressLabel.textContent = "Error";
    }
  }
}

function finishProgress(label: string) {
  progressLabel.textContent = label;
  progressLabel.classList.remove("pulse");
  progressPct.textContent = "100%";
  progressFill.style.width = "100%";
}

btnGenerate.addEventListener("click", function () {
  showProgress("Generating mapped components...");
  btnGenerate.disabled = true;
  btnGenerate.innerHTML = '<span class="spinner"></span>Generating...';
  btnGenerateAll.disabled = true;
  parent.postMessage({ pluginMessage: { type: "generate-components", payload: { styles: getSelectedStyles() } } }, "*");
});

btnGenerateAll.addEventListener("click", function () {
  showProgress("Generating all components...");
  btnGenerateAll.disabled = true;
  btnGenerateAll.innerHTML = '<span class="spinner"></span>Generating...';
  btnGenerate.disabled = true;
  parent.postMessage({ pluginMessage: { type: "generate-all-components", payload: { styles: getSelectedStyles() } } }, "*");
});

btnSwap.addEventListener("click", function () {
  showProgress("Replacing Lucide components...", true);
  btnSwap.disabled = true;
  btnSwap.innerHTML = '<span class="spinner"></span>Replacing...';
  parent.postMessage({ pluginMessage: { type: "auto-swap" } }, "*");
});

btnRemoveLucide.addEventListener("click", function () {
  showProgress("Cleaning up names...");
  btnRemoveLucide.disabled = true;
  btnRemoveLucide.innerHTML = '<span class="spinner"></span>Cleaning...';
  parent.postMessage({ pluginMessage: { type: "remove-lucide" } }, "*");
});

btnUpgradeFa6.addEventListener("click", function () {
  showProgress("Upgrading FA6 to FA7...", true);
  btnUpgradeFa6.disabled = true;
  btnUpgradeFa6.innerHTML = '<span class="spinner"></span>Upgrading...';
  parent.postMessage({ pluginMessage: { type: "upgrade-fa6" } }, "*");
});

btnSvgSwap.addEventListener("click", function () {
  showProgress("Replacing SVG icons...", true);
  btnSvgSwap.disabled = true;
  btnSvgSwap.innerHTML = '<span class="spinner"></span>Replacing...';
  parent.postMessage({ pluginMessage: { type: "svg-swap" } }, "*");
});

btnSelectFlagged.addEventListener("click", function () {
  parent.postMessage({ pluginMessage: { type: "select-flagged", payload: { nodeIds: flaggedNodeIds } } }, "*");
});

btnReplaceSelected.addEventListener("click", function () {
  btnReplaceSelected.disabled = true;
  btnReplaceSelected.innerHTML = '<span class="spinner"></span>Replacing...';
  parent.postMessage({ pluginMessage: { type: "replace-selected", payload: { overrides: overrides } } }, "*");
});

btnRescan.addEventListener("click", function () {
  existingCountText.textContent = "Scanning...";
  parent.postMessage({ pluginMessage: { type: "rescan" } }, "*");
});

function showUpgradeResults(processed: number, skipped: number, skippedItems: any[]) {
  upgradeResults.classList.add("active");
  (document.getElementById("upgrade-stat-processed") as HTMLElement).textContent = String(processed);
  (document.getElementById("upgrade-stat-skipped") as HTMLElement).textContent = String(skipped);
  var list = document.getElementById("upgrade-skipped-list") as HTMLDivElement;
  if (skippedItems.length > 0) {
    list.innerHTML = skippedItems.map(function (s: { name: string; reason: string }) {
      return '<div class="skipped-entry"><span class="skip-name">' + esc(s.name) + '</span><span class="skip-reason">' + esc(s.reason) + '</span></div>';
    }).join("");
  } else {
    list.innerHTML = "";
  }
}

window.onmessage = function (event) {
  var msg = event.data.pluginMessage;
  if (!msg) return;

  switch (msg.type) {
    case "init":
      existingBanner.style.display = "block";
      existingCountText.textContent = "Scanning...";
      break;

    case "scan-progress": {
      var scanParts: string[] = [];
      scanParts.push("Page " + msg.pageNum + "/" + msg.totalPages + ": " + msg.page);
      var found: string[] = [];
      if (msg.lucide > 0) found.push(msg.lucide + " Lucide");
      if (msg.fa6 > 0) found.push(msg.fa6 + " FA6");
      if (msg.fa7 > 0) found.push(msg.fa7 + " FA7");
      if (found.length > 0) scanParts.push(found.join(", "));
      existingCountText.textContent = scanParts.join(" / ");
      break;
    }

    case "scan-complete": {
      var parts: string[] = [];
      if (msg.lucide > 0) parts.push(msg.lucide + " Lucide");
      if (msg.fa6 > 0) parts.push(msg.fa6 + " FA6");
      if (msg.fa7 > 0) parts.push(msg.fa7 + " FA7");
      if (parts.length > 0) {
        existingBanner.style.display = "block";
        existingCountText.textContent = parts.join(" / ") + " components found";
      } else {
        existingBanner.style.display = "none";
      }
      if (msg.fa7 > 0) {
        componentsGenerated = true;
        btnSwap.disabled = false;
      }
      if (msg.fa6 > 0) {
        btnUpgradeFa6.disabled = false;
      }
      break;
    }

    case "progress":
      updateProgress(0, 0, msg.phase);
      break;

    case "progress-update":
      updateProgress(msg.current, msg.total, msg.phase || "");
      if (msg.replaced !== undefined) liveReplaced.textContent = String(msg.replaced);
      if (msg.flagged !== undefined) liveFlagged.textContent = String(msg.flagged);
      if (msg.skipped !== undefined) liveSkipped.textContent = String(msg.skipped);
      if (msg.lastSwap) {
        swapLog.style.display = "block";
        var entry = document.createElement("div");
        entry.className = "swap-log-entry";
        entry.innerHTML = '<span class="from">' + esc(msg.lastSwap.from) + '</span>' +
          '<span class="arrow">&gt;</span>' +
          '<span class="to">' + esc(msg.lastSwap.to) + '</span>' +
          (msg.lastSwap.confidence === "low" ? '<span class="confidence-low">LOW</span>' : "");
        if (swapLog.children.length > 50) swapLog.removeChild(swapLog.firstChild!);
        swapLog.appendChild(entry);
        swapLog.scrollTop = swapLog.scrollHeight;
      }
      break;

    case "generate-complete":
      componentsGenerated = true;
      btnSwap.disabled = false;
      btnGenerate.disabled = true;
      btnGenerate.textContent = msg.created + " created, " + msg.skipped + " skipped";
      btnGenerateAll.disabled = false;
      if (msg.totalExisting > 0) {
        existingBanner.style.display = "block";
        existingCountText.textContent = msg.totalExisting + " FA7 components exist";
      }
      if (msg.errors > 0 && msg.created === 0) {
        updateProgress(0, 0, "ERROR: " + (msg.errorDetails[0] || "Unknown"));
      } else {
        finishProgress("Done");
        progressPhase.textContent = msg.created + " components ready";
      }
      break;

    case "generate-all-complete":
      componentsGenerated = true;
      btnSwap.disabled = false;
      btnGenerateAll.disabled = true;
      btnGenerateAll.textContent = msg.created + " created, " + msg.skipped + " skipped";
      btnGenerate.disabled = true;
      if (msg.totalExisting > 0) {
        existingBanner.style.display = "block";
        existingCountText.textContent = msg.totalExisting + " FA7 components exist";
      }
      if (msg.errors > 0 && msg.created === 0) {
        updateProgress(0, 0, "ERROR: " + (msg.errorDetails[0] || "Unknown"));
      } else {
        finishProgress("Done");
        progressPhase.textContent = msg.created + " components ready";
      }
      break;

    case "swap-complete": {
      btnSwap.textContent = msg.replaced + " replaced";
      btnSwap.disabled = true;
      finishProgress("Complete");
      progressPhase.textContent = "All instances updated automatically";
      liveCounts.style.display = "flex";
      liveReplaced.textContent = String(msg.replaced);
      liveFlagged.textContent = String(msg.flagged);
      liveSkipped.textContent = String(msg.skipped);
      resultsCard.classList.add("active");
      (document.getElementById("stat-replaced") as HTMLElement).textContent = String(msg.replaced);
      (document.getElementById("stat-flagged") as HTMLElement).textContent = String(msg.flagged);
      (document.getElementById("stat-skipped") as HTMLElement).textContent = String(msg.skipped);
      flaggedNodeIds = msg.flaggedNodeIds || [];
      btnSelectFlagged.style.display = flaggedNodeIds.length === 0 ? "none" : "block";
      var skippedList = document.getElementById("skipped-list") as HTMLDivElement;
      var items = msg.skippedItems || [];
      if (items.length > 0) {
        skippedList.innerHTML = items.map(function (s: { name: string; reason: string }) {
          return '<div class="skipped-entry"><span class="skip-name">' + esc(s.name) + '</span><span class="skip-reason">' + esc(s.reason) + '</span></div>';
        }).join("");
      } else {
        skippedList.innerHTML = "";
      }
      break;
    }

    case "upgrade-complete": {
      btnUpgradeFa6.textContent = msg.upgraded + " upgraded";
      btnUpgradeFa6.disabled = true;
      finishProgress("Complete");
      progressPhase.textContent = msg.upgraded + " FA6 components upgraded to FA7" + (msg.renamed > 0 ? " (" + msg.renamed + " renamed)" : "");
      liveCounts.style.display = "flex";
      liveReplaced.textContent = String(msg.upgraded);
      liveSkipped.textContent = String(msg.skipped);
      showUpgradeResults(msg.upgraded, msg.skipped, msg.skippedItems || []);
      break;
    }

    case "svg-swap-complete": {
      btnSvgSwap.textContent = msg.replaced + " replaced";
      btnSvgSwap.disabled = true;
      finishProgress("Complete");
      progressPhase.textContent = msg.replaced + " SVG icons replaced with FA7 glyphs";
      liveCounts.style.display = "flex";
      liveReplaced.textContent = String(msg.replaced);
      liveSkipped.textContent = String(msg.skipped);
      showUpgradeResults(msg.replaced, msg.skipped, msg.skippedItems || []);
      break;
    }

    case "remove-progress": {
      var removePct = msg.totalPages > 0 ? Math.round((msg.pageNum / msg.totalPages) * 100) : 0;
      progressPct.textContent = removePct + "%";
      progressFill.style.width = removePct + "%";
      progressPhase.textContent = "Page " + msg.pageNum + "/" + msg.totalPages + ": " + msg.page + " (" + msg.cleaned + " cleaned)";
      break;
    }

    case "remove-lucide-complete":
      finishProgress("Complete");
      progressPhase.textContent = msg.cleaned + " component name(s) cleaned";
      btnRemoveLucide.textContent = "Cleaned " + msg.cleaned + " name(s)";
      break;

    case "selection-changed":
      selectionItems = msg.items;
      renderSelectionList();
      break;

    case "selection-swap-complete":
      btnReplaceSelected.disabled = false;
      btnReplaceSelected.textContent = "Replaced " + msg.replaced;
      setTimeout(function () { btnReplaceSelected.textContent = "Replace Selected"; }, 2000);
      break;

    case "error":
      progressPhase.textContent = msg.message;
      progressPhase.classList.add("error");
      progressLabel.classList.remove("pulse");
      progressLabel.textContent = "Error";
      btnGenerate.disabled = false;
      btnGenerate.textContent = "Generate Mapped Components";
      btnGenerateAll.disabled = false;
      btnGenerateAll.textContent = "Generate All 4,318 Components";
      btnSwap.disabled = !componentsGenerated;
      btnSwap.textContent = "Replace All Lucide Components";
      btnUpgradeFa6.disabled = false;
      btnUpgradeFa6.textContent = "Upgrade FA6 to FA7";
      btnSvgSwap.disabled = false;
      btnSvgSwap.textContent = "Replace SVG Icons";
      break;
  }
};

function renderSelectionList() {
  if (selectionItems.length === 0) {
    selectionList.innerHTML = '<div class="empty-state">Select icons in Figma to begin</div>';
    btnReplaceSelected.disabled = true;
    return;
  }
  btnReplaceSelected.disabled = false;
  selectionList.innerHTML = selectionItems.map(function (item) {
    return '<div class="selection-item">' +
      '<span class="name" title="' + esc(item.name) + '">' + esc(item.name) + '</span>' +
      '<input type="text" placeholder="FA icon name" value="' + esc(item.lucideName || "") + '"' +
      ' data-node-id="' + esc(item.id) + '"' +
      ' onchange="window.__setOverride(this.dataset.nodeId, this.value)" />' +
      '</div>';
  }).join("");
}

(window as any).__setOverride = function (nodeId: string, value: string) {
  overrides[nodeId] = value;
};
