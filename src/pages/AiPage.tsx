import { useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { apiBaseUrl } from '../config/entra'
import { clarityEvent, clarityUpgrade } from '../lib/clarity'

/**
 * "AI assistant" — not an embedded chatbot, but a bring-your-own-AI page. The
 * Contact API exposes an MCP (Model Context Protocol) server, so a customer can
 * connect Claude or ChatGPT directly to their own Redcentric data and talk to
 * it in plain language, under the same me / team permissions as the portal.
 *
 * Connection is OAuth — the assistant signs the user in with their Redcentric
 * login. No API key to mint, no install. The server URL is derived from
 * VITE_API_BASE_URL so it always matches this deployment's scope.
 */
const MCP_URL = `${apiBaseUrl}/mcp`

export function AiPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI assistant"
        subtitle="Bring your own AI — connect Claude or ChatGPT to your Redcentric data"
      />

      <Intro />
      <Connect />
      <Showcase />
      <Trust />
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

type ClientKey = 'chatgpt' | 'claude' | 'claude-code'

/** How to connect — OAuth, no key. A short picker with per-client steps. */
function Connect() {
  const [client, setClient] = useState<ClientKey>('chatgpt')

  const tabs: { key: ClientKey; label: string }[] = [
    { key: 'chatgpt', label: 'ChatGPT' },
    { key: 'claude', label: 'Claude' },
    { key: 'claude-code', label: 'Claude Code' },
  ]

  const guides: Record<ClientKey, { steps?: string[]; code?: string }> = {
    chatgpt: {
      steps: [
        'Open Settings → Connectors → Add custom connector.',
        'Paste the MCP server URL above and click Connect.',
        'Sign in with your Redcentric login when the browser opens — that’s it.',
      ],
    },
    claude: {
      steps: [
        'Open Settings → Connectors → Add custom connector.',
        'Paste the MCP server URL and confirm.',
        'Sign in with your Redcentric login to authorise access.',
      ],
    },
    'claude-code': {
      code: `claude mcp add redcentric --transport http ${MCP_URL}`,
    },
  }

  const active = guides[client]

  return (
    <Card className="p-6">
      <h3 className="text-base font-normal tracking-tight text-rc-navy">
        Connect in under a minute
      </h3>
      <p className="mt-1 text-sm text-rc-teal">
        Point your assistant at this server and sign in with your Redcentric
        login. No API key to create, nothing to install.
      </p>
      <CopyRow value={MCP_URL} className="mt-3" />

      <div className="mt-4 flex flex-wrap gap-1 rounded-lg bg-rc-canvas p-1">
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

      {active.steps && (
        <ol className="mt-4 space-y-2">
          {active.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-rc-teal">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rc-blue-light text-xs font-semibold text-rc-blue">
                {i + 1}
              </span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {active.code && (
        <>
          <p className="mt-4 text-sm text-rc-teal">
            Run this once — it opens a browser to sign you in.
          </p>
          <CodeBlock code={active.code} className="mt-2" />
        </>
      )}
    </Card>
  )
}

/** A sample question. */
type Turn = { q: string; a: string }

/** "See what you can ask" — a back-and-forth transcript that shows the breadth
 * of what the assistant can do against live data (read, aggregate, write). */
function Showcase() {
  const turns: Turn[] = [
    {
      q: 'How many open support tickets do we have, and which is most urgent?',
      a: 'You’ve got 7 open tickets for Chevin Print. The most urgent is CAS‑1042 “VPN dropping at the Otley site” — High priority, raised 12 days ago and still unassigned.',
    },
    {
      q: 'Summarise our quotes this quarter.',
      a: '3 live quotes totalling £48,200. The largest is “Managed Firewall + SD‑WAN” at £27,500, sent 14 Jun and awaiting your sign‑off.',
    },
    {
      q: 'When does the Data Centre Migration project finish?',
      a: 'It runs 1 Jul → 21 Dec 2026 — one of 12 active projects for your company. Want the full schedule, or just the ones ending this year?',
    },
    {
      q: 'Update my mobile number to 07700 900123.',
      a: 'Done — I’ve updated your contact record. I can only change your own details, nothing else on the account.',
    },
  ]

  return (
    <div>
      <h3 className="mb-1 text-xl font-light tracking-tight text-white">
        See what you can ask
      </h3>
      <p className="mb-4 text-sm text-white/80">
        Real questions, real answers — straight from your live Redcentric data.
      </p>
      <Card className="overflow-hidden">
        <div className="rc-gradient h-1 w-full" />
        <div className="space-y-4 p-5 sm:p-6">
          {turns.map((t, i) => (
            <div key={i} className="space-y-3">
              <UserBubble>{t.q}</UserBubble>
              <AiBubble>{t.a}</AiBubble>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-rc-blue px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
        {children}
      </div>
    </div>
  )
}

function AiBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rc-blue-light text-rc-blue">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <path d="M12 8.5 13.2 11 15.5 12l-2.3 1L12 15.5 10.8 13 8.5 12l2.3-1L12 8.5Z" />
        </svg>
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-rc-blue-light bg-white px-4 py-2.5 text-sm leading-relaxed text-rc-navy shadow-sm">
        {children}
      </div>
    </div>
  )
}

/** Reassurance line — the guardrail is part of the pitch. */
function Trust() {
  return (
    <Card className="p-5">
      <p className="text-sm leading-relaxed text-rc-teal">
        <span className="font-medium text-rc-navy">Your data stays yours.</span>{' '}
        The assistant signs in as you and is scoped to the same{' '}
        <span className="font-medium text-rc-navy">my</span> /{' '}
        <span className="font-medium text-rc-navy">company</span> access as this
        portal — it can never see or change anything you couldn&rsquo;t. Revoke
        access any time from your assistant&rsquo;s connector settings.
      </p>
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
      // Both copy targets on this page are MCP connect artifacts (server URL /
      // CLI command) — copying one means the customer is wiring up their AI,
      // the moment this page exists for. Keep that session's recording.
      clarityEvent('ai-mcp-copied')
      clarityUpgrade('ai-mcp-copied')
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
