'use client';

import { create } from 'zustand';
import type { ParsedResource, ResourceSelectionMap } from '@/lib/file-picker/types';
import { pruneSelectionsAgainst } from '@/lib/file-picker/transform';

const ensureDirectoryPath = (path: string): string => {
  if (!path) {
    return '/';
  }
  return path.endsWith('/') ? path : `${path}/`;
};

const hasDirectoryCoverage = (
  items: ResourceSelectionMap,
  resource: ParsedResource
): boolean => {
  for (const selected of items.values()) {
    if (selected.type !== 'directory') continue;
    if (selected.id === resource.id) {
      return true;
    }

    const directoryPath = ensureDirectoryPath(selected.fullPath);
    if (resource.fullPath.startsWith(directoryPath)) {
      return true;
    }
  }

  return false;
};

interface SelectionState {
  items: ResourceSelectionMap;
  toggle: (resource: ParsedResource) => void;
  addMany: (resources: ParsedResource[]) => void;
  clear: () => void;
  isSelected: (resource: ParsedResource | string) => boolean;
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

      if (hasDirectoryCoverage(state.items, resource)) {
        return state;
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
        if (next.has(resource.id)) {
          return;
        }

        if (hasDirectoryCoverage(next, resource)) {
          return;
        }

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
    if (typeof id === 'string') {
      return get().items.has(id);
    }

    const items = get().items;
    if (items.has(id.id)) {
      return true;
    }

    return hasDirectoryCoverage(items, id);
  },
}));
