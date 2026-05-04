"use client";

import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  message: string | null;
  start: (message: string) => void;
  stop: () => void;
}

export const useLoading = create<LoadingState>((set) => ({
  isLoading: false,
  message: null,
  start: (message) => set({ isLoading: true, message }),
  stop: () => set({ isLoading: false, message: null }),
}));
```