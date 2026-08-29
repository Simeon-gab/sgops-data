import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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

export const useAppStore = create<AppState>()(
  persist<AppState>(
    (set) => ({
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
    }),
    {
      name: "sgops-prospect",
      // Per tab, and gone when the tab is. Memory alone was not enough: a
      // reload, or a redirect that crosses a full document load, threw the
      // search away and left the form blank. Not localStorage, because a
      // window opened days later should not reopen a stale result set.
      storage: createJSONStorage(() => sessionStorage),
      // Only the search. The rest is either server truth refetched on mount
      // (workspace, leads) or scoped to a single visit (selectedLeadId).
      partialize: (state) =>
        ({
          prospectRequest: state.prospectRequest,
          prospectResult: state.prospectResult,
        }) as AppState,
      // Reading storage during module init would fill the first client render
      // while the server had rendered an empty page, which React reports as a
      // hydration mismatch. rehydrateProspectState() does it after mount.
      skipHydration: true,
    }
  )
);

// Called by the prospect page on mount. Runs on every mount rather than once
// per document, because the page can be mounted before any search exists and
// again after one does, and a flag set on that first pass would skip the read
// that actually had something to restore.
export function rehydrateProspectState(): void {
  // A result already in memory is at least as fresh as the stored one, so there
  // is nothing to gain by reading over it.
  if (useAppStore.getState().prospectResult) return;
  void useAppStore.persist.rehydrate();
}
