import { useState } from 'react'
import { useDarkMode } from '@/lib/useDarkMode'
import {
  GROUP_COLORS,
  GROUP_COLOR_LABELS,
  groupColorHex,
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
  const dark = useDarkMode()

  return (
    <div className="color-select" role="group" aria-label="Group color">
      {GROUP_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className="swatch"
          style={{ background: groupColorHex(color, dark) }}
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
  onClose: (tabId: number) => void
}

export function TabRow({ tab, selected, onToggle, onClose }: TabRowProps) {
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
      onClick={(event) => onToggle(tab.id, event.shiftKey)}
      title={tab.url}
    >
      <input
        type="checkbox"
        className="tab__checkbox"
        checked={selected}
        aria-label={`Select ${tab.title}`}
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
      <div className="tab__actions">
        <button
          type="button"
          className="btn btn--icon"
          title="Close tab"
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
  /** Titulo das secoes virtuais (fixadas / sem grupo). */
  label?: string
  count: number
  collapsed?: boolean
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
  label,
  count,
  collapsed,
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
  const isCollapsed = collapsed ?? group?.collapsed ?? false
  const dark = useDarkMode()

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
        aria-label={
          group ? `Select group ${group.title}` : `Select ${label ?? 'ungrouped tabs'}`
        }
        onChange={(event) => onSelectAll(event.target.checked)}
      />
      {onToggleCollapse && (
        <button
          type="button"
          className="btn btn--icon group__caret"
          title={isCollapsed ? 'Expand' : 'Collapse'}
          aria-expanded={!isCollapsed}
          onClick={onToggleCollapse}
        >
          {isCollapsed ? '▸' : '▾'}
        </button>
      )}

      {group ? (
        <span className="group__dot" style={{ background: groupColorHex(group.color, dark) }} />
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
          {group ? group.title || '(unnamed)' : (label ?? 'Ungrouped')}
        </span>
      )}

      <span className="group__count">{count}</span>

      <div className="group__actions">
        {group && onRecolor && (
          <select
            value={group.color}
            aria-label="Group color"
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
            title="Rename group"
            onClick={() => {
              setDraft(group.title)
              setEditing(true)
            }}
          >
            ✎
          </button>
        )}
        {onUngroup && (
          <button type="button" className="btn btn--icon" title="Ungroup" onClick={onUngroup}>
            ⤨
          </button>
        )}
        {onCloseGroup && (
          <button
            type="button"
            className="btn btn--icon btn--danger"
            title="Close all tabs in group"
            onClick={onCloseGroup}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
