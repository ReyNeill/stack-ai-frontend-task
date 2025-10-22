'use client';

import { create } from 'zustand';
import type { ParsedResource, ResourceSelectionMap } from '@/lib/file-picker/types';
import { pruneSelectionsAgainst } from '@/lib/file-picker/transform';

interface SelectionState {
  items: ResourceSelectionMap;
  toggle: (resource: ParsedResource) => void;
  addMany: (resources: ParsedResource[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  items: new Map(),
  toggle(resource) {
    set((state) => {
      if (state.items.has(resource.id)) {
        const next = new Map(state.items);
        next.delete(resource.id);
        return { items: next };
      }

      const existing = Array.from(state.items.values());
      const pruned = pruneSelectionsAgainst(existing, resource);
      const next = new Map(pruned.map((item) => [item.id, item] as const));
      next.set(resource.id, resource);

      return { items: next };
    });
  },
  addMany(resources) {
    set((state) => {
      let next = new Map(state.items);

      resources.forEach((resource) => {
        const existing = Array.from(next.values());
        const pruned = pruneSelectionsAgainst(existing, resource);
        next = new Map(pruned.map((item) => [item.id, item] as const));
        next.set(resource.id, resource);
      });

      return { items: next };
    });
  },
  clear() {
    set({ items: new Map() });
  },
  isSelected(id) {
    return get().items.has(id);
  },
}));
