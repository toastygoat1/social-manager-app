export type PostMetadata = Record<string, string>;

export type UserMetadataField = {
  id: string;
  label: string;
  sortOrder: number;
};

export type MetadataField = {
  id: string;
  fieldId: string | null;
  label: string;
  value: string;
};

export type MetadataPayloadField = {
  fieldId?: string;
  label?: string;
  value?: string;
};

const MAX_METADATA_FIELDS = 12;
const MAX_METADATA_KEY_LENGTH = 40;
const MAX_METADATA_VALUE_LENGTH = 160;

function createFieldId() {
  return `metadata-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createMetadataField(): MetadataField {
  return { id: createFieldId(), fieldId: null, label: "", value: "" };
}

export function metadataDefinitionsToFields(
  fields: UserMetadataField[] | null | undefined,
  metadata: PostMetadata | null | undefined = {},
) {
  const items =
    fields?.map((field) => ({
      id: createFieldId(),
      fieldId: field.id,
      label: field.label,
      value: metadata?.[field.id] ?? "",
    })) ?? [];

  return items.length ? items : [createMetadataField()];
}

export function metadataFieldsToPayload(
  fields: MetadataField[],
): { metadata: MetadataPayloadField[]; error: string | null } {
  const metadata: MetadataPayloadField[] = [];

  for (const field of fields) {
    const label = field.label.trim();
    const value = field.value.trim();
    if (!field.fieldId && !label && !value) continue;
    if (!field.fieldId && !label) {
      return {
        metadata: [],
        error: "Metadata fields need a label",
      };
    }
    if (label.length > MAX_METADATA_KEY_LENGTH) {
      return {
        metadata: [],
        error: `Metadata labels must be ${MAX_METADATA_KEY_LENGTH} characters or fewer`,
      };
    }
    if (value.length > MAX_METADATA_VALUE_LENGTH) {
      return {
        metadata: [],
        error: `Metadata values must be ${MAX_METADATA_VALUE_LENGTH} characters or fewer`,
      };
    }

    metadata.push({
      fieldId: field.fieldId ?? undefined,
      label: label || undefined,
      value,
    });
  }

  if (metadata.length > MAX_METADATA_FIELDS) {
    return {
      metadata: [],
      error: `Metadata supports up to ${MAX_METADATA_FIELDS} fields per user`,
    };
  }

  return { metadata, error: null };
}

export function formatPostMetadata(
  metadata: PostMetadata | null | undefined,
  fields: UserMetadataField[] | null | undefined,
) {
  const entries =
    fields
      ?.map((field) => [field.label, metadata?.[field.id]] as const)
      .filter(([, value]) => Boolean(value)) ?? [];
  if (!entries.length) return "-";

  return entries.map(([label, value]) => `${label}: ${value}`).join(" | ");
}
