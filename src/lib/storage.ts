import { DEFAULT_SETTINGS, type Settings } from './types'

const KEY = 'settings'

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(KEY)
  return { ...DEFAULT_SETTINGS, ...(stored[KEY] as Partial<Settings> | undefined) }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch }
  await chrome.storage.sync.set({ [KEY]: next })
  return next
}

export async function resetSettings(): Promise<Settings> {
  await chrome.storage.sync.set({ [KEY]: DEFAULT_SETTINGS })
  return DEFAULT_SETTINGS
}

/** Observa mudancas nas configuracoes (inclusive vindas de outra aba/janela). */
export function onSettingsChanged(listener: (settings: Settings) => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== 'sync' || !changes[KEY]) return
    listener({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue as Partial<Settings>) })
  }

  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}
