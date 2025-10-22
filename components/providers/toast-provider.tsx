'use client';

import { ReactNode } from 'react';
import { Toaster } from 'sonner';

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          duration: 4000,
        }}
      />
    </>
  );
}
