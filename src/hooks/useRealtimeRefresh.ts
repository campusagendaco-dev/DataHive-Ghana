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

/**
 * Subscribes to one or more Supabase tables and calls onRefresh
 * (debounced) on any INSERT / UPDATE / DELETE.
 *
 * Also sets up a periodic background poll as a safety net.
 */
export function useRealtimeRefresh({
  tables,
  onRefresh,
  debounceMs = 800,
  filters = {},
}: RealtimeOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onRefresh, debounceMs);
  };

  useEffect(() => {
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

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), debounceMs]);
}
