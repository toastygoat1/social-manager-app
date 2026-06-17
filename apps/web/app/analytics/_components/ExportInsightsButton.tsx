"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import type { AnalyticsData, PostStat } from "./data";

export type AnalyticsExportDataset = {
  label: string;
  data: AnalyticsData;
};

type ExportInsightsButtonProps = {
  datasets: AnalyticsExportDataset[];
  rangeLabel: string;
  disabled?: boolean;
};

const POST_STAT_LABELS: Record<PostStat["icon"], string> = {
  eye: "Views",
  heart: "Likes",
  comments: "Comments",
  share: "Shares",
  save: "Saves",
};

function html(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "insights"
  );
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : value.toLocaleString("id-ID");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function accountTitle(account: AnalyticsData["accounts"][number] | undefined) {
  if (!account) return "";

  return (
    account.displayName?.trim() ||
    account.name.replace(/^@/, "").trim() ||
    account.username?.replace(/^@/, "").trim() ||
    "Instagram"
  );
}

function selectedAccountsLabel(data: AnalyticsData) {
  if (data.selectedAccountIds.length === 0) return "All accounts";

  const accountById = new Map(
    data.accounts.map((account) => [account.id, account]),
  );

  return data.selectedAccountIds
    .map((accountId) => accountTitle(accountById.get(accountId)))
    .filter(Boolean)
    .join(", ");
}

function postStatValue(
  post: AnalyticsData["recentPosts"][number],
  icon: PostStat["icon"],
) {
  return post.stats.find((stat) => stat.icon === icon)?.value ?? null;
}

function table(headers: string[], rows: unknown[][], emptyLabel = "No data") {
  if (rows.length === 0) {
    return `<p class="empty">${html(emptyLabel)}</p>`;
  }

  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${html(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${html(cell)}</td>`).join("")}</tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function section(title: string, content: string) {
  return `
    <section class="report-section">
      <h2>${html(title)}</h2>
      ${content}
    </section>
  `;
}

function metricCards(data: AnalyticsData) {
  const rows = data.statGrid.map(
    (stat) => `
      <div class="metric-card">
        <span>${html(stat.title)}</span>
        <strong>${html(formatNumber(stat.value))}</strong>
        <small>${html(stat.trend ? `${stat.trend} ${stat.delta ?? ""}` : "No trend")}</small>
      </div>
    `,
  );

  return `<div class="metric-grid">${rows.join("")}</div>`;
}

function buildPostsRows(
  posts: AnalyticsData["recentPosts"],
  accountById: Map<string, AnalyticsData["accounts"][number]>,
  listLabel: string,
) {
  return posts.map((post, index) => [
    listLabel,
    index + 1,
    accountTitle(accountById.get(post.accountId)),
    post.badge.label,
    formatDateTime(post.publishedAt),
    post.caption,
    formatNumber(postStatValue(post, "eye")),
    formatNumber(postStatValue(post, "heart")),
    formatNumber(postStatValue(post, "comments")),
    formatNumber(postStatValue(post, "share")),
    formatNumber(postStatValue(post, "save")),
  ]);
}

function buildDatasetReport(
  dataset: AnalyticsExportDataset,
  rangeLabel: string,
  generatedAt: string,
) {
  const { data, label } = dataset;
  const accountById = new Map(
    data.accounts.map((account) => [account.id, account]),
  );
  const audienceSegments = [
    ...data.audience.gender.map((item) => ["Gender", item.label, item.value, item.percentage]),
    ...data.audience.age.map((item) => ["Age", item.label, item.value, item.percentage]),
    ...data.audience.cities.map((item) => ["City", item.label, item.value, item.percentage]),
  ];
  const postRows = [
    ...buildPostsRows(data.recentPosts, accountById, "Top"),
    ...buildPostsRows(data.latestPosts, accountById, "Latest"),
  ];

  return `
    <article class="dataset">
      <header class="dataset-header">
        <p>Insights report</p>
        <h1>${html(label)}</h1>
        <dl>
          <div><dt>Range</dt><dd>${html(rangeLabel)}</dd></div>
          <div><dt>Accounts</dt><dd>${html(selectedAccountsLabel(data))}</dd></div>
          <div><dt>Last updated</dt><dd>${html(formatDateTime(data.lastUpdatedAt))}</dd></div>
          <div><dt>Generated</dt><dd>${html(generatedAt)}</dd></div>
        </dl>
      </header>

      ${section("Summary", metricCards(data))}
      ${section(
        "Performance",
        table(
          ["Label", "Date", "Posts", "Views", "Reach", "Interactions", "Likes"],
          data.performanceSeries.map((point) => [
            point.label,
            point.date,
            point.postCount,
            formatNumber(point.views),
            formatNumber(point.reach),
            formatNumber(point.interactions),
            formatNumber(point.likes),
          ]),
        ),
      )}
      ${section(
        "Audience",
        table(
          ["Metric", "Value"],
          [
            ["Followers", formatNumber(data.audience.followers)],
            ["Follower growth", formatNumber(data.audience.followerGrowth)],
            ["Following", formatNumber(data.audience.following)],
            ["Media count", formatNumber(data.audience.mediaCount)],
            ["Reach", formatNumber(data.audience.reach)],
            ["Views", formatNumber(data.audience.views)],
            ["Profile views", formatNumber(data.audience.profileViews)],
            ["Updated at", formatDateTime(data.audience.updatedAt)],
          ],
        ),
      )}
      ${section(
        "Audience segments",
        table(
          ["Group", "Label", "Value", "Percentage"],
          audienceSegments.map(([group, itemLabel, value, percentage]) => [
            group,
            itemLabel,
            formatNumber(value as number),
            `${percentage}%`,
          ]),
        ),
      )}
      ${section(
        "Content mix",
        table(
          ["Format", "Posts", "Percentage"],
          data.distribution.map((item) => [
            item.label,
            formatNumber(item.value),
            `${item.percentage}%`,
          ]),
        ),
      )}
      ${section(
        "Leaderboard",
        table(
          [
            "Account",
            "Posts",
            "Followers",
            "Follower growth",
            "Views",
            "Reach",
            "Interactions",
            "Engagement rate",
          ],
          data.leaderboard.map((row) => [
            accountTitle(row.account),
            formatNumber(row.postCount),
            formatNumber(row.followers),
            formatNumber(row.followerGrowth),
            formatNumber(row.views),
            formatNumber(row.reach),
            formatNumber(row.interactions),
            row.engagementRate === null ? "-" : `${row.engagementRate}%`,
          ]),
        ),
      )}
      ${section(
        "Posts",
        table(
          [
            "List",
            "Rank",
            "Account",
            "Type",
            "Published",
            "Caption",
            ...Object.values(POST_STAT_LABELS),
          ],
          postRows,
        ),
      )}
      ${section(
        "Content table",
        table(
          [
            "Account",
            "Content",
            "Type",
            "Status",
            "Audio",
            "Date",
            "Caption",
            "Views",
            "Likes",
            "Comments",
            "Shares",
            ...data.metadataFields.map((field) => field.label),
          ],
          data.contentRows.map((row) => [
            accountTitle(row.account),
            row.contents,
            row.type,
            row.status,
            row.audio,
            row.datePost,
            row.caption,
            formatNumber(row.views),
            formatNumber(row.likes),
            formatNumber(row.comments),
            formatNumber(row.shares),
            ...data.metadataFields.map((field) => row.metadata[field.id] ?? ""),
          ]),
        ),
      )}
      ${section(
        "Recommendations",
        table(
          ["Title", "Body"],
          data.recommendations.map((item) => [item.title, item.body]),
        ),
      )}
      ${section(
        "Notes",
        table(
          ["Accounts", "Body", "Color", "Created", "Updated"],
          data.notes.map((note) => [
            note.accountIds
              .map((accountId) => accountTitle(accountById.get(accountId)))
              .filter(Boolean)
              .join(", ") || "Unattached",
            note.body,
            note.color,
            formatDateTime(note.createdAt),
            formatDateTime(note.updatedAt),
          ]),
        ),
      )}
    </article>
  `;
}

function buildReportHtml(datasets: AnalyticsExportDataset[], rangeLabel: string) {
  const generatedAt = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  const title = `Insights PDF - ${rangeLabel}`;

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${html(title)}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #ffffff;
            color: #171717;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 11px;
            line-height: 1.45;
          }
          .dataset { break-after: page; }
          .dataset:last-child { break-after: auto; }
          .dataset-header {
            border-bottom: 1px solid #d8d8d8;
            margin-bottom: 18px;
            padding-bottom: 14px;
          }
          .dataset-header p {
            margin: 0 0 5px;
            color: #666666;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          h1 {
            margin: 0;
            font-size: 25px;
            letter-spacing: 0;
            line-height: 1.12;
          }
          h2 {
            margin: 0 0 8px;
            font-size: 14px;
            line-height: 1.2;
          }
          dl {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            margin: 14px 0 0;
          }
          dt {
            color: #666666;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
          }
          dd {
            margin: 2px 0 0;
            font-weight: 600;
          }
          .report-section {
            break-inside: avoid;
            margin: 0 0 16px;
          }
          .metric-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
          }
          .metric-card {
            border: 1px solid #d8d8d8;
            border-radius: 8px;
            padding: 9px;
          }
          .metric-card span {
            color: #666666;
            display: block;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .metric-card strong {
            display: block;
            font-size: 18px;
            line-height: 1.2;
            margin-top: 5px;
          }
          .metric-card small {
            color: #666666;
            display: block;
            font-size: 9px;
            margin-top: 3px;
            text-transform: capitalize;
          }
          table {
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
          }
          th, td {
            border: 1px solid #dddddd;
            overflow-wrap: anywhere;
            padding: 6px 7px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f2f2f2;
            color: #333333;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }
          tr:nth-child(even) td { background: #fafafa; }
          .empty {
            border: 1px dashed #d8d8d8;
            border-radius: 8px;
            color: #666666;
            margin: 0;
            padding: 10px;
          }
        </style>
      </head>
      <body>
        ${datasets
          .map((dataset) => buildDatasetReport(dataset, rangeLabel, generatedAt))
          .join("")}
      </body>
    </html>`;
}

function printPdf(title: string, reportHtml: string) {
  const iframe = document.createElement("iframe");

  iframe.title = title;
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.append(iframe);

  const printWindow = iframe.contentWindow;
  const printDocument = printWindow?.document;

  if (!printWindow || !printDocument) {
    iframe.remove();
    return false;
  }

  printDocument.open();
  printDocument.write(reportHtml);
  printDocument.close();

  let cleanupTimer: number | null = null;
  const cleanup = () => {
    if (cleanupTimer !== null) window.clearTimeout(cleanupTimer);
    window.setTimeout(() => iframe.remove(), 250);
  };

  printWindow.onafterprint = cleanup;
  cleanupTimer = window.setTimeout(cleanup, 60000);

  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);

  return true;
}

export function ExportInsightsButton({
  datasets,
  rangeLabel,
  disabled,
}: ExportInsightsButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  function exportInsights() {
    setIsExporting(true);

    window.setTimeout(() => {
      const title = `insights-${slug(rangeLabel)}-${new Date()
        .toISOString()
        .slice(0, 10)}`;
      const reportHtml = buildReportHtml(datasets, rangeLabel);

      printPdf(title, reportHtml);
      setIsExporting(false);
    }, 0);
  }

  return (
    <button
      type="button"
      onClick={exportInsights}
      disabled={disabled || datasets.length === 0 || isExporting}
      title="Export insights as PDF"
      aria-label="Export insights as PDF"
      className="flex h-9 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm font-medium text-ink transition hover:bg-card disabled:pointer-events-none disabled:opacity-60"
    >
      {isExporting ? (
        <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <Download className="size-3.5" strokeWidth={2} />
      )}
      <span>{isExporting ? "Exporting" : "Export PDF"}</span>
    </button>
  );
}
