import type { Lead } from "./types";

// Merge fields for campaign templates: {{first_name}}, {{company}}, and any
// column carried over from an imported CSV.
//
// Syntax:
//   {{city}}              value, or the whole placeholder is reported unresolved
//   {{first_name|there}}  value, falling back to "there" when empty
//
// An unresolved placeholder is never silently blanked. Sending "Hi ," to five
// hundred people is worse than refusing to send, so render() reports what is
// missing and the campaign layer decides.

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\}\}/g;

export interface RenderResult {
  text: string;
  // Fields that appeared in the template, had no value, and had no fallback
  unresolved: string[];
}

// Built-in fields available on every lead regardless of import source.
export function builtinFields(lead: Lead): Record<string, string> {
  const name = lead.name?.trim() ?? "";

  return {
    name,
    business_name: name,
    company: lead.custom_fields?.company?.toString().trim() || name,
    // Best-effort personal first name. For a business-named lead this is just
    // the first word, so templates should prefer a fallback: {{first_name|there}}
    first_name: name.split(/\s+/)[0] ?? "",
    email: lead.email ?? "",
    phone: lead.phone_formatted || lead.phone || "",
    website: lead.website ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    country: lead.country ?? "",
    location: [lead.city, lead.state].filter(Boolean).join(", "),
    niche: lead.niche_label ?? "",
    rating: lead.rating != null ? String(lead.rating) : "",
    review_count: lead.review_count != null ? String(lead.review_count) : "",
  };
}

// Custom fields from a CSV import override nothing built in, they extend it.
export function mergeContext(lead: Lead): Record<string, string> {
  const custom: Record<string, string> = {};
  for (const [key, value] of Object.entries(lead.custom_fields ?? {})) {
    if (value === null || value === undefined) continue;
    custom[normalizeFieldName(key)] = String(value).trim();
  }
  return { ...custom, ...builtinFields(lead) };
}

export function render(template: string, lead: Lead): RenderResult {
  const context = mergeContext(lead);
  const unresolved = new Set<string>();

  const text = template.replace(PLACEHOLDER, (_match, rawKey: string, fallback?: string) => {
    const key = normalizeFieldName(rawKey);
    const value = context[key];

    if (value) return value;
    if (fallback !== undefined) return fallback.trim();

    unresolved.add(key);
    return "";
  });

  return { text, unresolved: Array.from(unresolved) };
}

// Every placeholder used in a template, whether or not it resolves.
export function fieldsUsed(template: string): string[] {
  const found = new Set<string>();
  // replace() rather than matchAll(): the build targets an older lib where
  // iterating a RegExp match iterator needs downlevelIteration.
  template.replace(PLACEHOLDER, (_match, rawKey: string) => {
    found.add(normalizeFieldName(rawKey));
    return "";
  });
  return Array.from(found);
}

// Field names available to a template, for showing the user what they can use.
export function availableFields(lead: Lead): string[] {
  return Object.keys(mergeContext(lead)).sort();
}

function normalizeFieldName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, "_");
}
