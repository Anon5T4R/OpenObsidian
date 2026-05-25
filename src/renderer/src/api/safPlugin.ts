import { registerPlugin } from '@capacitor/core'

export interface SafFileEntry {
  name: string
  isDirectory: boolean
  lastModified: number
  size: number
}

export interface SafStatResult {
  exists: boolean
  isDirectory?: boolean
  lastModified?: number
  size?: number
}

export interface SafPickResult {
  uri: string
  displayName: string
}

export interface SafPluginInterface {
  pickFolder(): Promise<SafPickResult | null>
  listDir(opts: { uri: string; path?: string }): Promise<{ files: SafFileEntry[] }>
  readFile(opts: { uri: string; path: string }): Promise<{ data: string }>
  writeFile(opts: { uri: string; path: string; data: string }): Promise<void>
  stat(opts: { uri: string; path: string }): Promise<SafStatResult>
  deleteEntry(opts: { uri: string; path: string }): Promise<void>
  renameEntry(opts: { uri: string; path: string; newName: string }): Promise<{ newPath: string }>
  mkdir(opts: { uri: string; path?: string }): Promise<void>
  copyFile(opts: { uri: string; from: string; to: string }): Promise<void>
}

export const SafPlugin = registerPlugin<SafPluginInterface>('SafPlugin')
