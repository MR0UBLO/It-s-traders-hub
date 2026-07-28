import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccountMode = "real" | "demo";

interface AccountStore {
  mode: AccountMode;
  setMode: (mode: AccountMode) => void;
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      mode: "real",
      setMode: (mode) => set({ mode }),
    }),
    { name: "th-account-store" }
  )
);
