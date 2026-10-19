import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DayLog, FinishedEntry } from "../types";
import { dateKey } from "../utils/stats";

interface StatsState {
  /** Reading activity per local day, keyed "YYYY-MM-DD". */
  days: Record<string, DayLog>;
  /** History of finished books (survives deleting the book itself). */
  finished: FinishedEntry[];
  dailyGoal: number;
  nightOwl: boolean;
  earlyBird: boolean;
  recordReading: (entry: { pages: number; seconds: number; at?: Date }) => void;
  recordFinished: (bookId: string, title: string) => void;
  unrecordFinished: (bookId: string) => void;
  setDailyGoal: (goal: number) => void;
}

export const MIN_GOAL = 1;
export const MAX_GOAL = 500;

const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      days: {},
      finished: [],
      dailyGoal: 10,
      nightOwl: false,
      earlyBird: false,
      recordReading: ({ pages, seconds, at = new Date() }) => {
        if (pages <= 0 && seconds <= 0) return;
        const key = dateKey(at);
        const hour = at.getHours();
        set((state) => {
          const prev = state.days[key] ?? { pages: 0, seconds: 0 };
          return {
            days: {
              ...state.days,
              [key]: {
                pages: prev.pages + Math.max(0, pages),
                seconds: prev.seconds + Math.max(0, Math.round(seconds)),
              },
            },
            nightOwl: state.nightOwl || hour < 4,
            earlyBird: state.earlyBird || (hour >= 4 && hour < 7),
          };
        });
      },
      recordFinished: (bookId, title) =>
        set((state) =>
          state.finished.some((f) => f.bookId === bookId)
            ? state
            : {
                finished: [
                  ...state.finished,
                  { bookId, title, at: new Date().toISOString() },
                ],
              },
        ),
      unrecordFinished: (bookId) =>
        set((state) => ({
          finished: state.finished.filter((f) => f.bookId !== bookId),
        })),
      setDailyGoal: (goal) =>
        set({
          dailyGoal: Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(goal))),
        }),
    }),
    {
      name: "stats-storage",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

export default useStatsStore;
