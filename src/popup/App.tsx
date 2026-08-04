import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  activateTab,
  closeGroup,
  closeTabs,
  collapseAll,
  groupByDomain,
  groupTabs,
  setTabMuted,
  setTabPinned,
  ungroupAll,
  ungroupTabs,
  updateGroup,
} from '@/lib/tabs'
import { getSettings } from '@/lib/storage'
import { getGroupLabel } from '@/lib/domain'
import { UNGROUPED, type GroupColor, type GroupInfo, type TabInfo } from '@/lib/types'
import { ColorPicker, GroupHeader, TabRow } from './components'
import { useTabs } from './useTabs'
import './popup.css'

interface Section {
  group: GroupInfo | null
  tabs: TabInfo[]
}

export default function App() {
  const { windowId, tabs, groups, loading, error, refresh } = useTabs()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [lastToggled, setLastToggled] = useState<number | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState<GroupColor>('blue')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getSettings().then((settings) => setNewGroupColor(settings.defaultColor))
  }, [])

  // Abas fechadas em outro lugar nao devem continuar "selecionadas".
  useEffect(() => {
    setSelected((current) => {
      const alive = new Set(tabs.map((tab) => tab.id))
      const next = new Set([...current].filter((id) => alive.has(id)))
      return next.size === current.size ? current : next
    })
  }, [tabs])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return tabs
    return tabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(term) ||
        tab.url.toLowerCase().includes(term) ||
        tab.domain.toLowerCase().includes(term),
    )
  }, [tabs, query])

  /** Secoes na ordem em que aparecem na barra de abas. */
  const sections = useMemo<Section[]>(() => {
    const byGroup = new Map<number, TabInfo[]>()
    for (const tab of filtered) {
      const bucket = byGroup.get(tab.groupId)
      if (bucket) bucket.push(tab)
      else byGroup.set(tab.groupId, [tab])
    }

    const result: Section[] = []
    const ungrouped = byGroup.get(UNGROUPED)
    if (ungrouped?.length) result.push({ group: null, tabs: ungrouped })

    for (const group of groups) {
      const groupTabsList = byGroup.get(group.id)
      if (groupTabsList?.length) result.push({ group, tabs: groupTabsList })
    }

    return result.sort((a, b) => (a.tabs[0]?.index ?? 0) - (b.tabs[0]?.index ?? 0))
  }, [filtered, groups])

  const selectedIds = useMemo(() => [...selected], [selected])

  const run = useCallback(
    async (action: () => Promise<unknown>, options: { clearSelection?: boolean } = {}) => {
      setBusy(true)
      try {
        await action()
        if (options.clearSelection) setSelected(new Set())
        await refresh()
      } catch (err) {
        console.error('[tab-group]', err)
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  const toggleTab = useCallback(
    (tabId: number, shiftKey: boolean) => {
      setSelected((current) => {
        const next = new Set(current)

        if (shiftKey && lastToggled != null) {
          const visible = filtered.map((tab) => tab.id)
          const from = visible.indexOf(lastToggled)
          const to = visible.indexOf(tabId)
          if (from !== -1 && to !== -1) {
            const [start, end] = from < to ? [from, to] : [to, from]
            for (const id of visible.slice(start, end + 1)) next.add(id)
            return next
          }
        }

        if (next.has(tabId)) next.delete(tabId)
        else next.add(tabId)
        return next
      })
      setLastToggled(tabId)
    },
    [filtered, lastToggled],
  )

  const selectMany = useCallback((ids: number[], shouldSelect: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (shouldSelect) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  const createGroup = useCallback(() => {
    if (selectedIds.length === 0) return
    const fallback = tabs.find((tab) => tab.id === selectedIds[0])
    const title = newGroupName.trim() || getGroupLabel(fallback?.domain ?? 'Grupo')

    void run(
      () =>
        groupTabs(selectedIds, {
          title,
          color: newGroupColor,
          windowId: windowId ?? undefined,
        }),
      { clearSelection: true },
    )
    setNewGroupName('')
  }, [newGroupColor, newGroupName, run, selectedIds, tabs, windowId])

  const openOptions = () => chrome.runtime.openOptionsPage()

  if (error) {
    return (
      <div className="error">
        Nao foi possivel ler as abas: {error}
        <div style={{ marginTop: 10 }}>
          <button type="button" className="btn" onClick={() => void refresh()}>
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="header">
        <div className="header__top">
          <h1 className="header__title">Tab Group</h1>
          <span className="header__count">
            {tabs.length} abas · {groups.length} grupos
          </span>
        </div>

        <input
          type="search"
          className="search"
          placeholder="Filtrar por titulo, URL ou dominio…"
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="toolbar">
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || windowId == null}
            onClick={() => void run(() => groupByDomain(windowId as number))}
          >
            Agrupar por dominio
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || windowId == null}
            onClick={() => void run(() => collapseAll(windowId as number, true))}
          >
            Recolher
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || windowId == null}
            onClick={() => void run(() => collapseAll(windowId as number, false))}
          >
            Expandir
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || windowId == null || groups.length === 0}
            onClick={() => void run(() => ungroupAll(windowId as number))}
          >
            Desagrupar tudo
          </button>
        </div>
      </header>

      {selectedIds.length > 0 && (
        <div className="selection-bar">
          <span className="selection-bar__label">{selectedIds.length} selecionadas</span>
          <button type="button" className="link" onClick={() => setSelected(new Set())}>
            limpar
          </button>

          <div className="group-form">
            <input
              type="text"
              placeholder="Nome do novo grupo"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') createGroup()
              }}
            />
            <button type="button" className="btn btn--primary" disabled={busy} onClick={createGroup}>
              Agrupar
            </button>
          </div>

          <ColorPicker value={newGroupColor} onChange={setNewGroupColor} />

          <div className="footer__spacer" />

          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void run(() => ungroupTabs(selectedIds), { clearSelection: true })}
          >
            Desagrupar
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            onClick={() => void run(() => closeTabs(selectedIds), { clearSelection: true })}
          >
            Fechar
          </button>
        </div>
      )}

      <main className="content">
        {loading && <div className="empty">Carregando abas…</div>}
        {!loading && sections.length === 0 && (
          <div className="empty">Nenhuma aba corresponde ao filtro.</div>
        )}

        {sections.map((section) => {
          const ids = section.tabs.map((tab) => tab.id)
          const allSelected = ids.every((id) => selected.has(id))

          return (
            <section className="group" key={section.group?.id ?? 'ungrouped'}>
              <GroupHeader
                group={section.group}
                count={section.tabs.length}
                allSelected={allSelected}
                onSelectAll={(shouldSelect) => selectMany(ids, shouldSelect)}
                onToggleCollapse={
                  section.group
                    ? () =>
                        void run(() =>
                          updateGroup(section.group!.id, { collapsed: !section.group!.collapsed }),
                        )
                    : undefined
                }
                onRename={
                  section.group
                    ? (title) => void run(() => updateGroup(section.group!.id, { title }))
                    : undefined
                }
                onRecolor={
                  section.group
                    ? (color) => void run(() => updateGroup(section.group!.id, { color }))
                    : undefined
                }
                onUngroup={
                  section.group ? () => void run(() => ungroupTabs(ids)) : undefined
                }
                onCloseGroup={
                  section.group ? () => void run(() => closeGroup(section.group!.id)) : undefined
                }
              />

              <ul className="tab-list">
                {section.tabs.map((tab) => (
                  <TabRow
                    key={tab.id}
                    tab={tab}
                    selected={selected.has(tab.id)}
                    onToggle={toggleTab}
                    onActivate={(id) => void activateTab(id).then(() => window.close())}
                    onClose={(id) => void run(() => closeTabs([id]))}
                    onTogglePin={(target) =>
                      void run(() => setTabPinned(target.id, !target.pinned))
                    }
                    onToggleMute={(target) => void run(() => setTabMuted(target.id, !target.muted))}
                  />
                ))}
              </ul>
            </section>
          )
        })}
      </main>

      <footer className="footer">
        <span>Clique = ir para a aba · Ctrl/Shift+clique = selecionar</span>
        <div className="footer__spacer" />
        <button type="button" className="link" onClick={openOptions}>
          Configuracoes
        </button>
      </footer>
    </>
  )
}
