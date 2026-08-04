import { useState } from 'react'
import {
  GROUP_COLORS,
  GROUP_COLOR_HEX,
  GROUP_COLOR_LABELS,
  type GroupColor,
  type GroupInfo,
  type TabInfo,
} from '@/lib/types'

export function Favicon({ tab }: { tab: TabInfo }) {
  const [broken, setBroken] = useState(false)
  const usable = tab.favIconUrl && !broken && !tab.favIconUrl.startsWith('chrome://')

  if (!usable) {
    return (
      <span className="tab__favicon tab__favicon--fallback" aria-hidden="true">
        {tab.domain.charAt(0)}
      </span>
    )
  }

  return (
    <img
      className="tab__favicon"
      src={tab.favIconUrl}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
    />
  )
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: GroupColor
  onChange: (color: GroupColor) => void
}) {
  return (
    <div className="color-select" role="group" aria-label="Cor do grupo">
      {GROUP_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className="swatch"
          style={{ background: GROUP_COLOR_HEX[color] }}
          aria-pressed={value === color}
          aria-label={GROUP_COLOR_LABELS[color]}
          title={GROUP_COLOR_LABELS[color]}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}

interface TabRowProps {
  tab: TabInfo
  selected: boolean
  onToggle: (tabId: number, shiftKey: boolean) => void
  onActivate: (tabId: number) => void
  onClose: (tabId: number) => void
  onTogglePin: (tab: TabInfo) => void
  onToggleMute: (tab: TabInfo) => void
}

export function TabRow({
  tab,
  selected,
  onToggle,
  onActivate,
  onClose,
  onTogglePin,
  onToggleMute,
}: TabRowProps) {
  const className = [
    'tab',
    tab.active && 'tab--active',
    selected && 'tab--selected',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      className={className}
      onClick={(event) => {
        if (event.shiftKey || event.ctrlKey || event.metaKey) onToggle(tab.id, event.shiftKey)
        else onActivate(tab.id)
      }}
      title={tab.url}
    >
      <input
        type="checkbox"
        className="tab__checkbox"
        checked={selected}
        aria-label={`Selecionar ${tab.title}`}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) =>
          onToggle(tab.id, (event.nativeEvent as MouseEvent).shiftKey ?? false)
        }
      />
      <Favicon tab={tab} />
      <div className="tab__text">
        <div className="tab__title">{tab.title}</div>
        <div className="tab__domain">{tab.domain}</div>
      </div>
      <div className="tab__badges">
        {tab.pinned && <span title="Fixada">📌</span>}
        {tab.discarded && <span title="Suspensa">💤</span>}
      </div>
      <div className="tab__actions">
        {(tab.audible || tab.muted) && (
          <button
            type="button"
            className="btn btn--icon"
            title={tab.muted ? 'Reativar som' : 'Silenciar'}
            onClick={(event) => {
              event.stopPropagation()
              onToggleMute(tab)
            }}
          >
            {tab.muted ? '🔇' : '🔊'}
          </button>
        )}
        <button
          type="button"
          className="btn btn--icon"
          title={tab.pinned ? 'Desafixar' : 'Fixar'}
          onClick={(event) => {
            event.stopPropagation()
            onTogglePin(tab)
          }}
        >
          📌
        </button>
        <button
          type="button"
          className="btn btn--icon"
          title="Fechar aba"
          onClick={(event) => {
            event.stopPropagation()
            onClose(tab.id)
          }}
        >
          ✕
        </button>
      </div>
    </li>
  )
}

interface GroupHeaderProps {
  group: GroupInfo | null
  count: number
  allSelected: boolean
  onSelectAll: (selected: boolean) => void
  onToggleCollapse?: () => void
  onRename?: (title: string) => void
  onRecolor?: (color: GroupColor) => void
  onUngroup?: () => void
  onCloseGroup?: () => void
}

export function GroupHeader({
  group,
  count,
  allSelected,
  onSelectAll,
  onToggleCollapse,
  onRename,
  onRecolor,
  onUngroup,
  onCloseGroup,
}: GroupHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group?.title ?? '')

  const commit = () => {
    setEditing(false)
    if (group && draft !== group.title) onRename?.(draft)
  }

  return (
    <div className="group__header">
      <input
        type="checkbox"
        className="tab__checkbox"
        checked={allSelected}
        aria-label={group ? `Selecionar grupo ${group.title}` : 'Selecionar abas sem grupo'}
        onChange={(event) => onSelectAll(event.target.checked)}
      />
      {group ? (
        <span className="group__dot" style={{ background: GROUP_COLOR_HEX[group.color] }} />
      ) : (
        <span className="group__dot" style={{ background: 'var(--text-muted)' }} />
      )}

      {editing && group ? (
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setDraft(group.title)
              setEditing(false)
            }
          }}
        />
      ) : (
        <span className="group__title">
          {group ? group.title || '(sem nome)' : 'Sem grupo'}
        </span>
      )}

      <span className="group__count">{count}</span>

      <div className="group__actions">
        {group && onRecolor && (
          <select
            value={group.color}
            aria-label="Cor do grupo"
            onChange={(event) => onRecolor(event.target.value as GroupColor)}
          >
            {GROUP_COLORS.map((color) => (
              <option key={color} value={color}>
                {GROUP_COLOR_LABELS[color]}
              </option>
            ))}
          </select>
        )}
        {group && onRename && (
          <button
            type="button"
            className="btn btn--icon"
            title="Renomear grupo"
            onClick={() => {
              setDraft(group.title)
              setEditing(true)
            }}
          >
            ✎
          </button>
        )}
        {group && onToggleCollapse && (
          <button
            type="button"
            className="btn btn--icon"
            title={group.collapsed ? 'Expandir' : 'Recolher'}
            onClick={onToggleCollapse}
          >
            {group.collapsed ? '▸' : '▾'}
          </button>
        )}
        {onUngroup && (
          <button type="button" className="btn btn--icon" title="Desagrupar" onClick={onUngroup}>
            ⤨
          </button>
        )}
        {onCloseGroup && (
          <button
            type="button"
            className="btn btn--icon btn--danger"
            title="Fechar todas as abas do grupo"
            onClick={onCloseGroup}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
