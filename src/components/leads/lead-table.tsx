"use client";

import { Star, Phone, Mail, Globe } from "lucide-react";
import { QualityBadge, TierBadge } from "@/components/ui/badge";
import type { Lead } from "@/lib/utils/types";

interface LeadTableProps {
  leads: Lead[];
  loading?: boolean;
  onSelect?: (lead: Lead) => void;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
}

export function LeadTable({
  leads,
  loading,
  onSelect,
  selectedIds,
  onToggle,
  onToggleAll,
}: LeadTableProps) {
  const multiSelectEnabled = !!(onToggle && selectedIds);
  const allSelected = multiSelectEnabled && leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelected = multiSelectEnabled && leads.some((l) => selectedIds.has(l.id));

  const HEADERS = [
    ...(multiSelectEnabled ? [""] : []),
    "Business",
    "Location",
    "Contact",
    "Rating",
    "Score",
    "Quality",
  ];

  if (loading) {
    return (
      <>
        {/* Desktop skeleton */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-3">
                {HEADERS.map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {HEADERS.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-bg-3 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile skeleton */}
        <div className="md:hidden space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-2 p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-bg-3 rounded w-3/4" />
              <div className="h-3 bg-bg-3 rounded w-1/2" />
              <div className="h-3 bg-bg-3 rounded w-1/3" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-2 p-10 text-center">
        <p className="text-text-3 text-sm">No leads to display.</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-3">
              {multiSelectEnabled && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={onToggleAll}
                    className="rounded border-border bg-bg-3 text-gold focus:ring-gold cursor-pointer"
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider">Business</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider whitespace-nowrap">Rating</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider whitespace-nowrap">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider">Quality</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const isSelected = multiSelectEnabled && selectedIds.has(lead.id);
              return (
                <tr
                  key={lead.id ?? i}
                  onClick={() => onSelect?.(lead)}
                  className={`border-b border-border/50 last:border-0 hover:bg-bg-3/50 transition-colors cursor-pointer ${
                    isSelected ? "bg-gold/5" : ""
                  }`}
                >
                  {multiSelectEnabled && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(lead.id)}
                        className="rounded border-border bg-bg-3 text-gold focus:ring-gold cursor-pointer"
                        aria-label={`Select ${lead.name}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-1">{lead.name}</p>
                    <p className="text-xs text-text-3 mt-0.5">{lead.niche_label}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-text-2">{lead.city}, {lead.state}</p>
                    <p className="text-xs text-text-3">{lead.country}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {lead.phone_formatted ? (
                        <div className="flex items-center gap-1.5 text-xs text-text-2">
                          <Phone className="h-3 w-3 shrink-0 text-text-3" />
                          <span>{lead.phone_formatted}</span>
                        </div>
                      ) : null}
                      {lead.email ? (
                        <div className="flex items-center gap-1.5 text-xs text-text-2">
                          <Mail className="h-3 w-3 shrink-0 text-text-3" />
                          <span className="truncate max-w-[200px]">{lead.email}</span>
                        </div>
                      ) : null}
                      {lead.website ? (
                        <div className="flex items-center gap-1.5 text-xs text-text-2">
                          <Globe className="h-3 w-3 shrink-0 text-text-3" />
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="truncate max-w-[200px] hover:text-gold transition-colors"
                          >
                            {lead.website.replace(/https?:\/\/(www\.)?/, "")}
                          </a>
                        </div>
                      ) : null}
                      {!lead.phone_formatted && !lead.email && !lead.website && (
                        <span className="text-xs text-text-3">No contact info</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {lead.rating != null ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-gold fill-gold" />
                          <span className="text-sm font-medium text-text-1">{lead.rating}</span>
                        </div>
                        <p className="text-xs text-text-3">{lead.review_count.toLocaleString()} reviews</p>
                      </div>
                    ) : (
                      <span className="text-xs text-text-3">No rating</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TierBadge tier={lead.tier} />
                      <span className="text-xs font-mono text-text-3">{lead.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <QualityBadge quality={lead.data_quality} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ── */}
      <div className="md:hidden space-y-2">
        {multiSelectEnabled && leads.length > 0 && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={onToggleAll}
              className="rounded border-border bg-bg-3 text-gold focus:ring-gold cursor-pointer"
              aria-label="Select all"
            />
            <span className="text-xs text-text-3">Select all</span>
          </div>
        )}

        {leads.map((lead, i) => {
          const isSelected = multiSelectEnabled && selectedIds.has(lead.id);
          return (
            <div
              key={lead.id ?? i}
              onClick={() => onSelect?.(lead)}
              className={`rounded-xl border bg-bg-2 p-4 cursor-pointer transition-colors ${
                isSelected
                  ? "border-gold/40 bg-gold/5"
                  : "border-border hover:bg-bg-3/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  {multiSelectEnabled && (
                    <div
                      className="mt-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle!(lead.id)}
                        className="rounded border-border bg-bg-3 text-gold focus:ring-gold cursor-pointer"
                        aria-label={`Select ${lead.name}`}
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-text-1 text-sm truncate">{lead.name}</p>
                    <p className="text-xs text-text-3 mt-0.5">{lead.niche_label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <TierBadge tier={lead.tier} />
                  <span className="text-xs font-mono text-text-3">{lead.score}</span>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <p className="text-xs text-text-3 truncate">
                  {lead.city}{lead.city && lead.country ? ", " : ""}{lead.country}
                </p>
                <QualityBadge quality={lead.data_quality} />
              </div>

              {(lead.email || lead.phone_formatted) && (
                <div className="mt-2 flex items-center gap-3">
                  {lead.email && (
                    <div className="flex items-center gap-1 text-xs text-text-3 min-w-0">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  {!lead.email && lead.phone_formatted && (
                    <div className="flex items-center gap-1 text-xs text-text-3">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{lead.phone_formatted}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
