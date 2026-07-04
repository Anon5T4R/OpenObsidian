import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import type { PluginInfo } from '../../../../preload/index'
import './PluginPanel.css'

interface PluginPanelProps {
  plugin:    PluginInfo
  vaultPath: string | null
  theme:     'dark' | 'light'
  onClose:   () => void
  onNotify:  (msg: string) => void
}

export default function PluginPanel({ plugin, vaultPath, theme, onClose, onNotify }: PluginPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load panel HTML from disk
  useEffect(() => {
    if (!plugin.panelPath) { setError('No panel defined for this plugin.'); return }
    window.api.readFile(plugin.panelPath)
      .then((raw) => setHtml(buildSrcDoc(raw, vaultPath, theme)))
      .catch((e) => setError(String(e)))
  }, [plugin.panelPath, vaultPath, theme])

  // Handle bridge messages from iframe
  const handleMessage = useCallback(async (e: MessageEvent) => {
    if (!e.data?.__pt || !e.data?.__pi) return
    const { __pt: type, __pi: id, ...payload } = e.data
    let reply: Record<string, unknown> = { __pr: true, __pi: id }

    switch (type) {
      case 'exec': {
        const cwd   = payload.cwd as string | undefined ?? vaultPath ?? undefined
        const nl    = payload.neutralLocale as boolean | undefined
        const res   = await window.api.pluginExec(payload.cmd as string, (payload.args as string[]) ?? [], cwd, nl)
        reply = { ...reply, ...res }
        break
      }
      case 'readFile': {
        try {
          const p   = resolvePluginPath(payload.path as string, vaultPath)
          reply.content = await window.api.readFile(p)
        } catch (err) { reply.error = String(err) }
        break
      }
      case 'writeFile': {
        try {
          const p = resolvePluginPath(payload.path as string, vaultPath)
          await window.api.writeFile(p, payload.content as string)
        } catch (err) { reply.error = String(err) }
        break
      }
      case 'notify': {
        onNotify(payload.msg as string)
        break
      }
    }

    iframeRef.current?.contentWindow?.postMessage(reply, '*')
  }, [vaultPath, onNotify])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  return (
    <div className="plugin-panel">
      <div className="plugin-panel-header">
        <span className="plugin-panel-title">
          {plugin.icon ?? '⬡'} {plugin.name}
        </span>
        <button className="plugin-panel-close" onClick={onClose} title="Close" aria-label="Close"><X size={16} /></button>
      </div>

      <div className="plugin-panel-body">
        {error ? (
          <div className="plugin-panel-error">{error}</div>
        ) : html === null ? (
          <div className="plugin-panel-loading">Loading…</div>
        ) : (
          <iframe
            ref={iframeRef}
            className="plugin-panel-iframe"
            srcDoc={html}
            sandbox="allow-scripts allow-forms"
            title={plugin.name}
          />
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePluginPath(p: string, vaultPath: string | null): string {
  if (/^([A-Za-z]:[\\/]|[\\/])/.test(p)) return p
  return vaultPath ? `${vaultPath}/${p}` : p
}

const BRIDGE_SCRIPT = `
(function(){
  var _p={};
  function _call(type,payload){
    return new Promise(function(resolve){
      var id=Date.now().toString(36)+Math.random().toString(36).slice(2);
      _p[id]=resolve;
      window.parent.postMessage(Object.assign({},payload,{__pt:type,__pi:id}),'*');
    });
  }
  window.pluginApi={
    exec:      function(cmd,args,cwd,opts){ return _call('exec',{cmd:cmd,args:args||[],cwd:cwd,neutralLocale:opts?.neutralLocale}); },
    readFile:  function(p){            return _call('readFile',{path:p}); },
    writeFile: function(p,c){          return _call('writeFile',{path:p,content:c}); },
    notify:    function(msg){          return _call('notify',{msg:msg}); },
  };
  window.addEventListener('message',function(e){
    if(e.data&&e.data.__pr&&_p[e.data.__pi]){
      _p[e.data.__pi](e.data);
      delete _p[e.data.__pi];
    }
  });
})();`

function buildThemeCss(theme: 'dark' | 'light'): string {
  const d = theme === 'dark'
  return `:root{
    --bg:${d?'#1e1e2e':'#ffffff'};
    --bg2:${d?'#2a2a3e':'#f4f4f8'};
    --bg3:${d?'#323248':'#eaeaf3'};
    --text:${d?'#e2e0f0':'#1e1e2e'};
    --text2:${d?'#9a98b8':'#6b6b80'};
    --accent:${d?'#7c6af7':'#6d28d9'};
    --accent-hover:${d?'#6b5ce7':'#5b21b6'};
    --border:${d?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)'};
    --success:${d?'#22c55e':'#16a34a'};
    --danger:${d?'#ef4444':'#dc2626'};
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px;
    color:var(--text);
    background:var(--bg);
  }
  *{box-sizing:border-box}
  body{margin:0;padding:0;background:var(--bg);color:var(--text)}
  button{cursor:pointer;font-family:inherit}
  input,select,textarea{font-family:inherit}`
}

function buildSrcDoc(pluginHtml: string, vaultPath: string | null, theme: 'dark' | 'light'): string {
  const injection = `<script>${BRIDGE_SCRIPT}
window.VAULT_PATH=${JSON.stringify(vaultPath)};
</script><style>${buildThemeCss(theme)}</style>`

  if (pluginHtml.includes('</head>')) {
    return pluginHtml.replace('</head>', `${injection}</head>`)
  }
  if (pluginHtml.includes('<body')) {
    return pluginHtml.replace(/(<body[^>]*>)/, `$1${injection}`)
  }
  return injection + pluginHtml
}
