import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCurrentWindowId, listGroups, listTabs } from '@/lib/tabs'
import type { GroupInfo, TabInfo } from '@/lib/types'

interface TabsState {
  windowId: number | null
  tabs: TabInfo[]
  groups: GroupInfo[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Mantem abas e grupos da janela atual sincronizados com o Chrome.
 * Os eventos sao debounced porque uma unica acao (agrupar N abas) dispara varios.
 */
export function useTabs(): TabsState {
  const [windowId, setWindowId] = useState<number | null>(null)
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const refresh = useCallback(async () => {
    try {
      const id = await getCurrentWindowId()
      const [nextTabs, nextGroups] = await Promise.all([listTabs(id), listGroups(id)])
      setWindowId(id)
      setTabs(nextTabs)
      setGroups(nextGroups)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()

    const schedule = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void refresh(), 80)
    }

    const events: Array<{ addListener: (cb: () => void) => void; removeListener: (cb: () => void) => void }> = [
      chrome.tabs.onCreated,
      chrome.tabs.onRemoved,
      chrome.tabs.onUpdated,
      chrome.tabs.onMoved,
      chrome.tabs.onActivated,
      chrome.tabs.onAttached,
      chrome.tabs.onDetached,
      chrome.tabGroups.onCreated,
      chrome.tabGroups.onUpdated,
      chrome.tabGroups.onRemoved,
      chrome.tabGroups.onMoved,
    ]

    events.forEach((event) => event.addListener(schedule))
    return () => {
      window.clearTimeout(timer.current)
      events.forEach((event) => event.removeListener(schedule))
    }
  }, [refresh])

  return useMemo(
    () => ({ windowId, tabs, groups, loading, error, refresh }),
    [windowId, tabs, groups, loading, error, refresh],
  )
}
