"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { availableFields, fieldsUsed, render } from "@/lib/utils/merge-fields";
import type { Lead } from "@/lib/utils/types";

interface TemplateEditorProps {
  subject: string;
  body: string;
  disabled?: boolean;
  onChange: (next: { subject: string; body: string }) => void;
}

// Writing one email that has to work for four hundred different businesses is
// the hard part of a campaign, so the editor is built around seeing it happen:
// a real lead from the workspace fills the merge fields as you type, and any
// placeholder that lead cannot fill is called out before it goes anywhere.

export function TemplateEditor({ subject, body, disabled, onChange }: TemplateEditorProps) {
  const [sample, setSample] = useState<Lead | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/leads?limit=1");
        const data = await res.json();
        if (!cancelled) setSample(data.leads?.[0] ?? null);
      } catch {
        // Preview is a convenience. Without a sample the editor still works,
        // it just shows the raw template.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const used = useMemo(() => fieldsUsed(`${subject}\n${body}`), [subject, body]);

  const preview = useMemo(() => {
    if (!sample) return null;
    return {
      subject: render(subject, sample),
      body: render(body, sample),
    };
  }, [subject, body, sample]);

  const fields = useMemo(() => (sample ? availableFields(sample) : []), [sample]);

  const unknown = useMemo(
    () => (fields.length === 0 ? [] : used.filter((f) => !fields.includes(f))),
    [used, fields]
  );

  const unresolved = preview
    ? Array.from(new Set([...preview.subject.unresolved, ...preview.body.unresolved]))
    : [];

  function insertField(field: string) {
    onChange({ subject, body: `${body}{{${field}}}` });
  }

  return (
    <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 px-3 pt-3">
        {(["write", "preview"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
              tab === value
                ? "bg-bg-3 text-text-1"
                : "text-text-3 hover:text-text-2"
            }`}
          >
            {value === "write" ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {value === "write" ? "Write" : "Preview"}
          </button>
        ))}

        {sample && tab === "preview" && (
          <span className="ml-auto text-xs text-text-3 truncate max-w-[16rem]">
            as {sample.name}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {tab === "write" ? (
          <>
            <Input
              label="Subject line"
              value={subject}
              disabled={disabled}
              placeholder="Quick question about {{company}}"
              onChange={(e) => onChange({ subject: e.target.value, body })}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-2">Email body</label>
              <textarea
                value={body}
                disabled={disabled}
                rows={14}
                placeholder={"Hi {{first_name|there}},\n\nI noticed {{company}} in {{city}}..."}
                onChange={(e) => onChange({ subject, body: e.target.value })}
                className="w-full bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-3 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-colors disabled:opacity-60"
              />
            </div>

            {fields.length > 0 && !disabled && (
              <div>
                <p className="text-xs text-text-3 mb-2">
                  Click to insert. Add a fallback with a pipe: {"{{first_name|there}}"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {fields.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => insertField(field)}
                      className="text-xs font-mono px-2 py-1 rounded-md bg-bg-3 border border-border text-text-2 hover:border-border-hover hover:text-text-1 transition-colors"
                    >
                      {field}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="border-b border-border pb-3">
              <p className="text-xs text-text-3 mb-1">Subject</p>
              <p className="text-sm font-medium text-text-1">
                {preview?.subject.text || <span className="text-text-3">Nothing yet</span>}
              </p>
            </div>
            <p className="text-sm text-text-2 whitespace-pre-wrap leading-relaxed">
              {preview?.body.text || <span className="text-text-3">Nothing yet</span>}
            </p>
          </div>
        )}

        {/* A placeholder nothing can fill is the failure that matters here: it
            reaches every recipient, not one, and it is invisible until sent. */}
        {unknown.length > 0 && (
          <Warning>
            No such field: {unknown.map((f) => `{{${f}}}`).join(", ")}. Nobody will receive this.
          </Warning>
        )}

        {unknown.length === 0 && unresolved.length > 0 && (
          <Warning>
            {unresolved.map((f) => `{{${f}}}`).join(", ")} is empty for this lead. Recipients
            missing it are skipped rather than mailed with a gap. Give it a fallback:{" "}
            {`{{${unresolved[0]}|...}}`}
          </Warning>
        )}
      </div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
