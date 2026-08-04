import { getDomain, getGroupLabel, groupBy, hashString } from './domain'
import { getSettings } from './storage'
import {
  GROUP_COLORS,
  UNGROUPED,
  type GroupColor,
  type GroupInfo,
  type Settings,
  type TabInfo,
} from './types'

/** As APIs de abas pedem uma tupla nao-vazia; devolve null quando nao ha o que fazer. */
type TabIdList = [number, ...number[]]

function nonEmpty(tabIds: readonly number[]): TabIdList | null {
  return tabIds.length > 0 ? ([...tabIds] as TabIdList) : null
}

export function toTabInfo(tab: chrome.tabs.Tab): TabInfo {
  const url = tab.url ?? tab.pendingUrl ?? ''
  return {
    id: tab.id ?? -1,
    windowId: tab.windowId,
    index: tab.index,
    title: tab.title?.trim() || url || 'Sem titulo',
    url,
    domain: getDomain(url),
    favIconUrl: tab.favIconUrl,
    active: tab.active,
    pinned: tab.pinned,
    audible: tab.audible ?? false,
    muted: tab.mutedInfo?.muted ?? false,
    discarded: tab.discarded ?? false,
    groupId: tab.groupId ?? UNGROUPED,
  }
}

function toGroupInfo(group: chrome.tabGroups.TabGroup): GroupInfo {
  return {
    id: group.id,
    title: group.title ?? '',
    color: group.color,
    collapsed: group.collapsed,
    windowId: group.windowId,
  }
}

export async function getCurrentWindowId(): Promise<number> {
  const win = await chrome.windows.getCurrent()
  return win.id ?? chrome.windows.WINDOW_ID_CURRENT
}

export async function listTabs(windowId?: number): Promise<TabInfo[]> {
  const tabs = await chrome.tabs.query(windowId == null ? {} : { windowId })
  return tabs.filter((tab) => tab.id != null).map(toTabInfo)
}

export async function listGroups(windowId?: number): Promise<GroupInfo[]> {
  const groups = await chrome.tabGroups.query(windowId == null ? {} : { windowId })
  return groups.map(toGroupInfo)
}

export async function activateTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId)
  await chrome.windows.update(tab.windowId, { focused: true })
  await chrome.tabs.update(tabId, { active: true })
}

export async function closeTabs(tabIds: number[]): Promise<void> {
  const ids = nonEmpty(tabIds)
  if (ids) await chrome.tabs.remove(ids)
}

export async function setTabMuted(tabId: number, muted: boolean): Promise<void> {
  await chrome.tabs.update(tabId, { muted })
}

export async function setTabPinned(tabId: number, pinned: boolean): Promise<void> {
  await chrome.tabs.update(tabId, { pinned })
}

export interface CreateGroupOptions {
  title: string
  color: GroupColor
  collapsed?: boolean
  windowId?: number
}

/** Cria um grupo com as abas informadas e devolve o id do grupo. */
export async function groupTabs(
  tabIds: number[],
  { title, color, collapsed = false, windowId }: CreateGroupOptions,
): Promise<number | null> {
  const ids = nonEmpty(tabIds)
  if (!ids) return null

  const groupId = await chrome.tabs.group({
    tabIds: ids,
    ...(windowId == null ? {} : { createProperties: { windowId } }),
  })
  await chrome.tabGroups.update(groupId, { title, color, collapsed })
  return groupId
}

/** Adiciona abas a um grupo ja existente. */
export async function addTabsToGroup(tabIds: number[], groupId: number): Promise<void> {
  const ids = nonEmpty(tabIds)
  if (ids) await chrome.tabs.group({ tabIds: ids, groupId })
}

export async function ungroupTabs(tabIds: number[]): Promise<void> {
  const ids = nonEmpty(tabIds)
  if (ids) await chrome.tabs.ungroup(ids)
}

export async function updateGroup(
  groupId: number,
  patch: { title?: string; color?: GroupColor; collapsed?: boolean },
): Promise<void> {
  await chrome.tabGroups.update(groupId, patch)
}

/** Fecha todas as abas de um grupo (o grupo some junto). */
export async function closeGroup(groupId: number): Promise<void> {
  const tabs = await chrome.tabs.query({ groupId })
  await closeTabs(tabs.map((tab) => tab.id).filter((id): id is number => id != null))
}

export async function ungroupAll(windowId: number): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId })
  const grouped = tabs
    .filter((tab) => tab.groupId != null && tab.groupId !== UNGROUPED && tab.id != null)
    .map((tab) => tab.id as number)
  await ungroupTabs(grouped)
}

export async function collapseAll(windowId: number, collapsed: boolean): Promise<void> {
  const groups = await chrome.tabGroups.query({ windowId })
  await Promise.all(groups.map((group) => chrome.tabGroups.update(group.id, { collapsed })))
}

/** Recolhe todos os grupos menos o da aba ativa — util para focar no que importa. */
export async function collapseOthers(windowId: number): Promise<void> {
  const [active] = await chrome.tabs.query({ windowId, active: true })
  const groups = await chrome.tabGroups.query({ windowId })
  await Promise.all(
    groups.map((group) =>
      chrome.tabGroups.update(group.id, { collapsed: group.id !== active?.groupId }),
    ),
  )
}

export function colorForDomain(domain: string): GroupColor {
  // 'grey' fica reservado para grupos sem cor definida.
  const palette = GROUP_COLORS.filter((color) => color !== 'grey')
  return palette[hashString(domain) % palette.length] as GroupColor
}

export interface GroupByDomainResult {
  createdGroups: number
  groupedTabs: number
}

/**
 * Agrupa as abas da janela por dominio. Abas fixadas sao ignoradas e dominios
 * com menos de `minTabsPerGroup` abas ficam de fora.
 */
export async function groupByDomain(
  windowId: number,
  overrides: Partial<Settings> = {},
): Promise<GroupByDomainResult> {
  const settings = { ...(await getSettings()), ...overrides }
  const tabs = (await listTabs(windowId)).filter((tab) => !tab.pinned)
  const existing = await listGroups(windowId)

  const result: GroupByDomainResult = { createdGroups: 0, groupedTabs: 0 }

  for (const [domain, domainTabs] of groupBy(tabs, (tab) => tab.domain)) {
    if (settings.ignoredDomains.includes(domain)) continue
    if (domainTabs.length < Math.max(1, settings.minTabsPerGroup)) continue

    const label = getGroupLabel(domain)
    const color = settings.colorizeByDomain ? colorForDomain(domain) : settings.defaultColor
    const target = existing.find((group) => group.title === label)
    const tabIds = domainTabs
      .filter((tab) => tab.groupId !== (target?.id ?? UNGROUPED))
      .map((tab) => tab.id)

    if (tabIds.length === 0) continue

    if (target) {
      await addTabsToGroup(tabIds, target.id)
    } else {
      await groupTabs(tabIds, {
        title: label,
        color,
        collapsed: settings.collapseNewGroups,
        windowId,
      })
      result.createdGroups++
    }
    result.groupedTabs += tabIds.length
  }

  return result
}

/**
 * Coloca uma aba recem-aberta no grupo do seu dominio, se ja existir um.
 * Nao cria grupos novos: so encaixa a aba onde ela pertence.
 */
export async function autoGroupTab(tab: chrome.tabs.Tab): Promise<void> {
  const settings = await getSettings()
  if (!settings.autoGroupNewTabs) return
  if (tab.id == null || tab.pinned) return
  if (tab.groupId != null && tab.groupId !== UNGROUPED) return

  const domain = getDomain(tab.url || tab.pendingUrl)
  if (settings.ignoredDomains.includes(domain) || domain === 'outros') return

  const label = getGroupLabel(domain)
  const groups = await chrome.tabGroups.query({ windowId: tab.windowId, title: label })
  if (groups.length > 0) {
    await addTabsToGroup([tab.id], groups[0]!.id)
    return
  }

  // Sem grupo pronto: cria um se ja houver outras abas do mesmo dominio soltas.
  const siblings = (await listTabs(tab.windowId)).filter(
    (other) => other.domain === domain && !other.pinned && other.groupId === UNGROUPED,
  )
  if (siblings.length < Math.max(2, settings.minTabsPerGroup)) return

  await groupTabs(
    siblings.map((other) => other.id),
    {
      title: label,
      color: settings.colorizeByDomain ? colorForDomain(domain) : settings.defaultColor,
      collapsed: false,
      windowId: tab.windowId,
    },
  )
}
