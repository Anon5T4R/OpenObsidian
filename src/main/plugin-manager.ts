import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { app, dialog } from 'electron'
import AdmZip from 'adm-zip'

const execFileAsync = promisify(execFile)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PluginManifest {
  id:           string
  name:         string
  version:      string
  icon?:        string
  panel?:       string
  author?:      string
  description?: string
}

export interface PluginInfo extends PluginManifest {
  dir:       string
  panelPath: string | null
  enabled:   boolean
}

// ── Paths ─────────────────────────────────────────────────────────────────────

function pluginsDir(): string {
  const d = path.join(app.getPath('userData'), 'plugins')
  fs.mkdirSync(d, { recursive: true })
  return d
}

function enabledFile(): string {
  return path.join(app.getPath('userData'), 'plugins-enabled.json')
}

function readEnabled(): Set<string> {
  try {
    const data = JSON.parse(fs.readFileSync(enabledFile(), 'utf-8'))
    return new Set(Array.isArray(data) ? data : [])
  } catch {
    return new Set()
  }
}

function writeEnabled(ids: Set<string>): void {
  fs.writeFileSync(enabledFile(), JSON.stringify([...ids]), 'utf-8')
}

function findManifest(dir: string): PluginManifest | null {
  const candidates = [
    path.join(dir, 'manifest.json'),
    // support nested: plugin zip might extract with one extra folder level
    ...fs.readdirSync(dir).map((n) => path.join(dir, n, 'manifest.json')).filter((p) => fs.existsSync(p)),
  ]
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue
    try {
      const m = JSON.parse(fs.readFileSync(c, 'utf-8'))
      if (m.id && m.name && m.version) return m
    } catch {}
  }
  return null
}

// ── API ───────────────────────────────────────────────────────────────────────

export function listPlugins(): PluginInfo[] {
  const dir     = pluginsDir()
  const enabled = readEnabled()
  const result: PluginInfo[] = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pluginDir = path.join(dir, entry.name)
    const manifest  = findManifest(pluginDir)
    if (!manifest) continue

    const panelPath = manifest.panel ? path.join(pluginDir, manifest.panel) : null
    result.push({
      ...manifest,
      dir:       pluginDir,
      panelPath: panelPath && fs.existsSync(panelPath) ? panelPath : null,
      enabled:   enabled.has(manifest.id),
    })
  }

  return result
}

export function setPluginEnabled(id: string, value: boolean): void {
  const enabled = readEnabled()
  if (value) enabled.add(id); else enabled.delete(id)
  writeEnabled(enabled)
}

export async function execPlugin(
  cmd: string,
  args: string[],
  cwd?: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { cwd, timeout: 30_000 })
    return { stdout: stdout.trim(), stderr: stderr.trim(), code: 0 }
  } catch (e: any) {
    return {
      stdout: e.stdout?.trim() ?? '',
      stderr: e.stderr?.trim() ?? String(e),
      code:   e.code ?? 1,
    }
  }
}

export async function installFromZip(): Promise<{ id: string; name: string } | { error: string }> {
  const r = await dialog.showOpenDialog({
    title:      'Select plugin ZIP',
    filters:    [{ name: 'ZIP archive', extensions: ['zip'] }],
    properties: ['openFile'],
  })
  if (r.canceled || !r.filePaths[0]) return { error: 'cancelled' }
  const zipPath = r.filePaths[0]

  try {
    const zip     = new AdmZip(zipPath)
    const tmpDir  = path.join(app.getPath('temp'), `oo-plugin-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    zip.extractAllTo(tmpDir, true)

    const manifest = findManifest(tmpDir)
    if (!manifest) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      return { error: 'No valid manifest.json found in ZIP' }
    }

    const destDir = path.join(pluginsDir(), manifest.id)
    if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true })

    // If manifest was found one level deep, use that sub-folder as root
    const manifestFile = path.join(tmpDir, 'manifest.json')
    const sourceDir    = fs.existsSync(manifestFile)
      ? tmpDir
      : fs.readdirSync(tmpDir).map((n) => path.join(tmpDir, n)).find((p) => fs.existsSync(path.join(p, 'manifest.json'))) ?? tmpDir

    fs.cpSync(sourceDir, destDir, { recursive: true })
    fs.rmSync(tmpDir, { recursive: true, force: true })

    return { id: manifest.id, name: manifest.name }
  } catch (e) {
    return { error: String(e) }
  }
}

export function deletePlugin(id: string): void {
  const dir = path.join(pluginsDir(), id)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  const enabled = readEnabled()
  enabled.delete(id)
  writeEnabled(enabled)
}

export function openPluginsDir(): string {
  return pluginsDir()
}
