import { ContentRowsTable } from "@/app/_components/ContentRowsTable";
import type { AnalyticsContentRow } from "./data";
import type { MetadataFieldDefinition } from "@/app/dashboard/_components/data";

export function AnalyticsContentTable({
  rows,
  metadataFields,
}: {
  rows: AnalyticsContentRow[];
  metadataFields: MetadataFieldDefinition[];
}) {
  return (
    <ContentRowsTable rows={rows} metadataFields={metadataFields} />
  );
}
