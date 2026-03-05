import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RateAlert } from './types';

function genId(): string {
  return Math.random().toString(36).substring(2, 11);
}

interface AlertState {
  alerts: RateAlert[];
  addAlert: (alert: Omit<RateAlert, 'id' | 'createdAt'>) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  markTriggered: (id: string) => void;
}

export const useAlertStore = create<AlertState>()(
  persist(
    (set) => ({
      alerts: [],

      addAlert: (alert) =>
        set((s) => ({
          alerts: [
            { ...alert, id: genId(), createdAt: new Date().toISOString() },
            ...s.alerts,
          ],
        })),

      removeAlert: (id) =>
        set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

      toggleAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, isActive: !a.isActive } : a,
          ),
        })),

      markTriggered: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, triggered: true } : a,
          ),
        })),
    }),
    { name: 'rate-alerts-storage' },
  ),
);
