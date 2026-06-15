"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type {
  ContentRow,
  MetadataFieldDefinition,
} from "@/app/dashboard/_components/data";
import {
  normalizePostFormat,
  type PostFormat,
} from "@/app/dashboard/_components/post-formats";
import { PostDetailsModal } from "@/app/scheduler/_components/PostDetailsModal";
import { formatNumber } from "@/lib/format";

type PostsTableProps = {
  rows: ContentRow[];
  metadataFields: MetadataFieldDefinition[];
};

const TYPE_COLORS: Record<PostFormat, string> = {
  Post: "#5D9BFE",
  Carousel: "#FA962F",
  Reel: "#8B75FE",
  Story: "#31D8BB",
};

function displayText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—" || trimmed === "–") {
    return null;
  }

  return trimmed;
}

function getInitials(label: string) {
  return (
    label
      .replace(/^@/, "")
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "A"
  );
}

function getThumbnail(row: ContentRow) {
  if (row.thumbnailUrl && /^https?:\/\//i.test(row.thumbnailUrl)) {
    return row.thumbnailUrl;
  }

  const media = row.media?.trim();
  if (media && /^https?:\/\//i.test(media)) return media;

  return null;
}

function StatusPill({ status }: { status: string }) {
  const label = displayText(status) ?? "Draft";
  const normalized = label.toLowerCase();
  const tone =
    normalized.includes("publish")
      ? "bg-emerald-50 text-success"
      : normalized.includes("ready") || normalized.includes("scheduled")
        ? "bg-indigo-50 text-[#5e6ad2]"
        : normalized.includes("pending")
          ? "bg-amber-50 text-[#98640d]"
          : "bg-card text-muted";

  return (
    <span
      className={`dashboard-ui-meta inline-flex rounded-full px-2.5 py-1 ${tone}`}
    >
      {label}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  const format = normalizePostFormat(type);

  return (
    <span
      className="dashboard-ui-meta inline-flex rounded-md px-2 py-1 leading-none text-white"
      style={{ backgroundColor: TYPE_COLORS[format] }}
    >
      {format}
    </span>
  );
}

function MetricValue({ value }: { value: number | null | undefined }) {
  return (
    <span className="dashboard-ui-label text-muted">
      {value === null || value === undefined ? "0" : formatNumber(value)}
    </span>
  );
}

function Thumbnail({ row }: { row: ContentRow }) {
  const preview = getThumbnail(row);
  const format = normalizePostFormat(row.type);
  const color = TYPE_COLORS[format];

  return (
    <span className="block h-12 w-[72px] shrink-0 overflow-hidden rounded-md bg-card">
      {preview ? (
        <span
          aria-hidden="true"
          className="block size-full bg-cover bg-center"
          style={{ backgroundImage: `url("${preview}")` }}
        />
      ) : (
        <span
          className="dashboard-ui-meta flex size-full items-center justify-center font-semibold"
          style={{
            backgroundColor: `${color}18`,
            color,
          }}
        >
          {format}
        </span>
      )}
    </span>
  );
}

function AccountLine({ row }: { row: ContentRow }) {
  return (
    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-muted">
      <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full">
        <AvatarImage
          src={row.account.avatarUrl}
          alt={row.account.name}
          width={16}
          height={16}
          className="size-4 rounded-full object-cover"
          fallback={getInitials(row.account.name)}
        />
      </span>
      <span className="dashboard-ui-meta truncate font-normal">
        {row.account.name}
      </span>
    </span>
  );
}

function MetadataCells({
  row,
  fields,
}: {
  row: ContentRow;
  fields: MetadataFieldDefinition[];
}) {
  return fields.map((field) => (
    <td key={field.id} className="px-4 py-3 align-middle">
      <span className="dashboard-ui-label block max-w-[160px] truncate text-muted">
        {displayText(row.metadata?.[field.id]) ?? "-"}
      </span>
    </td>
  ));
}

export function PostsTable({
  rows,
  metadataFields,
}: PostsTableProps) {
  const router = useRouter();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  return (
    <section className="w-full overflow-hidden border-b border-line bg-paper">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead className="bg-card">
            <tr className="border-b border-line">
              <th className="dashboard-ui-meta min-w-[380px] px-5 py-3 font-semibold text-ink">
                Title
              </th>
              <th className="dashboard-ui-meta min-w-[150px] px-4 py-3 font-semibold text-ink">
                Date published
              </th>
              <th className="dashboard-ui-meta min-w-[130px] px-4 py-3 font-semibold text-ink">
                Status
              </th>
              <th className="dashboard-ui-meta min-w-[150px] px-4 py-3 font-semibold text-ink">
                Distribution
              </th>
              <th className="dashboard-ui-meta min-w-[110px] px-4 py-3 text-right font-semibold text-ink">
                Views
              </th>
              <th className="dashboard-ui-meta min-w-[110px] px-4 py-3 text-right font-semibold text-ink">
                Likes
              </th>
              <th className="dashboard-ui-meta min-w-[120px] px-4 py-3 text-right font-semibold text-ink">
                Comments
              </th>
              <th className="dashboard-ui-meta min-w-[110px] px-4 py-3 text-right font-semibold text-ink">
                Shares
              </th>
              {metadataFields.map((field) => (
                <th
                  key={field.id}
                  className="dashboard-ui-meta min-w-[170px] px-4 py-3 font-semibold text-ink"
                >
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8 + metadataFields.length}
                  className="dashboard-body-text px-5 py-12 text-center text-muted"
                >
                  No posts in this view yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open details for ${row.contents}`}
                  onClick={() => setSelectedPostId(row.id)}
                  onKeyDown={(event) => {
                    if (event.currentTarget !== event.target) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedPostId(row.id);
                    }
                  }}
                  className="group cursor-pointer border-b border-line transition-colors hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#5e6ad2]"
                >
                  <td className="min-w-[380px] px-5 py-3 align-middle">
                    <div className="flex min-w-0 items-center gap-3">
                      <Thumbnail row={row} />
                      <div className="min-w-0">
                        <p className="dashboard-ui-label truncate text-ink">
                          {displayText(row.contents) ?? "Untitled post"}
                        </p>
                        <AccountLine row={row} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="dashboard-ui-label whitespace-nowrap text-muted">
                      {displayText(row.datePost) ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex min-w-[132px] flex-col items-start gap-1">
                      <TypePill type={row.type} />
                      <span className="dashboard-ui-meta text-muted">
                        {displayText(row.media) ?? "Distribution"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <MetricValue value={row.views} />
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <MetricValue value={row.likes} />
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <MetricValue value={row.comments} />
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <MetricValue value={row.shares} />
                  </td>
                  <MetadataCells row={row} fields={metadataFields} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PostDetailsModal
        postId={selectedPostId}
        onClose={() => setSelectedPostId(null)}
        onChanged={() => router.refresh()}
      />
    </section>
  );
}
