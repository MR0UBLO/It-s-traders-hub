import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebar: (open) => set({ sidebarOpen: open }),
    }),
    { name: "th-app-store" }
  )
);
