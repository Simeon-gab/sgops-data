import { create } from "zustand";
import type { Lead, Workspace, ProspectRequest, ProspectApiResponse } from "@/lib/utils/types";

interface AppState {
  workspace: Workspace | null;
  setWorkspace: (workspace: Workspace | null) => void;

  leads: Lead[];
  setLeads: (leads: Lead[]) => void;
  upsertLead: (lead: Lead) => void;

  selectedLeadId: string | null;
  setSelectedLeadId: (id: string | null) => void;

  // Persists prospect page state across navigation so the back button restores it
  prospectRequest: ProspectRequest | null;
  prospectResult: ProspectApiResponse | null;
  setProspectState: (request: ProspectRequest, result: ProspectApiResponse) => void;
  clearProspectState: () => void;
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

  prospectRequest: null,
  prospectResult: null,
  setProspectState: (request, result) => set({ prospectRequest: request, prospectResult: result }),
  clearProspectState: () => set({ prospectRequest: null, prospectResult: null }),
}));
