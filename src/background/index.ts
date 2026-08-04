import {
  autoGroupTab,
  collapseAll,
  collapseOthers,
  getCurrentWindowId,
  groupByDomain,
  ungroupAll,
} from '@/lib/tabs'
import { getSettings } from '@/lib/storage'

const MENU = {
  groupByDomain: 'group-by-domain',
  groupSameDomain: 'group-same-domain',
  ungroupAll: 'ungroup-all',
  collapseAll: 'collapse-all',
  expandAll: 'expand-all',
} as const

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU.groupByDomain,
      title: 'Agrupar abas por dominio',
      contexts: ['action', 'page'],
    })
    chrome.contextMenus.create({
      id: MENU.ungroupAll,
      title: 'Desagrupar todas as abas',
      contexts: ['action', 'page'],
    })
    chrome.contextMenus.create({
      id: 'separator',
      type: 'separator',
      contexts: ['action', 'page'],
    })
    chrome.contextMenus.create({
      id: MENU.collapseAll,
      title: 'Recolher todos os grupos',
      contexts: ['action', 'page'],
    })
    chrome.contextMenus.create({
      id: MENU.expandAll,
      title: 'Expandir todos os grupos',
      contexts: ['action', 'page'],
    })
  })
}

chrome.runtime.onInstalled.addListener(async (details) => {
  createMenus()
  // Garante que o storage comeca com os defaults gravados.
  await getSettings().then((settings) => chrome.storage.sync.set({ settings }))
  if (details.reason === 'install') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('options.html') })
  }
})

chrome.runtime.onStartup.addListener(createMenus)

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const windowId = tab?.windowId ?? (await getCurrentWindowId())

  switch (info.menuItemId) {
    case MENU.groupByDomain:
      await groupByDomain(windowId)
      break
    case MENU.ungroupAll:
      await ungroupAll(windowId)
      break
    case MENU.collapseAll:
      await collapseAll(windowId, true)
      break
    case MENU.expandAll:
      await collapseAll(windowId, false)
      break
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  const windowId = await getCurrentWindowId()

  switch (command) {
    case 'group-by-domain':
      await groupByDomain(windowId)
      break
    case 'ungroup-all':
      await ungroupAll(windowId)
      break
    case 'collapse-others':
      await collapseOthers(windowId)
      break
  }
})

// Abas novas costumam nascer sem URL; esperamos o commit da navegacao
// (changeInfo.url so aparece quando a URL efetivamente muda).
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!changeInfo.url) return
  void autoGroupTab(tab).catch((error) => console.error('[tab-group] autoGroupTab', error))
})

chrome.tabs.onCreated.addListener((tab) => {
  if (!tab.url && !tab.pendingUrl) return
  void autoGroupTab(tab).catch((error) => console.error('[tab-group] autoGroupTab', error))
})
