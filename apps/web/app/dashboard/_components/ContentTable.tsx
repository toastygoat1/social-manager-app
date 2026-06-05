import { ContentRowsTable } from "@/app/_components/ContentRowsTable";
import type { ContentRow, MetadataFieldDefinition } from "./data";

type ContentTableProps = {
  rows: ContentRow[];
  metadataFields: MetadataFieldDefinition[];
};

export function ContentTable({ rows, metadataFields }: ContentTableProps) {
  return (
    <ContentRowsTable rows={rows} metadataFields={metadataFields} />
  );
}
