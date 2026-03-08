"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

export type SpiderAxes = {
  walkability: number;
  nourishment: number;
  wellness: number;
  greenery: number;
  buzz: number;
  essentials: number;
  safety: number;
  transit: number;
};

export const DEFAULT_AXES: SpiderAxes = {
  walkability: 50,
  nourishment: 50,
  wellness: 50,
  greenery: 50,
  buzz: 50,
  essentials: 50,
  safety: 50,
  transit: 50,
};

type Ctx = {
  prefs: SpiderAxes;
  setPrefs: (p: SpiderAxes) => void;
  hasProfile: boolean;
  chatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  widgetOpen: boolean;
  openWidget: () => void;
  closeWidget: () => void;
};

const SpiderPrefsContext = createContext<Ctx>({
  prefs: DEFAULT_AXES,
  setPrefs: () => {},
  hasProfile: false,
  chatOpen: false,
  openChat: () => {},
  closeChat: () => {},
  widgetOpen: false,
  openWidget: () => {},
  closeWidget: () => {},
});

export function SpiderPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsRaw] = useState<SpiderAxes>(DEFAULT_AXES);
  const [hasProfile, setHasProfile] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const { user } = useAuth();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load preferences from DB when user logs in
  useEffect(() => {
    if (!user || !supabase) return;
    supabase
      .from("user_preferences")
      .select("spider_axes")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.spider_axes) {
          setPrefsRaw(data.spider_axes as SpiderAxes);
          setHasProfile(true);
        }
      });
  }, [user]);

  const setPrefs = (p: SpiderAxes) => {
    setPrefsRaw(p);
    setHasProfile(true);
    // Debounced save to DB (600ms — avoids spamming on drag)
    if (!user || !supabase) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      supabase!
        .from("user_preferences")
        .upsert({ user_id: user.id, spider_axes: p }, { onConflict: "user_id" });
    }, 600);
  };

  return (
    <SpiderPrefsContext.Provider
      value={{
        prefs,
        setPrefs,
        hasProfile,
        chatOpen,
        openChat: () => setChatOpen(true),
        closeChat: () => setChatOpen(false),
        widgetOpen,
        openWidget: () => setWidgetOpen(true),
        closeWidget: () => setWidgetOpen(false),
      }}
    >
      {children}
    </SpiderPrefsContext.Provider>
  );
}

export function useSpiderPrefs() {
  return useContext(SpiderPrefsContext);
}
