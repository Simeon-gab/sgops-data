"use client";

import { Star, Phone, Mail, Globe } from "lucide-react";
import { QualityBadge } from "@/components/ui/badge";
import type { Lead } from "@/lib/utils/types";

interface LeadTableProps {
  leads: Lead[];
  loading?: boolean;
}

export function LeadTable({ leads, loading }: LeadTableProps) {
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-3">
              {["Business", "Location", "Contact", "Rating", "Quality"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border/50">
                {Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-bg-3 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-3">
            <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider">
              Business
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider">
              Location
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider">
              Contact
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider whitespace-nowrap">
              Rating
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider">
              Quality
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => (
            <tr
              key={lead.id ?? i}
              className="border-b border-border/50 last:border-0 hover:bg-bg-3/50 transition-colors"
            >
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
                <QualityBadge quality={lead.data_quality} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
