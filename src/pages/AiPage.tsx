import { useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { apiBaseUrl, apiOrigin } from '../config/entra'

/**
 * "AI assistant" — not an embedded chatbot, but a bring-your-own-AI page. The
 * Contact API exposes an MCP (Model Context Protocol) server, so a customer can
 * connect Claude or ChatGPT directly to their own Redcentric data and talk to
 * it in plain language, under the same me / team permissions as the portal.
 *
 * The server URL is derived from VITE_API_BASE_URL so it always matches this
 * deployment's scope (…/api/v2/<scope>/mcp), and the "get a key" link deep-links
 * into the API's own MCP setup page.
 */
const MCP_URL = `${apiBaseUrl}/mcp`
const KEY_SETUP_URL = `${apiOrigin}/mcp`

export function AiPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI assistant"
        subtitle="Bring your own AI — connect Claude or ChatGPT to your Redcentric data"
      />

      <Intro />
      <Steps />
      <Endpoint />
      <ClientSetup />
      <Capabilities />
    </div>
  )
}

/** The pitch: this is your assistant talking to your data, not a bolted-on bot. */
function Intro() {
  return (
    <Card className="overflow-hidden">
      <div className="rc-gradient h-1 w-full" />
      <div className="p-6">
        <div className="flex items-start gap-4">
          <SparkIcon />
          <div>
            <h2 className="text-xl font-light tracking-tight text-rc-navy">
              Talk to your data — with the AI you already use
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-rc-teal">
              This isn&rsquo;t a chatbot bolted onto the portal. The Contact API
              speaks the{' '}
              <a
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noreferrer"
                className="text-rc-blue hover:underline"
              >
                Model Context Protocol (MCP)
              </a>
              , so you can connect an assistant you already trust —{' '}
              <span className="font-medium text-rc-navy">Claude</span> or{' '}
              <span className="font-medium text-rc-navy">ChatGPT</span> — straight
              to your Redcentric data. Ask about your quotes, projects, sites,
              support cases and colleagues in plain language. Your assistant sees
              (and can update) exactly what you&rsquo;re allowed to — the same{' '}
              <span className="font-medium text-rc-navy">my</span> /{' '}
              <span className="font-medium text-rc-navy">company</span> permissions
              as this portal.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

/** Three-step getting-started strip. */
function Steps() {
  const steps = [
    {
      n: '1',
      title: 'Get your key',
      body: 'Generate a personal MCP key from the API playground. It carries your permissions and can be revoked at any time.',
    },
    {
      n: '2',
      title: 'Connect your assistant',
      body: 'Add the MCP server URL below to Claude or ChatGPT with your key as a bearer token — no install, no code.',
    },
    {
      n: '3',
      title: 'Just ask',
      body: '“How many open support cases do we have?” · “Summarise our quotes this quarter” · “Draft a note on the Data Centre Migration project.”',
    },
  ]
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {steps.map((s) => (
        <Card key={s.n} className="p-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rc-blue-light text-sm font-semibold text-rc-blue">
            {s.n}
          </div>
          <h3 className="mt-3 text-base font-normal tracking-tight text-rc-navy">
            {s.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-rc-teal">{s.body}</p>
        </Card>
      ))}
    </div>
  )
}

/** The scope-specific MCP server URL, with copy + a link to generate a key. */
function Endpoint() {
  return (
    <Card className="p-6">
      <h3 className="text-base font-normal tracking-tight text-rc-navy">
        Your MCP server
      </h3>
      <p className="mt-1 text-sm text-rc-teal">
        Point your assistant at this endpoint and authenticate with a bearer key.
      </p>
      <CopyRow value={MCP_URL} className="mt-3" />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href={KEY_SETUP_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-rc-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rc-navy"
        >
          Get your MCP key
        </a>
        <a
          href={KEY_SETUP_URL}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-rc-blue hover:underline"
        >
          Full setup guide →
        </a>
      </div>
    </Card>
  )
}

type ClientKey = 'claude-desktop' | 'claude-code' | 'chatgpt'

/** Per-client connection instructions with a copyable snippet. */
function ClientSetup() {
  const [client, setClient] = useState<ClientKey>('claude-desktop')

  const tabs: { key: ClientKey; label: string }[] = [
    { key: 'claude-desktop', label: 'Claude Desktop' },
    { key: 'claude-code', label: 'Claude Code' },
    { key: 'chatgpt', label: 'ChatGPT' },
  ]

  const snippets: Record<ClientKey, { note: string; code: string; lang: string }> = {
    'claude-desktop': {
      note: 'Add this to claude_desktop_config.json (Settings → Developer → Edit config), then restart Claude.',
      lang: 'json',
      code: `{
  "mcpServers": {
    "redcentric": {
      "type": "streamableHttp",
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_KEY"
      }
    }
  }
}`,
    },
    'claude-code': {
      note: 'Run this once in your terminal to register the server.',
      lang: 'bash',
      code: `claude mcp add redcentric --transport http \\
  ${MCP_URL} \\
  --header "Authorization: Bearer YOUR_MCP_KEY"`,
    },
    chatgpt: {
      note: 'Settings → Connectors → Add MCP server. Paste the URL and choose “Bearer token” authentication.',
      lang: 'text',
      code: `Server URL:  ${MCP_URL}
Auth:        Bearer token
Token:       YOUR_MCP_KEY`,
    },
  }

  const active = snippets[client]

  return (
    <Card className="p-6">
      <h3 className="text-base font-normal tracking-tight text-rc-navy">
        Connect your assistant
      </h3>
      <div className="mt-3 flex flex-wrap gap-1 rounded-lg bg-rc-canvas p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setClient(t.key)}
            className={
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
              (client === t.key
                ? 'bg-white text-rc-navy shadow-sm'
                : 'text-rc-teal hover:text-rc-navy')
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-rc-teal">{active.note}</p>
      <CodeBlock code={active.code} className="mt-3" />
      <p className="mt-3 text-xs text-rc-teal">
        Replace <code className="rounded bg-rc-canvas px-1 py-0.5">YOUR_MCP_KEY</code>{' '}
        with the key you generated above.
      </p>
    </Card>
  )
}

/** What the assistant can actually do, and the guardrails. */
function Capabilities() {
  const tools = [
    'List records',
    'Get a record',
    'Create records',
    'Update records',
    'Look up references',
    'Read the schema',
    'Read choice values',
    'Who am I',
  ]
  return (
    <Card className="p-6">
      <h3 className="text-base font-normal tracking-tight text-rc-navy">
        What it can do
      </h3>
      <p className="mt-1 text-sm text-rc-teal">
        Eight tools across your tables, every call scoped to your{' '}
        <span className="font-medium text-rc-navy">my</span> or{' '}
        <span className="font-medium text-rc-navy">company</span> access — the
        assistant can never see more than you can.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tools.map((t) => (
          <span
            key={t}
            className="rounded-full border border-rc-blue-light bg-rc-canvas px-3 py-1 text-xs font-medium text-rc-navy"
          >
            {t}
          </span>
        ))}
      </div>
    </Card>
  )
}

/** A single-line value with a copy button (for the endpoint URL). */
function CopyRow({ value, className = '' }: { value: string; className?: string }) {
  const { copied, copy } = useCopy()
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-rc-blue-light bg-rc-canvas p-1 pl-3 ${className}`}
    >
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-sm text-rc-navy">
        {value}
      </code>
      <button
        type="button"
        onClick={() => copy(value)}
        className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-rc-blue shadow-sm transition-colors hover:bg-rc-blue-light"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

/** Multi-line code block with a copy button. */
function CodeBlock({ code, className = '' }: { code: string; className?: string }) {
  const { copied, copy } = useCopy()
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => copy(code)}
        className="absolute right-2 top-2 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto rounded-lg bg-rc-navy p-4 pr-16 text-xs leading-relaxed text-white/90">
        <code>{code}</code>
      </pre>
    </div>
  )
}

/** Clipboard helper with a brief "Copied" confirmation. */
function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return { copied, copy }
}

function SparkIcon() {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rc-blue-light text-rc-blue">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <path d="M12 8.5 13.2 11 15.5 12l-2.3 1L12 15.5 10.8 13 8.5 12l2.3-1L12 8.5Z" />
      </svg>
    </span>
  )
}
