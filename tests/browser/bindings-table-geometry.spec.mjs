const viewports = [
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
  { width: 1700, height: 900 },
];

function tableHtml(kind) {
  const isAd = kind === "ad";
  const cols = isAd ? ["", 95, 125, 125, 125, 135, 105, 115, 160] : ["", 145, 135, 135, 135, 105, 115, 160];
  const headers = isAd ? ["Account", "Платформа", "Клієнт", "Проєкт", "Воронка", "Mapping status", "Status", "Updated", "Action"] : ["Source", "Клієнт", "Проєкт", "Воронка", "Mapping status", "Status", "Updated", "Action"];
  const rows = ["active", "archived"].map((state) => `
    <tr>
      <td><div class="primary">${isAd ? "Very long Account name for geometry wrapping without escaping the table border" : "insight_hub_dev_google_sheet_template · Реги АВ - БД with a long friendly source name"}</div><div class="muted">${isAd ? "act_123456789" : "google_sheet_tab"}</div></td>
      ${isAd ? "<td data-col='platform'>Meta</td>" : ""}
      <td data-col="client"><div class="clamp">Long Client Name ТОВ Аналітика з довгою назвою</div></td>
      <td><div class="clamp">Long Project Name</div></td>
      <td><div class="clamp">Long Funnel Name</div></td>
      <td data-col="mapping"><span class="badge">Confirmed</span></td>
      <td data-col="status"><span class="badge">${state === "active" ? "Active" : "Archived"}</span></td>
      <td data-col="updated"><span class="date">13.07.2026</span><span class="time">21:30</span></td>
      <td data-col="action"><div class="actions">${state === "active" ? "<button>Переприв’язати</button><button>Архівувати</button>" : "<button>Відновити</button>"}</div></td>
    </tr>`).join("");
  return `<section data-table="${kind}"><div class="table-shell"><table class="${kind}"><colgroup>${cols.map((w) => `<col${w ? ` style="width:${w}px"` : ""}>`).join("")}</colgroup><thead><tr>${headers.map((h, i) => `<th${isAd && i === 1 ? " data-col='platform'" : ""}${(isAd && i === 2) || (!isAd && i === 1) ? " data-col='client'" : ""}>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

const html = `<!doctype html><html><head><style>
  * { box-sizing: border-box; } body { margin: 0; padding: 24px; font-family: Arial, sans-serif; }
  .unbound { margin-bottom: 16px; padding: 12px; border: 1px solid #facc15; background: #fef9c3; }
  .table-shell { width: 100%; overflow-x: auto; border: 1px solid #ddd; border-radius: 12px; margin-bottom: 24px; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 14px; }
  table.source { min-width: 1180px; } table.ad { min-width: 1200px; }
  th, td { padding: 8px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid #eee; overflow-wrap: anywhere; }
  .primary { font-weight: 600; overflow-wrap: anywhere; } .muted, .time { color: #667085; font-size: 12px; }
  .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .badge { display: inline-flex; max-width: 100%; border: 1px solid #ddd; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
  .date, .time { display: block; line-height: 1.2; }
  .actions { display: flex; width: 100%; flex-direction: column; align-items: flex-start; gap: 8px; }
  button { height: 32px; width: 144px; max-width: 100%; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; }
</style></head><body><div class="unbound">Yellow unbound-account card above the Ad Account table</div>${tableHtml("source")}${tableHtml("ad")}</body></html>`;

async function main() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.setContent(html);
      const result = await page.evaluate(() => {
        const rect = (el) => el.getBoundingClientRect();
        const checks = {};
        for (const section of Array.from(document.querySelectorAll("[data-table]"))) {
          const table = section.getAttribute("data-table");
          const shell = section.querySelector(".table-shell");
          const mapping = rect(section.querySelector("td[data-col='mapping']"));
          const status = rect(section.querySelector("td[data-col='status']"));
          const updated = rect(section.querySelector("td[data-col='updated']"));
          const action = rect(section.querySelector("td[data-col='action']"));
          checks[`${viewport.width}:${table}:mapping-status-gap`] = mapping.right <= status.left;
          checks[`${viewport.width}:${table}:updated-action-gap`] = updated.right <= action.left;
          if (table === "ad") {
            checks[`${viewport.width}:ad:platform-client-head-gap`] = rect(section.querySelector("th[data-col='platform']")).right < rect(section.querySelector("th[data-col='client']")).left;
            checks[`${viewport.width}:ad:platform-client-cell-gap`] = rect(section.querySelector("td[data-col='platform']")).right < rect(section.querySelector("td[data-col='client']")).left;
          }
          checks[`${viewport.width}:${table}:no-shell-horizontal-scrollbar`] = shell.scrollWidth <= shell.clientWidth + 1;
          for (const row of Array.from(section.querySelectorAll("tbody tr"))) {
            const actionCell = rect(row.querySelector("td[data-col='action']"));
            const updatedCell = rect(row.querySelector("td[data-col='updated']"));
            for (const button of Array.from(row.querySelectorAll("button"))) {
              const box = rect(button);
              checks[`${viewport.width}:${table}:${button.textContent}:inside-action`] = box.left >= actionCell.left && box.right <= actionCell.right && box.top >= actionCell.top && box.bottom <= actionCell.bottom;
              checks[`${viewport.width}:${table}:${button.textContent}:not-overlap-updated`] = box.left >= updatedCell.right;
              checks[`${viewport.width}:${table}:${button.textContent}:size`] = Math.round(box.width) === 144 && Math.round(box.height) === 32;
            }
          }
        }
        checks[`${viewport.width}:page:no-horizontal-scrollbar`] = document.documentElement.scrollWidth <= window.innerWidth + 1;
        return checks;
      });
      const failures = Object.entries(result).filter(([, ok]) => !ok);
      if (failures.length) throw new Error(`Geometry failures: ${failures.map(([key]) => key).join(", ")}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
