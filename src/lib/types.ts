/** Cores aceitas pelo Chrome para grupos de abas ("blue", "red", ...). */
export type GroupColor = `${chrome.tabGroups.Color}`

export const GROUP_COLORS: GroupColor[] = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
]

/** Rotulos em pt-BR para as cores nativas do Chrome. */
export const GROUP_COLOR_LABELS: Record<GroupColor, string> = {
  grey: 'Cinza',
  blue: 'Azul',
  red: 'Vermelho',
  yellow: 'Amarelo',
  green: 'Verde',
  pink: 'Rosa',
  purple: 'Roxo',
  cyan: 'Ciano',
  orange: 'Laranja',
}

/** Valores CSS aproximados das cores de grupo do Chrome, para o preview na UI. */
export const GROUP_COLOR_HEX: Record<GroupColor, string> = {
  grey: '#5f6368',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#1e8e3e',
  pink: '#d01884',
  purple: '#9334e6',
  cyan: '#007b83',
  orange: '#fa903e',
}

/** Como uma aba nova escolhe seu grupo quando o agrupamento automatico esta ligado. */
export type AutoGroupMode = 'domain' | 'preset'

/** Grupo pre-definido pelo usuario: um nome fixo e os dominios que caem nele. */
export interface GroupPreset {
  id: string
  title: string
  color: GroupColor
  /** Dominios normalizados ("youtube.com"); subdominios tambem casam. */
  domains: string[]
}

export interface Settings {
  /** Agrupa automaticamente uma aba nova junto das outras do mesmo dominio. */
  autoGroupNewTabs: boolean
  /** Regra usada pelo agrupamento automatico: por dominio ou por predefinicao. */
  autoGroupMode: AutoGroupMode
  /** Predefinicoes usadas quando `autoGroupMode` é 'preset'. */
  presets: GroupPreset[]
  /** Minimo de abas do mesmo dominio para que "Agrupar por dominio" crie um grupo. */
  minTabsPerGroup: number
  /** Cor usada ao criar um grupo manualmente. */
  defaultColor: GroupColor
  /** Usa uma cor diferente por dominio ao agrupar automaticamente. */
  colorizeByDomain: boolean
  /** Recolhe os grupos recem-criados. */
  collapseNewGroups: boolean
  /** Recolhe todos os grupos da janela sempre que a aba ativa muda. */
  collapseOnTabSwitch: boolean
  /** Dominios que nunca devem ser agrupados automaticamente. */
  ignoredDomains: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  autoGroupNewTabs: false,
  autoGroupMode: 'domain',
  presets: [],
  minTabsPerGroup: 2,
  defaultColor: 'blue',
  colorizeByDomain: true,
  collapseNewGroups: false,
  collapseOnTabSwitch: true,
  ignoredDomains: ['newtab', 'localhost'],
}

/** Aba no formato consumido pela UI (subset serializavel de chrome.tabs.Tab). */
export interface TabInfo {
  id: number
  windowId: number
  index: number
  title: string
  url: string
  domain: string
  favIconUrl?: string
  active: boolean
  pinned: boolean
  audible: boolean
  muted: boolean
  discarded: boolean
  groupId: number
}

export interface GroupInfo {
  id: number
  title: string
  color: GroupColor
  collapsed: boolean
  windowId: number
}

export const UNGROUPED = -1 satisfies number
