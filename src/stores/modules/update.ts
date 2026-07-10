import { create } from "zustand";

import type { UpdateInfo } from "@/services/modules/update";

interface UpdateState {
  available: boolean;
  version: string;
  set: (available: boolean, version: string) => void;
  setFromInfo: (info: UpdateInfo, skippedVersion?: string) => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  available: false,
  version: "",
  set: (available, version) => set({ available, version }),
  setFromInfo: (info, skippedVersion = "") => {
    const available = info.available && info.version !== skippedVersion;
    set({
      available,
      version: available ? info.version : "",
    });
  },
}));
