// CSV parsing and column auto-detection for lead imports.
// Kept dependency-free: handles quoted fields, escaped quotes, CRLF, and BOM.

export type ImportField =
  | "name"
  | "email"
  | "phone"
  | "website"
  | "country"
  | "state"
  | "city"
  | "notes";

export interface ImportFieldDef {
  field: ImportField;
  label: string;
  required: boolean;
  // Lowercased header names that auto-map to this field
  synonyms: string[];
}

export const IMPORT_FIELDS: ImportFieldDef[] = [
  {
    field: "email",
    label: "Email",
    required: true,
    synonyms: ["email", "e-mail", "email address", "e-mail address", "mail", "contact email", "work email"],
  },
  {
    field: "name",
    label: "Name",
    required: false,
    synonyms: ["name", "business name", "business", "company", "company name", "contact", "contact name", "full name", "client", "client name", "customer", "customer name"],
  },
  {
    field: "phone",
    label: "Phone",
    required: false,
    synonyms: ["phone", "phone number", "mobile", "mobile number", "tel", "telephone", "whatsapp", "cell"],
  },
  {
    field: "website",
    label: "Website",
    required: false,
    synonyms: ["website", "url", "site", "web", "webpage", "domain"],
  },
  {
    field: "country",
    label: "Country",
    required: false,
    synonyms: ["country"],
  },
  {
    field: "state",
    label: "State",
    required: false,
    synonyms: ["state", "region", "province"],
  },
  {
    field: "city",
    label: "City",
    required: false,
    synonyms: ["city", "town", "location"],
  },
  {
    field: "notes",
    label: "Notes",
    required: false,
    synonyms: ["notes", "note", "comment", "comments", "description", "remarks"],
  },
];

// Column index per field, or -1 when unmapped
export type ColumnMapping = Record<ImportField, number>;

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export function parseCSV(text: string): ParsedCSV {
  // Strip BOM
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // Skip fully empty lines
      if (row.length > 1 || row[0].trim() !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  // Trailing field / row without final newline
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  const [headerRow, ...dataRows] = rows;
  return {
    headers: headerRow.map((h) => h.trim()),
    rows: dataRows,
  };
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping = Object.fromEntries(
    IMPORT_FIELDS.map((f) => [f.field, -1])
  ) as ColumnMapping;

  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[_-]+/g, " "));

  for (const def of IMPORT_FIELDS) {
    // Exact synonym match first, then substring match as fallback
    let idx = normalized.findIndex((h) => def.synonyms.includes(h));
    if (idx === -1) {
      idx = normalized.findIndex((h) =>
        def.synonyms.some((s) => h.includes(s))
      );
    }
    // Never map one column to two fields
    if (idx !== -1 && !Object.values(mapping).includes(idx)) {
      mapping[def.field] = idx;
    }
  }

  return mapping;
}

export function buildSampleCSV(): string {
  return [
    "name,email,phone,website,country,state,city,notes",
    'Golden Crust Bakery,hello@goldencrust.com,+2348012345678,goldencrust.com,Nigeria,Lagos,Ikeja,Met at trade fair',
    'Bella Salon,bella@bellasalon.ng,+2348098765432,,Nigeria,Abuja,Wuse,Referred by client',
  ].join("\n");
}

// ── Row building ──────────────────────────────────────────────────────────────
// Columns the user did not map to a known field are not discarded. They become
// custom fields on the lead and are usable as {{merge_fields}} in campaigns,
// which is the whole point of importing your own spreadsheet.

export interface BuiltImportRow {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  country?: string;
  state?: string;
  city?: string;
  notes?: string;
  custom_fields: Record<string, string>;
}

// Header text becomes a merge-field key: "Contact Role" -> contact_role
export function toFieldKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const RESERVED_FIELD_KEYS = new Set([
  "name", "business_name", "company", "first_name", "email", "phone", "website",
  "city", "state", "country", "location", "niche", "rating", "review_count",
]);

export function buildImportRows(
  parsed: ParsedCSV,
  mapping: ColumnMapping
): BuiltImportRow[] {
  const mappedIndexes = new Set(
    Object.values(mapping).filter((i) => i >= 0)
  );

  // Precompute the custom columns once rather than per row.
  const customColumns = parsed.headers
    .map((header, index) => ({ key: toFieldKey(header), index }))
    .filter(({ key, index }) => key && !mappedIndexes.has(index))
    // A custom column may not shadow a built-in merge field, or a template
    // using {{company}} would resolve differently per row depending on the file.
    .filter(({ key }) => !RESERVED_FIELD_KEYS.has(key));

  const cell = (row: string[], index: number): string =>
    index >= 0 ? (row[index] ?? "").trim() : "";

  return parsed.rows.map((row) => {
    const custom_fields: Record<string, string> = {};
    for (const { key, index } of customColumns) {
      const value = cell(row, index);
      if (value) custom_fields[key] = value;
    }

    return {
      name:     cell(row, mapping.name),
      email:    cell(row, mapping.email),
      phone:    cell(row, mapping.phone)   || undefined,
      website:  cell(row, mapping.website) || undefined,
      country:  cell(row, mapping.country) || undefined,
      state:    cell(row, mapping.state)   || undefined,
      city:     cell(row, mapping.city)    || undefined,
      notes:    cell(row, mapping.notes)   || undefined,
      custom_fields,
    };
  });
}

// Headers that will be carried through as merge fields, for showing the user
// what {{placeholders}} their import just made available.
export function detectCustomFields(
  headers: string[],
  mapping: ColumnMapping
): string[] {
  const mappedIndexes = new Set(Object.values(mapping).filter((i) => i >= 0));
  return headers
    .map((header, index) => ({ key: toFieldKey(header), index }))
    .filter(({ key, index }) => key && !mappedIndexes.has(index) && !RESERVED_FIELD_KEYS.has(key))
    .map(({ key }) => key);
}
