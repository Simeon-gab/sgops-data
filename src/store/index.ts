import { create } from "zustand";
import type { Lead, Workspace } from "@/lib/utils/types";

interface AppState {
  workspace: Workspace | null;
  setWorkspace: (workspace: Workspace | null) => void;

  leads: Lead[];
  setLeads: (leads: Lead[]) => void;
  upsertLead: (lead: Lead) => void;

  selectedLeadId: string | null;
  setSelectedLeadId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  workspace: null,
  setWorkspace: (workspace) => set({ workspace }),

  leads: [],
  setLeads: (leads) => set({ leads }),
  upsertLead: (lead) =>
    set((state) => {
      const idx = state.leads.findIndex((l) => l.id === lead.id);
      if (idx === -1) return { leads: [lead, ...state.leads] };
      const next = [...state.leads];
      next[idx] = lead;
      return { leads: next };
    }),

  selectedLeadId: null,
  setSelectedLeadId: (id) => set({ selectedLeadId: id }),
}));
