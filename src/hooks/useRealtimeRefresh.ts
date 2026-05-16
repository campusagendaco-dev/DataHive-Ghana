import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type TableName = string;

interface RealtimeOptions {
  /** Tables to subscribe to. Triggers refetch on any change. */
  tables: TableName[];
  /** Called whenever any subscribed table changes. */
  onRefresh: () => void;
  /** Optional debounce ms (default 800) to avoid rapid re-fetches */
  debounceMs?: number;
  /** Optional filter per table, e.g. { wallets: "agent_id=eq.abc" } */
  filters?: Record<string, string>;
}

/** Poll interval (ms) — safety net for mobile where WebSocket dies in background */
const POLL_INTERVAL_MS = 30_000;

/**
 * Subscribes to one or more Supabase tables and calls onRefresh
 * (debounced) on any INSERT / UPDATE / DELETE.
 *
 * Also polls every 30 s as a safety net for mobile devices where the
 * OS kills WebSocket connections when the app is backgrounded.
 */
export function useRealtimeRefresh({
  tables,
  onRefresh,
  debounceMs = 800,
  filters = {},
}: RealtimeOptions) {
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef(onRefresh);

  // Keep the ref current so the poll closure always calls the latest callback
  // without needing it as a dependency (avoids infinite re-subscription loops)
  useEffect(() => { onRefreshRef.current = onRefresh; });

  const trigger = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onRefreshRef.current(), debounceMs);
  };

  useEffect(() => {
    // ── Realtime subscriptions ──────────────────────────────────────────────
    const channels = tables.map((table) => {
      const channelName = `realtime-refresh-${table}-${Math.random().toString(36).slice(2)}`;
      const filter = filters[table];

      const ch = supabase
        .channel(channelName)
        .on(
          "postgres_changes" as any,
          {
            event: "*",
            schema: "public",
            table,
            ...(filter ? { filter } : {}),
          },
          () => trigger(),
        )
        .subscribe();

      return ch;
    });

    // ── Polling fallback (catches missed events when WS is dead on mobile) ──
    pollRef.current = setInterval(() => {
      onRefreshRef.current();
    }, POLL_INTERVAL_MS);

    // ── Re-fetch immediately when tab regains focus (app foregrounded) ──────
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") trigger();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollRef.current)  clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), debounceMs]);
}
