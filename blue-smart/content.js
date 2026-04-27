// content.js - KingSmart Postal Viewer
// Extracts recipient household list from the unreceived parcels table

(() => {
  function scanPostalRecipients() {
    const table = document.querySelector("table.tb-unreceived");
    if (!table) {
      console.warn("[PostalViewer] Unreceived parcels table not found.");
      return [];
    }

    const rows = table.querySelectorAll("tbody tr");
    const recipients = [];

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 4) return;

      const householdCell = cells[3];
      const householdDiv = householdCell.querySelector("div");
      const nameSpan = householdCell.querySelector("span.name");

      if (!householdDiv) return;

      const household = householdDiv.textContent.trim().replace("樓", "F");
      if (!household) return;

      const name = nameSpan ? nameSpan.textContent.trim() : "";

      // Mail type is in cells[2]
      const typeDiv = cells[2]?.querySelector("div");
      const mailType = typeDiv ? typeDiv.textContent.trim() : "";

      // Registration time is in cells[5]
      const regTime = cells[5]?.textContent.trim() || "";

      recipients.push({ household, name, mailType, regTime });
    });

    return recipients;
  }

  // 棟別判斷: 從戶別字串 (如 "13號7樓") 取出門號，對應棟別
  const BUILDING_MAP = {
    "3": "A棟", "3-1": "A棟", "5": "A棟", "5-1": "A棟",
    "7": "B棟", "9": "B棟",
    "11": "C棟", "11-1": "C棟", "13": "C棟", "13-1": "C棟",
  };

  function getBuilding(household) {
    const match = household.match(/^([\d]+-?\d*)號/);
    if (!match) return "unknown";
    return BUILDING_MAP[match[1]] || "unknown";
  }

  function printRecipients(recipients) {
    if (recipients.length === 0) {
      console.log("[PostalViewer] No unreceived parcels found.");
      return;
    }

    console.log(`[PostalViewer] Unreceived parcels: ${recipients.length} items`);
    console.log("===========================================");

    // 依棟別分組
    const byBuilding = {};
    recipients.forEach((r) => {
      const bld = getBuilding(r.household);
      if (!byBuilding[bld]) byBuilding[bld] = [];
      byBuilding[bld].push(r);
    });

    // 依 A -> B -> C 順序輸出
    ["A棟", "B棟", "C棟", "unknown"].forEach((bld) => {
      const items = byBuilding[bld];
      if (!items) return;

      const households = [...new Set(items.map((r) => r.household))];
      console.log(`[PostalViewer] ${bld} (${items.length} 件):`);
      households.forEach((h) => console.log(`  ${h}`));
      console.log("-------------------------------------------");
    });
  }

  function showOverlay(recipients) {
    // 移除舊蓋板（多次注入保護）
    const existing = document.getElementById("pv-overlay");
    if (existing) existing.remove();

    // 依棟別分組
    const byBuilding = {};
    recipients.forEach((r) => {
      const bld = getBuilding(r.household);
      if (!byBuilding[bld]) byBuilding[bld] = [];
      byBuilding[bld].push(r);
    });

    // 全頁面蓋板
    const overlay = document.createElement("div");
    overlay.id = "pv-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      background: "#ffffff",
      zIndex: "2147483647",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      color: "#222222",
    });

    // 標題列（棟別標題 + 關閉按鈕同排）
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      flexShrink: "0",
      borderBottom: "1px solid transparent",
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "x";
    Object.assign(closeBtn.style, {
      background: "none",
      border: "none",
      borderLeft: "1px solid transparent",
      color: "#999999",
      fontSize: "22px",
      cursor: "pointer",
      lineHeight: "1",
      padding: "4px 16px",
      alignSelf: "stretch",
      display: "flex",
      alignItems: "center",
    });
    closeBtn.addEventListener("mouseover", () => { closeBtn.style.color = "#222222"; });
    closeBtn.addEventListener("mouseout", () => { closeBtn.style.color = "#999999"; });

    // 倒數計時
    const countdown = document.createElement("div");
    Object.assign(countdown.style, {
      fontSize: "13px",
      color: "#aaaaaa",
      padding: "4px 16px",
      whiteSpace: "nowrap",
    });
    let remaining = 60;
    countdown.textContent = `${remaining}s`;
    const countdownTimer = setInterval(() => {
      remaining -= 1;
      countdown.textContent = `${remaining}s`;
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        location.reload();
      }
    }, 1000);

    // 三欄容器 (A棟 | B棟 | C棟)
    const columns = document.createElement("div");
    Object.assign(columns.style, {
      display: "flex",
      flex: "1",
      overflow: "hidden",
    });

    // 計算每欄的排數與列數：超過 10 個戶號才切 2 排，否則 1 排
    const buildingMeta = ["A棟", "B棟", "C棟"].map((bld) => {
      const items = byBuilding[bld] || [];
      const count = new Set(items.map((r) => r.household)).size;
      const cols = count > 10 ? 2 : 1;
      const rows = Math.ceil(count / cols);
      return { bld, count, cols, rows };
    });
    const maxRows = Math.max(...buildingMeta.map((m) => m.rows));

    // 棟別標題放進 header（各佔 1/3 寬）
    buildingMeta.forEach(({ bld }, idx) => {
      const bldTitle = document.createElement("div");
      bldTitle.textContent = bld;
      Object.assign(bldTitle.style, {
        flex: "1",
        fontSize: "30px",
        fontWeight: "700",
        padding: "6px 24px",
        borderRight: "1px solid transparent",
        color: "#222222",
      });
      header.appendChild(bldTitle);
    });
    header.appendChild(countdown);
    header.appendChild(closeBtn);
    overlay.appendChild(header);
    closeBtn.addEventListener("click", () => { clearInterval(countdownTimer); overlay.remove(); });

    // 尺寸基準：cellWidth 依各棟排數動態決定，取最窄的欄作為字體計算基準
    const availableHeight = window.innerHeight - 80;
    const colWidth = window.innerWidth / 3;
    const minCellWidth = Math.min(...buildingMeta.map((m) => colWidth / m.cols)) - 24;

    // 文字寬度量測（用 canvas 近似）
    function measureWidth(text, sizePx) {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      ctx.font = `${sizePx}px Helvetica, Arial, sans-serif`;
      return ctx.measureText(text).width;
    }

    // 找出最長的戶別字串，作為寬度限制代表樣本
    const allHouseholds = ["A棟", "B棟", "C棟"].flatMap((bld) => {
      const items = byBuilding[bld] || [];
      return [...new Set(items.map((r) => r.household))];
    });
    const sampleText = allHouseholds.reduce((a, b) => (b && b.length > (a?.length || 0) ? b : a), "13號12F");

    // 在高度與寬度限制下，二分找到可用的最大字體
    const minFontSize = 12;
    const maxFontSize = 96;
    let lo = minFontSize, hi = maxFontSize, best = minFontSize;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const paddingY = Math.max(2, mid * 0.15);
      const rowHeight = mid * 1.4 + paddingY * 2;
      const fitsHeight = maxRows * rowHeight <= availableHeight;
      const paddingX = 12; // 與下方 row padding 對應
      const textW = measureWidth(sampleText, mid) + paddingX * 2;
      const fitsWidth = textW <= minCellWidth;
      if (fitsHeight && fitsWidth) {
        best = mid;
        lo = mid + 0.5; // 嘗試更大字體
      } else {
        hi = mid - 0.5; // 縮小字體
      }
    }
    const fontSize = Math.floor(best);

    buildingMeta.forEach(({ bld, cols }, idx) => {
      const items = byBuilding[bld] || [];
      const households = [...new Set(items.map((r) => r.household))].sort((a, b) => {
        const parse = (h) => {
          const m = h.match(/^([\d]+)(?:-(\d+))?號(\d+)F$/);
          if (!m) return [0, 0, 0];
          return [parseInt(m[1]), parseInt(m[2] || "0"), parseInt(m[3])];
        };
        const [a1, a2, a3] = parse(a);
        const [b1, b2, b3] = parse(b);
        return a1 - b1 || a2 - b2 || a3 - b3;
      });

      const col = document.createElement("div");
      Object.assign(col.style, {
        flex: "1",
        borderRight: idx < 2 ? "1px solid transparent" : "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      });

      // 戶別列表 (2 排)
      const list = document.createElement("div");
      Object.assign(list.style, {
        padding: "4px 0",
        flex: "1",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: cols === 2 ? "1fr 1fr" : "1fr",
        alignContent: "start",
      });

      households.forEach((h) => {
        const row = document.createElement("div");
        row.textContent = h;
        Object.assign(row.style, {
          padding: Math.max(2, fontSize * 0.15) + "px 16px",
          fontSize: fontSize + "px",
          lineHeight: "1.4",
          whiteSpace: "nowrap",
        });
        list.appendChild(row);
      });

      if (households.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = "(無)";
        Object.assign(empty.style, {
          padding: "8px 24px",
          fontSize: fontSize + "px",
          color: "#999999",
        });
        list.appendChild(empty);
      }

      col.appendChild(list);
      columns.appendChild(col);
    });

    overlay.appendChild(columns);
    document.body.appendChild(overlay);
  }

  // 等待表格資料載入後再掃描（SPA 非同步渲染）
  function waitForData(callback, maxWait) {
    const start = Date.now();
    const interval = setInterval(() => {
      const householdDivs = document.querySelectorAll("table.tb-unreceived tbody tr td:nth-child(4) div");
      const hasContent = [...householdDivs].some((div) => div.textContent.trim().length > 0);
      if (hasContent || Date.now() - start > maxWait) {
        clearInterval(interval);
        callback();
      }
    }, 500);
  }

  function run() {
    const recipients = scanPostalRecipients();

    // --- 測試資料: 模擬 20 筆包裹，測完後刪除此段 ---
    // const testData = [
    //   "3號9F", "3號12F",
    //   "3-1號3F", "3-1號8F", "5號1F", "5號6F",
    //   "7號1F", "7號3F", "7號7F", "7號10F",
    //   "9號2F", "9號5F", "9號11F",
    //   "11號3F", "11號6F", "13號1F", "13號7F", "13-1號4F",
    // ].map((h) => ({ household: h, name: "", mailType: "包裹", regTime: "" }));
    // const data = testData;
    // --- 測試資料結束 ---
    const data = recipients;  // 切回真實資料時用這行
    

    printRecipients(data);
    showOverlay(data);
  }

  waitForData(run, 10000);
})();
