import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { Share } from '@capacitor/share'
import { SafPlugin } from './safPlugin'
import type { AppAPI, FileInfo, TreeNode, VaultInfo } from '../../../../types/shared'

// ── SAF path encoding ─────────────────────────────────────────────────────────
//
// Internal vault path : "VaultName"           (relative to Directory.External — getExternalFilesDir()
//                                              = /storage/emulated/0/Android/data/<pkg>/files/
//                                              no permissions needed, user-visible via file manager)
// Internal file path  : "VaultName/dir/f.md"
// SAF vault path      : "content://..."       (tree URI from ACTION_OPEN_DOCUMENT_TREE)
// SAF file path       : "content://...||dir/f.md"  (treeUri + "||" + relative path)

const SAF_SEP = '||'

function isSaf(path: string): boolean {
  return path.startsWith('content://')
}

function safFile(treeUri: string, rel: string): string {
  return rel ? `${treeUri}${SAF_SEP}${rel}` : treeUri
}

function parseSaf(path: string): { uri: string; rel: string } {
  const idx = path.indexOf(SAF_SEP)
  return idx < 0
    ? { uri: path, rel: '' }
    : { uri: path.slice(0, idx), rel: path.slice(idx + SAF_SEP.length) }
}

// ── Virtual path utilities (no Node.js path module) ───────────────────────────

const vp = {
  dirname(p: string): string { const i = p.lastIndexOf('/'); return i > 0 ? p.slice(0, i) : '' },
  basename(p: string): string { return p.split('/').pop() ?? p },
  join(...parts: string[]): string { return parts.filter(Boolean).join('/').replace(/\/+/g, '/') },
  relative(from: string, to: string): string {
    return to.startsWith(from + '/') ? to.slice(from.length + 1) : to
  },
}

// ── SAF tree listing ──────────────────────────────────────────────────────────

async function safListTree(treeUri: string, dirRel: string, topLevel = false): Promise<TreeNode[]> {
  let entries: Awaited<ReturnType<typeof SafPlugin.listDir>>
  try {
    entries = await SafPlugin.listDir({ uri: treeUri, path: dirRel })
  } catch (e: any) {
    // Top-level failure likely means SAF permissions were revoked — propagate so the
    // caller can show a meaningful error message. Subdirectory failures silently skip.
    if (topLevel) throw new Error('Cannot access folder. Please re-import it from the vault picker. (' + (e?.message ?? e) + ')')
    return []
  }
  const nodes: TreeNode[] = []
  const dirs  = entries.files.filter((f) => f.isDirectory && !f.name.startsWith('.'))
  const files = entries.files.filter((f) => !f.isDirectory && f.name.endsWith('.md') && !f.name.startsWith('.'))

  for (const d of dirs) {
    const rel = dirRel ? `${dirRel}/${d.name}` : d.name
    nodes.push({
      name: d.name,
      path: safFile(treeUri, rel),
      type: 'directory',
      children: await safListTree(treeUri, rel, false),
    })
  }
  for (const f of files) {
    const rel = dirRel ? `${dirRel}/${f.name}` : f.name
    nodes.push({
      name: f.name.replace(/\.md$/, ''),
      path: safFile(treeUri, rel),
      type: 'file',
      mtime: f.lastModified || undefined,
    })
  }
  return nodes
}

async function safListFiles(treeUri: string): Promise<FileInfo[]> {
  const result: FileInfo[] = []
  async function walk(dirRel: string) {
    let entries: Awaited<ReturnType<typeof SafPlugin.listDir>>
    try { entries = await SafPlugin.listDir({ uri: treeUri, path: dirRel }) } catch { return }
    for (const f of entries.files) {
      if (f.name.startsWith('.')) continue
      const rel = dirRel ? `${dirRel}/${f.name}` : f.name
      if (f.isDirectory) {
        await walk(rel)
      } else if (f.name.endsWith('.md')) {
        result.push({ name: f.name.replace(/\.md$/, ''), path: safFile(treeUri, rel), relativePath: rel })
      }
    }
  }
  await walk('')
  return result
}

// ── Internal (Filesystem) tree listing ────────────────────────────────────────

async function walkTree(dirPath: string, topLevel = false): Promise<TreeNode[]> {
  let result: Awaited<ReturnType<typeof Filesystem.readdir>>
  try {
    result = await Filesystem.readdir({ path: dirPath, directory: Directory.External })
  } catch (e: any) {
    if (topLevel) throw new Error(`Cannot access vault "${dirPath}". (${e?.message ?? e})`)
    return []
  }
  const nodes: TreeNode[] = []
  const dirs  = result.files.filter((f) => f.type === 'directory' && !f.name.startsWith('.'))
  const files = result.files.filter((f) => f.type === 'file' && f.name.endsWith('.md') && !f.name.startsWith('.'))
  for (const d of dirs) {
    const p = vp.join(dirPath, d.name)
    nodes.push({ name: d.name, path: p, type: 'directory', children: await walkTree(p) })
  }
  for (const f of files) {
    const p = vp.join(dirPath, f.name)
    const mtime = f.mtime ? (typeof f.mtime === 'number' ? f.mtime : new Date(f.mtime).getTime()) : undefined
    nodes.push({ name: f.name.replace(/\.md$/, ''), path: p, type: 'file', mtime })
  }
  return nodes
}

async function walkFiles(vaultPath: string): Promise<FileInfo[]> {
  const files: FileInfo[] = []
  async function walk(dirPath: string) {
    let result: Awaited<ReturnType<typeof Filesystem.readdir>>
    try { result = await Filesystem.readdir({ path: dirPath, directory: Directory.External }) } catch { return }
    for (const entry of result.files) {
      if (entry.name.startsWith('.')) continue
      const fullPath = vp.join(dirPath, entry.name)
      if (entry.type === 'directory') await walk(fullPath)
      else if (entry.name.endsWith('.md'))
        files.push({ name: entry.name.replace(/\.md$/, ''), path: fullPath, relativePath: vp.relative(vaultPath, fullPath) })
    }
  }
  await walk(vaultPath)
  return files
}

// ── SAF vault registry (persisted in Preferences) ────────────────────────────

const SAF_VAULTS_KEY = 'safVaults'

async function loadSafVaults(): Promise<{ uri: string; displayName: string }[]> {
  try {
    const { value } = await Preferences.get({ key: SAF_VAULTS_KEY })
    return value ? JSON.parse(value) : []
  } catch {
    return []
  }
}

async function saveSafVaults(vaults: { uri: string; displayName: string }[]): Promise<void> {
  await Preferences.set({ key: SAF_VAULTS_KEY, value: JSON.stringify(vaults) })
}

async function addSafVault(uri: string, displayName: string): Promise<void> {
  const existing = await loadSafVaults()
  if (!existing.some((v) => v.uri === uri)) {
    await saveSafVaults([...existing, { uri, displayName }])
  }
}

// ── Index storage helpers ─────────────────────────────────────────────────────

function indexPath(vaultPath: string) {
  return vp.join(vaultPath, '.oo-index.json')
}

// ── Capacitor API implementation ──────────────────────────────────────────────

export const capacitorApi: AppAPI = {
  // ── App settings ────────────────────────────────────────────────────────────
  async getLastVault() {
    const { value } = await Preferences.get({ key: 'lastVault' })
    return value
  },
  async setLastVault(vaultPath) {
    await Preferences.set({ key: 'lastVault', value: vaultPath })
  },

  // ── Vault ────────────────────────────────────────────────────────────────────
  async openVault() {
    // Handled by in-app VaultPickerModal on Android
    return null
  },

  async listVaults(): Promise<VaultInfo[]> {
    // Internal vaults — Directory.External = getExternalFilesDir() = no permissions needed
    let internal: VaultInfo[] = []
    try {
      const result = await Filesystem.readdir({ path: '', directory: Directory.External })
      internal = result.files
        .filter((f) =>
          f.type === 'directory' &&
          !f.name.startsWith('.') &&   // hidden
          !f.name.startsWith('_')      // system dirs: _exports, _attachments, etc.
        )
        .map((f) => ({ path: f.name, displayName: f.name, type: 'internal' as const }))
    } catch {}

    // External SAF vaults (picked via ACTION_OPEN_DOCUMENT_TREE)
    const safVaults = await loadSafVaults()
    const external: VaultInfo[] = safVaults.map((v) => ({
      path: v.uri,
      displayName: v.displayName,
      type: 'external' as const,
    }))

    return [...internal, ...external]
  },

  async getVaultDisplayName(vaultPath: string): Promise<string> {
    if (isSaf(vaultPath)) {
      const safVaults = await loadSafVaults()
      const found = safVaults.find((v) => v.uri === vaultPath)
      if (found) return found.displayName
      // Fallback: decode percent-encoding from the URI's last segment
      try {
        const raw = vaultPath.split('/').pop() ?? vaultPath
        return decodeURIComponent(raw.split('%3A').pop() ?? raw)
      } catch {}
    }
    // Internal vault: path is already the folder name
    return vaultPath.split('/').pop() ?? vaultPath
  },

  async createVault(name) {
    try {
      await Filesystem.mkdir({ path: name, directory: Directory.External, recursive: true })
      return name
    } catch {
      return null
    }
  },

  async pickExternalVault(): Promise<VaultInfo | null> {
    try {
      const result = await SafPlugin.pickFolder()
      // call.resolve() with no args returns {} in Capacitor — check uri explicitly
      if (!result?.uri) return null
      await addSafVault(result.uri, result.displayName)
      return { path: result.uri, displayName: result.displayName, type: 'external' }
    } catch {
      return null
    }
  },

  async listTree(vaultPath) {
    if (isSaf(vaultPath)) {
      return safListTree(vaultPath, '', true) // topLevel=true → throws on permission loss
    }
    return walkTree(vaultPath, true) // topLevel=true → throws if vault directory is gone
  },

  async listFiles(vaultPath) {
    if (isSaf(vaultPath)) return safListFiles(vaultPath)
    return walkFiles(vaultPath)
  },

  async watchVault(_vaultPath) {
    return true // no file watching on Android
  },

  async backupVault(vaultPath) {
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const name = isSaf(vaultPath) ? 'vault' : vp.basename(vaultPath)
    const backupPath = `${name}-backup-${ts}`
    try {
      if (!isSaf(vaultPath)) {
        await Filesystem.copy({
          from: vaultPath, to: backupPath,
          directory: Directory.External, toDirectory: Directory.External,
        })
        return backupPath
      }
      return null // SAF backup not implemented in v1
    } catch {
      return null
    }
  },

  // ── Files ────────────────────────────────────────────────────────────────────
  async readFile(filePath) {
    if (isSaf(filePath)) {
      const { uri, rel } = parseSaf(filePath)
      const r = await SafPlugin.readFile({ uri, path: rel })
      return r.data
    }
    const r = await Filesystem.readFile({ path: filePath, directory: Directory.External, encoding: Encoding.UTF8 })
    return r.data as string
  },

  async writeFile(filePath, content) {
    try {
      if (isSaf(filePath)) {
        const { uri, rel } = parseSaf(filePath)
        await SafPlugin.writeFile({ uri, path: rel, data: content })
      } else {
        await Filesystem.writeFile({ path: filePath, data: content, directory: Directory.External, encoding: Encoding.UTF8, recursive: true })
      }
      return true
    } catch {
      return false
    }
  },

  async createFile(vault, noteName, folderPath) {
    const base     = folderPath ?? vault
    const safVault = isSaf(vault)
    const filePath = safVault
      ? (() => { const { uri, rel } = parseSaf(base); return safFile(uri, rel ? `${rel}/${noteName}.md` : `${noteName}.md`) })()
      : vp.join(base, `${noteName}.md`)

    try {
      // Check existence
      try {
        if (safVault) {
          const { uri, rel } = parseSaf(filePath)
          const s = await SafPlugin.stat({ uri, path: rel })
          if (s.exists) return { error: 'File already exists', path: filePath }
        } else {
          await Filesystem.stat({ path: filePath, directory: Directory.External })
          return { error: 'File already exists', path: filePath }
        }
      } catch {}

      const initialContent = `# ${noteName}\n\n`
      if (safVault) {
        const { uri, rel } = parseSaf(filePath)
        await SafPlugin.writeFile({ uri, path: rel, data: initialContent })
      } else {
        await Filesystem.writeFile({ path: filePath, data: initialContent, directory: Directory.External, encoding: Encoding.UTF8, recursive: true })
      }
      return { path: filePath }
    } catch (e: any) {
      return { error: e?.message ?? 'Failed to create file' }
    }
  },

  async deleteFile(filePath) {
    try {
      if (isSaf(filePath)) {
        const { uri, rel } = parseSaf(filePath)
        await SafPlugin.deleteEntry({ uri, path: rel })
      } else {
        await Filesystem.deleteFile({ path: filePath, directory: Directory.External })
      }
      return true
    } catch { return false }
  },

  async renameFile(oldPath, newName) {
    if (isSaf(oldPath)) {
      const { uri, rel } = parseSaf(oldPath)
      const r = await SafPlugin.renameEntry({ uri, path: rel, newName: `${newName}.md` })
      return safFile(uri, r.newPath)
    }
    const dir     = vp.dirname(oldPath)
    const newPath = vp.join(dir, `${newName}.md`)
    await Filesystem.rename({ from: oldPath, to: newPath, directory: Directory.External, toDirectory: Directory.External })
    return newPath
  },

  async duplicateFile(filePath) {
    try {
      if (isSaf(filePath)) {
        const { uri, rel }  = parseSaf(filePath)
        const base          = rel.replace(/\.md$/, '')
        let destRel         = `${base} copy.md`
        let i = 2
        while (true) {
          const s = await SafPlugin.stat({ uri, path: destRel })
          if (!s.exists) break
          destRel = `${base} copy ${i}.md`
          i++
        }
        await SafPlugin.copyFile({ uri, from: rel, to: destRel })
        return { path: safFile(uri, destRel) }
      }
      const dir  = vp.dirname(filePath)
      const base = vp.basename(filePath).replace(/\.md$/, '')
      let dest   = vp.join(dir, `${base} copy.md`)
      let i = 2
      while (true) {
        try { await Filesystem.stat({ path: dest, directory: Directory.External }); dest = vp.join(dir, `${base} copy ${i}.md`); i++ }
        catch { break }
      }
      await Filesystem.copy({ from: filePath, to: dest, directory: Directory.External, toDirectory: Directory.External })
      return { path: dest }
    } catch (e: any) { return { error: e?.message ?? 'Failed to duplicate' } }
  },

  // ── Folders ──────────────────────────────────────────────────────────────────
  async createFolder(parentPath, folderName) {
    const safParent = isSaf(parentPath)
    try {
      if (safParent) {
        const { uri, rel } = parseSaf(parentPath)
        const newRel = rel ? `${rel}/${folderName}` : folderName
        const s = await SafPlugin.stat({ uri, path: newRel })
        if (s.exists) return { error: 'Folder already exists', path: safFile(uri, newRel) }
        await SafPlugin.mkdir({ uri, path: newRel })
        return { path: safFile(uri, newRel) }
      }
      const fullPath = vp.join(parentPath, folderName)
      try { await Filesystem.stat({ path: fullPath, directory: Directory.External }); return { error: 'Folder already exists', path: fullPath } } catch {}
      await Filesystem.mkdir({ path: fullPath, directory: Directory.External, recursive: true })
      return { path: fullPath }
    } catch (e: any) { return { error: e?.message ?? 'Failed to create folder' } }
  },

  async deleteFolder(folderPath) {
    try {
      if (isSaf(folderPath)) {
        const { uri, rel } = parseSaf(folderPath)
        await SafPlugin.deleteEntry({ uri, path: rel })
      } else {
        await Filesystem.rmdir({ path: folderPath, directory: Directory.External, recursive: true })
      }
      return true
    } catch { return false }
  },

  async renameFolder(oldPath, newName) {
    if (isSaf(oldPath)) {
      const { uri, rel } = parseSaf(oldPath)
      const r = await SafPlugin.renameEntry({ uri, path: rel, newName })
      return safFile(uri, r.newPath)
    }
    const newPath = vp.join(vp.dirname(oldPath), newName)
    await Filesystem.rename({ from: oldPath, to: newPath, directory: Directory.External, toDirectory: Directory.External })
    return newPath
  },

  // ── Move ─────────────────────────────────────────────────────────────────────
  async moveItem(sourcePath, targetDirPath) {
    const name = isSaf(sourcePath) ? vp.basename(parseSaf(sourcePath).rel) : vp.basename(sourcePath)
    try {
      if (isSaf(sourcePath) && isSaf(targetDirPath)) {
        const { uri, rel: srcRel } = parseSaf(sourcePath)
        const { rel: dstRel }      = parseSaf(targetDirPath)
        const destRel = dstRel ? `${dstRel}/${name}` : name
        const s = await SafPlugin.stat({ uri, path: destRel })
        if (s.exists) return { error: 'An item with this name already exists in the destination' }
        await SafPlugin.copyFile({ uri, from: srcRel, to: destRel })
        await SafPlugin.deleteEntry({ uri, path: srcRel })
        return { path: safFile(uri, destRel) }
      }
      // Internal move
      const dest = vp.join(targetDirPath, name)
      try { await Filesystem.stat({ path: dest, directory: Directory.External }); return { error: 'An item with this name already exists in the destination' } } catch {}
      await Filesystem.rename({ from: sourcePath, to: dest, directory: Directory.External, toDirectory: Directory.External })
      return { path: dest }
    } catch (e: any) { return { error: e?.message ?? 'Failed to move item' } }
  },

  // ── Images ───────────────────────────────────────────────────────────────────
  async saveImage(vaultPath, fileName, base64) {
    const relPath  = `_attachments/${fileName}`
    const fullPath = isSaf(vaultPath)
      ? safFile(parseSaf(vaultPath).uri, relPath)
      : vp.join(vaultPath, relPath)
    if (isSaf(fullPath)) {
      const { uri, rel } = parseSaf(fullPath)
      await SafPlugin.writeFile({ uri, path: rel, data: base64 })
    } else {
      await Filesystem.writeFile({ path: fullPath, data: base64, directory: Directory.External, recursive: true })
    }
    return relPath
  },

  // ── Export ───────────────────────────────────────────────────────────────────
  async exportHtml(noteTitle, htmlContent) {
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${noteTitle}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #1a1a2e; }
  h1,h2,h3,h4 { margin-top: 1.5em; margin-bottom: 0.5em; }
  code { background: #f0f0ee; padding: 2px 6px; border-radius: 3px; font-size: 0.88em; font-family: monospace; }
  pre { background: #f0f0ee; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #7c3aed; margin: 0; padding-left: 16px; color: #555; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td, th { border: 1px solid #d1d1c8; padding: 8px 12px; }
  th { background: #f0f0ee; font-weight: 600; }
  a { color: #6d28d9; }
  img { max-width: 100%; border-radius: 4px; }
  input[type=checkbox] { margin-right: 6px; }
</style>
</head>
<body>${htmlContent}</body>
</html>`
    const exportPath = `_exports/${noteTitle}.html`
    try {
      await Filesystem.writeFile({ path: exportPath, data: fullHtml, directory: Directory.External, encoding: Encoding.UTF8, recursive: true })
      const { uri } = await Filesystem.getUri({ path: exportPath, directory: Directory.External })
      await Share.share({ title: noteTitle, url: uri, dialogTitle: 'Export note' })
      return `${noteTitle}.html`
    } catch { return null }
  },

  async exportPdf(noteTitle) {
    // Trigger the Android system print dialog — the user can save as PDF from there
    window.print()
    return `${noteTitle}.pdf`
  },

  // ── Vault index cache ────────────────────────────────────────────────────────
  async loadIndex(vaultPath) {
    try {
      if (isSaf(vaultPath)) {
        const r = await SafPlugin.readFile({ uri: vaultPath, path: '.oo-index.json' })
        return JSON.parse(r.data)
      }
      const r = await Filesystem.readFile({ path: indexPath(vaultPath), directory: Directory.External, encoding: Encoding.UTF8 })
      return JSON.parse(r.data as string)
    } catch { return null }
  },

  async saveIndex(vaultPath, data) {
    try {
      const json = JSON.stringify(data)
      if (isSaf(vaultPath)) {
        await SafPlugin.writeFile({ uri: vaultPath, path: '.oo-index.json', data: json })
      } else {
        await Filesystem.writeFile({ path: indexPath(vaultPath), data: json, directory: Directory.External, encoding: Encoding.UTF8, recursive: true })
      }
      return true
    } catch { return false }
  },

  // ── Document viewers (Electron-only — no-op stubs on Android) ───────────────
  async docxToHtml(_path) { return { html: '', error: 'DOCX viewer not supported on Android' } },
  async openInApp(_path)  { return null },

  // ── Shell ────────────────────────────────────────────────────────────────────
  async showItemInFolder(_path) {},

  // ── Menu events (no-op on Android) ──────────────────────────────────────────
  onMenuOpenVault:     (_cb) => () => {},
  onMenuNewNote:       (_cb) => () => {},
  onMenuToggleSearch:  (_cb) => () => {},
  onMenuToggleSidebar: (_cb) => () => {},
  onMenuBackup:        (_cb) => () => {},

  // ── File watch events (no chokidar on Android) ────────────────────────────────
  onFileAdded:   (_cb) => () => {},
  onFileRemoved: (_cb) => () => {},
  onFileChanged: (_cb) => () => {},
  onDirAdded:    (_cb) => () => {},
  onDirRemoved:  (_cb) => () => {},
}
