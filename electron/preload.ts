import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setOpacity: (opacity: number) => ipcRenderer.invoke('window:setOpacity', opacity),

  // PTY
  createPty: (sessionId: string, cols: number, rows: number, sessionName?: string) =>
    ipcRenderer.invoke('pty:create', sessionId, cols, rows, sessionName),
  writePty: (sessionId: string, data: string) => ipcRenderer.send('pty:write', sessionId, data),
  resizePty: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.send('pty:resize', sessionId, cols, rows),
  killPty: (sessionId: string) => ipcRenderer.send('pty:kill', sessionId),
  onPtyData: (sessionId: string, callback: (data: string) => void) => {
    const channel = `pty:data:${sessionId}`
    const handler = (_event: any, data: string) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onPtyExit: (sessionId: string, callback: (exitCode: number) => void) => {
    const channel = `pty:exit:${sessionId}`
    const handler = (_event: any, code: number) => callback(code)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  addHistory: (cmd: string) => ipcRenderer.invoke('history:add', cmd),
  searchHistory: (query: string) => ipcRenderer.invoke('history:search', query),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // AI
  aiComplete: (prompt: string, context: string, model: string, nlMode?: boolean) =>
    ipcRenderer.invoke('ai:complete', prompt, context, model, nlMode),
  aiCheck: (endpoint?: string) => ipcRenderer.invoke('ai:check', endpoint),

  // Theme
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: (theme: any) => ipcRenderer.invoke('theme:set', theme),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: any) => ipcRenderer.invoke('settings:set', settings),

  // Sidebar state
  getSidebarState: () => ipcRenderer.invoke('sidebar:getState'),
  setSidebarState: (state: any) => ipcRenderer.invoke('sidebar:setState', state),

  // SSH Hosts
  getHosts: () => ipcRenderer.invoke('hosts:get'),
  setHosts: (hosts: any[]) => ipcRenderer.invoke('hosts:set', hosts),

  // SSH Keys
  getKeys: () => ipcRenderer.invoke('keys:get'),
  setKeys: (keys: any[]) => ipcRenderer.invoke('keys:set', keys),
  generateKey: (opts: { type: string; bits: number; filename: string; comment: string; passphrase: string }) =>
    ipcRenderer.invoke('keys:generate', opts),

  // Environment Variables
  getVariables: () => ipcRenderer.invoke('variables:get'),
  setVariables: (vars: any[]) => ipcRenderer.invoke('variables:set', vars),
  openSystemVariables: () => ipcRenderer.invoke('variables:openSystem'),

  // Snippets
  getSnippets: () => ipcRenderer.invoke('snippets:get'),
  setSnippets: (snippets: any[]) => ipcRenderer.invoke('snippets:set', snippets),

  // SFTP
  sftpConnect: (opts: any) => ipcRenderer.invoke('sftp:connect', opts),
  sftpDisconnect: (id: string) => ipcRenderer.invoke('sftp:disconnect', id),
  sftpList: (id: string, remotePath: string) => ipcRenderer.invoke('sftp:list', id, remotePath),
  sftpDownload: (id: string, remotePath: string, localDir: string, fileName: string) => ipcRenderer.invoke('sftp:download', id, remotePath, localDir, fileName),
  sftpUpload: (id: string, localPath: string, remotePath: string) => ipcRenderer.invoke('sftp:upload', id, localPath, remotePath),
  sftpMkdir: (id: string, remotePath: string) => ipcRenderer.invoke('sftp:mkdir', id, remotePath),
  sftpDelete: (id: string, remotePath: string) => ipcRenderer.invoke('sftp:delete', id, remotePath),
  sftpRealpath: (id: string, remotePath: string) => ipcRenderer.invoke('sftp:realpath', id, remotePath),
  sftpRename: (id: string, oldPath: string, newPath: string) => ipcRenderer.invoke('sftp:rename', id, oldPath, newPath),
  localList: (dirPath: string) => ipcRenderer.invoke('local:list', dirPath),
  localRename: (oldPath: string, newPath: string) => ipcRenderer.invoke('local:rename', oldPath, newPath),
  localDelete: (filePath: string) => ipcRenderer.invoke('local:delete', filePath),
  localMkdir: (dirPath: string) => ipcRenderer.invoke('local:mkdir', dirPath),
  showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:open', options),
  showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:save', options),

  // Libraries
  checkTool: (cmd: string) => ipcRenderer.invoke('libraries:checkTool', cmd),
  installTool: (sessionId: string, cmd: string) => ipcRenderer.invoke('libraries:installTool', sessionId, cmd),

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Session Logs
  getLogs: () => ipcRenderer.invoke('logs:get'),
  addLog: (log: any) => ipcRenderer.invoke('logs:add', log),
  deleteLog: (id: string) => ipcRenderer.invoke('logs:delete', id),
  clearLogs: () => ipcRenderer.invoke('logs:clear'),
  onLogAdded: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('logs:added', handler)
    return () => ipcRenderer.removeListener('logs:added', handler)
  },
})
