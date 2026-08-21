"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { GOAL_PRESETS, TONES, getGoalPreset, type GoalPreset } from "@/lib/utils/profiles";
import type { SenderProfile, SenderTone } from "@/lib/utils/types";

// Onboarding captures the sender profile: who is writing, what they want, and
// who they are writing to. Every generated message, and the way leads are
// scored, is derived from these answers.

interface FormState {
  sender_name: string;
  sender_role: string;
  organization: string;
  offer: string;
  audience: string;
  credibility: string;
  cta: string;
  tone: SenderTone;
}

const EMPTY: FormState = {
  sender_name: "",
  sender_role: "",
  organization: "",
  offer: "",
  audience: "",
  credibility: "",
  cta: "",
  tone: "direct",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [preset, setPreset] = useState<GoalPreset | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Revisiting this page edits the existing profile rather than starting over.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile }: { profile: SenderProfile }) => {
        if (cancelled || !profile?.sender_name) return;
        setForm({
          sender_name:  profile.sender_name,
          sender_role:  profile.sender_role,
          organization: profile.organization ?? "",
          offer:        profile.offer,
          audience:     profile.audience,
          credibility:  profile.credibility ?? "",
          cta:          profile.cta,
          tone:         profile.tone,
        });
        setPreset(getGoalPreset(profile.goal));
      })
      .catch(() => {
        // First-time users have nothing to load. The blank form is correct.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function choose(p: GoalPreset) {
    setPreset(p);
    setForm((f) => ({ ...f, tone: p.default_tone, cta: f.cta || p.placeholders.cta }));
    setStep(1);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!preset) return;

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: preset.goal, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save your profile");

      toast("Profile saved. Everything is tuned to you now.", "success");
      router.push("/prospect");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save your profile", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Step 1: pick a goal ────────────────────────────────────────────────────

  if (step === 0 || !preset) {
    return (
      <Shell
        title="What are you using this for?"
        subtitle="This shapes the messages you generate and how leads get ranked. You can change it later."
      >
        <div className="grid sm:grid-cols-2 gap-3">
          {GOAL_PRESETS.map((p) => (
            <button
              key={p.goal}
              type="button"
              onClick={() => choose(p)}
              className="text-left bg-bg-2 border border-border rounded-xl p-4 hover:border-gold hover:bg-bg-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <div className="text-sm font-semibold text-text-1">{p.label}</div>
              <div className="text-xs text-text-3 mt-1 leading-relaxed">{p.tagline}</div>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  // ── Step 2: describe yourself ──────────────────────────────────────────────

  return (
    <Shell
      title={preset.label}
      subtitle="Answer in your own words. The more specific you are, the less generic your outreach reads."
      onBack={() => setStep(0)}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Your name"
            placeholder="Simeon Gabriel"
            value={form.sender_name}
            onChange={(e) => set("sender_name", e.target.value)}
            required
          />
          <Input
            label={preset.labels.sender_role}
            placeholder={preset.placeholders.sender_role}
            value={form.sender_role}
            onChange={(e) => set("sender_role", e.target.value)}
            required
          />
        </div>

        <Input
          label={preset.labels.organization}
          placeholder={preset.placeholders.organization}
          value={form.organization}
          onChange={(e) => set("organization", e.target.value)}
        />

        <Field
          label={preset.labels.offer}
          hint="This is the single most important answer. Write it the way you would say it out loud."
          placeholder={preset.placeholders.offer}
          value={form.offer}
          onChange={(v) => set("offer", v)}
          rows={3}
          required
        />

        <Field
          label={preset.labels.audience}
          placeholder={preset.placeholders.audience}
          value={form.audience}
          onChange={(v) => set("audience", v)}
          rows={2}
          required
        />

        <Field
          label={preset.labels.credibility}
          hint="Only what is true. Nothing here gets invented or embellished."
          placeholder={preset.placeholders.credibility}
          value={form.credibility}
          onChange={(v) => set("credibility", v)}
          rows={2}
        />

        {preset.goal !== "research" && (
          <Input
            label={preset.labels.cta}
            placeholder={preset.placeholders.cta}
            value={form.cta}
            onChange={(e) => set("cta", e.target.value)}
          />
        )}

        <div>
          <div className="text-sm font-medium text-text-2 mb-2">How should it sound?</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set("tone", t.value)}
                className={
                  "text-left rounded-lg border p-2.5 transition-colors " +
                  (form.tone === t.value
                    ? "border-gold bg-gold-dim"
                    : "border-border bg-bg-2 hover:border-border-hover")
                }
              >
                <div className="text-xs font-semibold text-text-1 flex items-center gap-1">
                  {t.label}
                  {form.tone === t.value && <Check className="h-3 w-3 text-gold" />}
                </div>
                <div className="text-[11px] text-text-3 mt-0.5 leading-snug">
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" size="lg" loading={saving} className="mt-2">
          Start finding leads
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </Shell>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

function Shell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-0 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-2xl animate-fade-up">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-text-3 hover:text-text-1 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        )}
        <h1 className="text-2xl font-bold text-text-1">{title}</h1>
        <p className="text-text-3 mt-1.5 mb-7 text-sm leading-relaxed">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

// Multi-line counterpart to the Input primitive, matching its styling.
function Field({
  label,
  hint,
  placeholder,
  value,
  onChange,
  rows = 3,
  required,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-text-2">{label}</label>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-colors resize-y"
      />
      {hint && <p className="text-xs text-text-3">{hint}</p>}
    </div>
  );
}
