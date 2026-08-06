import {
  domainMatches,
  getDomain,
  getGroupLabel,
  groupBy,
  hashString,
  isSiteDomain,
  sameLabel,
} from './domain'
import { getSettings } from './storage'
import {
  GROUP_COLORS,
  groupCollapseKey,
  UNGROUPED,
  type GroupColor,
  type GroupInfo,
  type GroupPreset,
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

  let groupId: number
  try {
    groupId = await chrome.tabs.group({
      tabIds: ids,
      ...(windowId == null ? {} : { createProperties: { windowId } }),
    })
  } catch (error) {
    // O Chrome recusa createProperties em algumas situacoes (aba ainda carregando,
    // janela em transicao). Sem windowId o grupo nasce na janela das proprias abas.
    console.warn('[tab-group] tabs.group com windowId falhou, tentando sem:', error)
    groupId = await chrome.tabs.group({ tabIds: ids })
  }

  await chrome.tabGroups.update(groupId, { title, color })
  // Recolher e uma etapa separada: o Chrome recusa recolher o grupo que contem a
  // aba ativa (comum quando o grupo nasce com uma aba so). Falhar aqui nao pode
  // desfazer o nome/cor nem derrubar quem chamou.
  if (collapsed) {
    try {
      await chrome.tabGroups.update(groupId, { collapsed: true })
    } catch (error) {
      // Fica na fila: recolhe na primeira troca de aba, quando a aba ativa sair.
      console.warn('[tab-group] grupo', groupId, 'nao pode ser recolhido agora:', error)
      await rememberPendingCollapse(groupId)
    }
  }
  return groupId
}

/**
 * Grupos que pediram para nascer recolhidos mas continham a aba ativa — o Chrome
 * recusa recolher esse grupo, e com "minimo 1 aba" isso e a regra, nao a excecao.
 * Fica em `storage.session` porque o service worker morre entre os eventos.
 */
const PENDING_COLLAPSE_KEY = 'pendingCollapse'

async function readPendingCollapse(): Promise<number[]> {
  const stored = await chrome.storage.session.get(PENDING_COLLAPSE_KEY)
  return (stored[PENDING_COLLAPSE_KEY] as number[] | undefined) ?? []
}

async function rememberPendingCollapse(groupId: number): Promise<void> {
  const ids = new Set(await readPendingCollapse())
  ids.add(groupId)
  await chrome.storage.session.set({ [PENDING_COLLAPSE_KEY]: [...ids] })
}

/**
 * Nova tentativa de recolher os grupos da fila. Quem continua com a aba ativa
 * dentro fica para a proxima; grupo que nao existe mais sai da fila.
 */
export async function collapsePendingGroups(): Promise<number> {
  const ids = await readPendingCollapse()
  if (ids.length === 0) return 0

  const remaining: number[] = []
  let collapsed = 0

  for (const id of ids) {
    try {
      await chrome.tabGroups.update(id, { collapsed: true })
      collapsed++
    } catch {
      const alive = await chrome.tabGroups
        .get(id)
        .then(() => true)
        .catch(() => false)
      if (alive) remaining.push(id)
    }
  }

  await chrome.storage.session.set({ [PENDING_COLLAPSE_KEY]: remaining })
  return collapsed
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

/**
 * Recolhe/expande todos os grupos da janela. Cada grupo e tratado isoladamente:
 * o Chrome recusa recolher o grupo que contem a aba ativa, e isso nao deve
 * impedir que os outros sejam recolhidos.
 */
export async function collapseAll(windowId: number, collapsed: boolean): Promise<number> {
  const groups = await chrome.tabGroups.query({ windowId })
  const results = await Promise.all(
    groups.map((group) =>
      chrome.tabGroups
        .update(group.id, { collapsed })
        .then(() => true)
        .catch((error) => {
          console.warn('[tab-group] grupo', group.id, 'nao pode ser alterado:', error)
          return false
        }),
    ),
  )
  return results.filter(Boolean).length
}

/**
 * Decide, pelo nome, se o grupo deve recolher na troca de aba. Ordem: a
 * preferencia do proprio grupo, depois a predefinicao de mesmo nome (legado), e
 * por fim a opcao geral. Devolve tambem o motivo, para o log.
 */
export function shouldCollapseGroup(
  title: string,
  settings: Settings,
): { collapse: boolean; reason: string } {
  const own = settings.groupCollapse[groupCollapseKey(title)]
  if (own !== undefined) {
    return { collapse: own, reason: own ? 'preferencia do grupo' : 'grupo marcado para ficar aberto' }
  }

  const preset = settings.presets.find((item) => sameLabel(item.title, title))
  if (preset?.collapseOnTabSwitch === false) {
    return { collapse: false, reason: 'predefinicao antiga pede para ficar aberto' }
  }

  return {
    collapse: settings.collapseOnTabSwitch,
    reason: settings.collapseOnTabSwitch ? 'opcao geral' : 'opcao geral desligada',
  }
}

/**
 * Recolhe os grupos da janela na troca de aba, conforme `shouldCollapseGroup`.
 * O grupo que contem a aba recem-ativada fica de fora: e onde o usuario esta.
 * Devolve quantos foram recolhidos.
 *
 * Registra no console a decisao de cada grupo — e a unica forma de ver por que
 * um grupo nao recolheu (aba ativa dentro, preferencia propria, ou opcao geral
 * desligada).
 */
export async function collapseForTabSwitch(
  windowId: number,
  settings: Settings,
): Promise<number> {
  const groups = await chrome.tabGroups.query({ windowId })
  // A aba ativa e consultada de proposito em vez de deixar o Chrome recusar o
  // recolher: a recusa e um erro sem codigo proprio, indistinguivel de falha de
  // verdade, e viraria erro no log a cada troca de aba.
  const [active] = await chrome.tabs.query({ windowId, active: true })
  const activeGroupId = active?.groupId ?? UNGROUPED

  const decisions = await Promise.all(
    groups.map(async (group) => {
      const label = `"${group.title ?? ''}"`
      if (group.id === activeGroupId) return { ok: false, note: `${label}: contem a aba ativa` }

      const { collapse, reason } = shouldCollapseGroup(group.title ?? '', settings)
      if (!collapse) return { ok: false, note: `${label}: intacto (${reason})` }
      if (group.collapsed) return { ok: false, note: `${label}: ja estava recolhido` }

      try {
        await chrome.tabGroups.update(group.id, { collapsed: true })
        return { ok: true, note: `${label}: recolhido` }
      } catch (error) {
        // Sobra o inesperado: aba sendo arrastada, janela em transicao.
        return { ok: false, note: `${label}: recusado pelo Chrome (${String(error)})` }
      }
    }),
  )

  const report = decisions.map((item) => item.note).join(' | ') || '(nenhum grupo)'
  console.log(`[tab-group] janela ${windowId}: ${report}`)
  return decisions.filter((item) => item.ok).length
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
    // Paginas internas (nova aba, chrome://, file://) nao formam grupo: com
    // minimo 1 cada uma viraria um grupo "navegador"/"arquivos" sem sentido.
    if (!isSiteDomain(domain)) continue
    if (settings.ignoredDomains.some((entry) => domainMatches(domain, entry))) continue
    if (domainTabs.length < Math.max(1, settings.minTabsPerGroup)) continue

    const label = getGroupLabel(domain)
    const color = settings.colorizeByDomain ? colorForDomain(domain) : settings.defaultColor
    const target = existing.find((group) => sameLabel(group.title, label))
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

/** Predefinicao que cobre o dominio (subdominios e portas seguem `domainMatches`). */
export function matchPreset(domain: string, presets: GroupPreset[]): GroupPreset | undefined {
  return presets.find((preset) => preset.domains.some((entry) => domainMatches(domain, entry)))
}

/** Grupo da janela cujo nome bate com o rotulo, ignorando caixa. */
async function findGroupByLabel(windowId: number, label: string): Promise<number | null> {
  const groups = await chrome.tabGroups.query({ windowId })
  return groups.find((group) => sameLabel(group.title ?? '', label))?.id ?? null
}

/**
 * Coloca uma aba recem-aberta no grupo certo, conforme o modo configurado.
 * No modo "dominio" nao cria grupo com uma aba so; no modo "predefinicao" cria.
 * Devolve uma descricao da decisao (util para depurar no console do worker).
 */
export async function autoGroupTab(tab: chrome.tabs.Tab): Promise<string> {
  const settings = await getSettings()
  if (!settings.autoGroupNewTabs) return 'agrupamento automatico desligado'
  if (tab.id == null || tab.pinned) return 'aba fixada ou sem id'
  if (tab.groupId != null && tab.groupId !== UNGROUPED) return 'aba ja esta em um grupo'

  const domain = getDomain(tab.url || tab.pendingUrl)
  // Nova aba, chrome://, file:// e afins nao viram grupo: sem isso toda pagina
  // interna cairia no mesmo grupo e a aba ficaria presa nele ao navegar depois.
  if (!isSiteDomain(domain)) return `pagina interna (${domain}) nao e agrupada`
  if (settings.ignoredDomains.some((entry) => domainMatches(domain, entry))) {
    return `${domain} esta na lista de ignorados`
  }

  const minimum = Math.max(1, settings.minTabsPerGroup)
  const openTabs = await listTabs(tab.windowId)
  const isLoose = (other: TabInfo) => !other.pinned && other.groupId === UNGROUPED

  if (settings.autoGroupMode === 'preset') {
    const preset = matchPreset(domain, settings.presets)
    if (!preset || !preset.title.trim()) {
      return `modo predefinicao: nenhuma predefinicao cobre ${domain}`
    }

    const label = preset.title.trim()
    const existingId = await findGroupByLabel(tab.windowId, label)
    if (existingId != null) {
      await addTabsToGroup([tab.id], existingId)
      return `modo predefinicao: ${domain} entrou no grupo "${label}"`
    }

    // Sem grupo pronto: junta todas as abas soltas cobertas pela mesma predefinicao.
    const siblings = openTabs.filter(
      (other) => isLoose(other) && matchPreset(other.domain, settings.presets)?.id === preset.id,
    )
    if (siblings.length < minimum) {
      return `modo predefinicao: so ${siblings.length} aba(s) de "${label}" soltas (minimo ${minimum})`
    }

    const created = await groupTabs(
      siblings.map((other) => other.id),
      { title: label, color: preset.color, collapsed: settings.collapseNewGroups, windowId: tab.windowId },
    )
    return created == null
      ? `modo predefinicao: falhou ao criar o grupo "${label}"`
      : `modo predefinicao: criou o grupo "${label}" com ${siblings.length} aba(s)`
  }

  const label = getGroupLabel(domain)
  // Busca sem diferenciar maiusculas: um grupo "YouTube" criado a mao tambem serve.
  const existingId = await findGroupByLabel(tab.windowId, label)
  if (existingId != null) {
    await addTabsToGroup([tab.id], existingId)
    return `modo dominio: ${domain} entrou no grupo "${label}"`
  }

  // Sem grupo pronto: cria um se ja houver abas suficientes do mesmo dominio soltas.
  const siblings = openTabs.filter((other) => isLoose(other) && other.domain === domain)
  if (siblings.length < minimum) {
    return `modo dominio: so ${siblings.length} aba(s) de ${domain} soltas (minimo ${minimum})`
  }

  const created = await groupTabs(
    siblings.map((other) => other.id),
    {
      title: label,
      color: settings.colorizeByDomain ? colorForDomain(domain) : settings.defaultColor,
      collapsed: settings.collapseNewGroups,
      windowId: tab.windowId,
    },
  )
  return created == null
    ? `modo dominio: falhou ao criar o grupo "${label}"`
    : `modo dominio: criou o grupo "${label}" com ${siblings.length} aba(s)`
}
