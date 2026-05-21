/**
 * Hook that exposes the aggregated video state for the active tab and the
 * actions the popup can trigger.
 *
 * It polls the background every `POLL_MS` while the popup is open — popups have
 * a short lifetime, so a light poll is simpler and more robust than a
 * long-lived port, and keeps playback positions reasonably fresh.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from '@/utils/browser';
import type { PopupToBackground, TabState } from '@/types';

const POLL_MS = 1500;
const EMPTY: TabState = { videos: [], pipActive: false };

interface UseTabVideos {
  state: TabState;
  loading: boolean;
  tabId: number | null;
  togglePip: (videoId: string) => void;
  exitPip: () => void;
  focusNext: () => void;
  refresh: () => void;
}

async function resolveActiveTabId(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

export function useTabVideos(): UseTabVideos {
  const [state, setState] = useState<TabState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const tabIdRef = useRef<number | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);

  const send = useCallback(async (message: PopupToBackground): Promise<unknown> => {
    try {
      return await browser.runtime.sendMessage(message);
    } catch {
      return undefined;
    }
  }, []);

  const fetchState = useCallback(async (): Promise<void> => {
    const id = tabIdRef.current;
    if (id == null) return;
    const next = (await send({ kind: 'GET_STATE', tabId: id })) as TabState | undefined;
    if (next) setState(next);
    setLoading(false);
  }, [send]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async (): Promise<void> => {
      if (cancelled) return;
      await fetchState();
      timer = setTimeout(loop, POLL_MS);
    };

    void (async () => {
      const id = await resolveActiveTabId();
      if (cancelled) return;
      tabIdRef.current = id;
      setTabId(id);
      if (id == null) {
        setLoading(false);
        return;
      }
      void loop();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchState]);

  const withTab = useCallback(
    (build: (id: number) => PopupToBackground) => {
      const id = tabIdRef.current;
      if (id == null) return;
      void send(build(id)).then(() => fetchState());
    },
    [send, fetchState],
  );

  return {
    state,
    loading,
    tabId,
    togglePip: (videoId) => withTab((id) => ({ kind: 'TOGGLE_PIP', tabId: id, videoId })),
    exitPip: () => withTab((id) => ({ kind: 'EXIT_PIP', tabId: id })),
    focusNext: () => withTab((id) => ({ kind: 'FOCUS_NEXT', tabId: id })),
    refresh: () => void fetchState(),
  };
}
