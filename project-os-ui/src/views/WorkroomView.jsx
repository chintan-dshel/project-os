import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchWorkroomLog, postLogEntry, fetchChatThread, postChatMessage } from '../lib/api.js'
import { renderMd } from '../lib/renderMd.jsx'

const AGENT_CFG = {
  planner: {
    icon: '◑',
    name: 'Planner',
    color: 'var(--blue)',
    bg: 'var(--blue-bg)',
    role: 'Scope · priorities · timeline',
    prompts: [
      'What should I focus on this week?',
      'Is my timeline realistic for what\'s left?',
      'Help me reprioritize the remaining tasks.',
    ],
  },
  'risk-advisor': {
    icon: '⚑',
    name: 'Risk Advisor',
    color: 'var(--amber)',
    bg: 'var(--amber-bg)',
    role: 'Risks · blockers · mitigation',
    prompts: [
      'What could derail this project right now?',
      'How do I unblock this task?',
      'Review my open risks with me.',
    ],
  },
  'execution-coach': {
    icon: '◎',
    name: 'Execution Coach',
    color: 'var(--teal)',
    bg: 'var(--teal-bg)',
    role: 'Velocity · blockers · daily focus',
    prompts: [
      'My momentum is low — what should I do?',
      'Help me plan today\'s work session.',
      'I\'m stuck on a task, think it through with me.',
    ],
  },
}

function LogEntry({ entry }) {
  const isAgent  = entry.kind === 'agent'
  const isSystem = entry.kind === 'system'
  const time = new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="wrl-entry">
      <div className={`wrl-entry__rail`}>
        <div className={`wrl-entry__dot${isAgent ? ' wrl-entry__dot--agent' : isSystem ? ' wrl-entry__dot--sys' : ''}`} />
        <div className="wrl-entry__line" />
      </div>
      <div className="wrl-entry__body">
        <div className="wrl-entry__head">
          {entry.author && (
            <span className={`wrl-entry__who${isAgent ? ' wrl-entry__who--agent' : ''}`}>{entry.author}</span>
          )}
          <span className="wrl-entry__time">{time}</span>
        </div>
        <div className="wrl-entry__text">{entry.body}</div>
        {entry.delta_summary && (
          <span className="wrl-entry__delta">{entry.delta_summary}</span>
        )}
      </div>
    </div>
  )
}

function ChatMessage({ msg }) {
  const isAgent = msg.role === 'agent'
  const cfg = isAgent ? AGENT_CFG[msg.agent_name] : null
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div className={`wrc-msg${isAgent ? ' wrc-msg--agent' : ' wrc-msg--user'}`}>
      {isAgent && (
        <div
          className="wrc-msg__avatar"
          style={{ background: cfg?.bg ?? 'var(--bg-3)', color: cfg?.color ?? 'var(--text-2)' }}
        >
          {cfg?.icon ?? '★'}
        </div>
      )}
      <div className="wrc-msg__bubble">
        <div className="wrc-msg__content">
          {isAgent ? renderMd(msg.body) : msg.body}
        </div>
        <div className="wrc-msg__time">{time}</div>
      </div>
    </div>
  )
}

export default function WorkroomView({ projectId, project }) {
  const [entries,     setEntries]     = useState([])
  const [logLoading,  setLogLoading]  = useState(true)
  const [agent,       setAgent]       = useState('planner')
  const [messages,    setMessages]    = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [input,       setInput]       = useState('')
  const [sending,     setSending]     = useState(false)
  const [newNote,     setNewNote]     = useState('')
  const [addingNote,  setAddingNote]  = useState(false)
  const chatEndRef = useRef(null)

  const loadLog = useCallback(async () => {
    setLogLoading(true)
    try {
      const d = await fetchWorkroomLog(projectId)
      setEntries(d.entries ?? [])
    } catch (e) { console.error(e) }
    finally { setLogLoading(false) }
  }, [projectId])

  const loadChat = useCallback(async (agentName) => {
    setChatLoading(true)
    setMessages([])
    try {
      const d = await fetchChatThread(projectId, agentName)
      setMessages(d.messages ?? [])
    } catch (e) { console.error(e) }
    finally { setChatLoading(false) }
  }, [projectId])

  useEffect(() => { loadLog() },         [loadLog])
  useEffect(() => { loadChat(agent) },   [loadChat, agent])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(text) {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    setInput('')
    setSending(true)
    const optId = `opt-${Date.now()}`
    setMessages(prev => [...prev, { id: optId, role: 'user', body: msg, created_at: new Date().toISOString() }])
    try {
      const d = await postChatMessage(projectId, agent, msg)
      setMessages(prev => [...prev.filter(m => m.id !== optId), d.user, d.agent])
    } catch (e) {
      console.error(e)
      setMessages(prev => prev.filter(m => m.id !== optId))
    } finally { setSending(false) }
  }

  async function addNote() {
    if (!newNote.trim()) return
    setAddingNote(true)
    try {
      const d = await postLogEntry(projectId, { kind: 'user', body: newNote.trim(), author: 'You' })
      setEntries(prev => [d.entry, ...prev])
      setNewNote('')
    } catch (e) { console.error(e) }
    finally { setAddingNote(false) }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const cfg = AGENT_CFG[agent]

  return (
    <div className="wr">
      {/* ── Activity log (left) ─────────────────────────────────────────────── */}
      <div className="wr__log">
        <div className="wr__log-head">
          <span className="wr__log-title">Activity</span>
          <button className="wr__add-btn" onClick={() => setAddingNote(n => !n)} title="Add note">+</button>
        </div>

        {addingNote && (
          <div className="wr__note-form">
            <textarea
              className="wr__note-input"
              rows={2}
              placeholder="Add a note to the timeline…"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="wr__send-btn" onClick={addNote} disabled={!newNote.trim() || addingNote}>
                {addingNote ? '…' : 'Add'}
              </button>
              <button className="wr__cancel-btn" onClick={() => { setAddingNote(false); setNewNote('') }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="wr__log-list">
          {logLoading
            ? <div className="wr__loading">Loading…</div>
            : entries.length === 0
              ? (
                <div className="wrl-empty">
                  <div className="wrl-empty__icon">◎</div>
                  <div className="wrl-empty__title">Activity Timeline</div>
                  <div className="wrl-empty__sub">
                    Agent actions, scope changes, and check-in summaries appear here automatically.
                    Use <strong>+</strong> to add your own notes.
                  </div>
                </div>
              )
              : entries.map(e => <LogEntry key={e.id} entry={e} />)
          }
        </div>
      </div>

      {/* ── Agent consultants (right) ────────────────────────────────────────── */}
      <div className="wr__chat">
        {/* Agent selector */}
        <div className="wrc-agents">
          {Object.entries(AGENT_CFG).map(([key, c]) => (
            <button
              key={key}
              className={`wrc-agent-btn${agent === key ? ' wrc-agent-btn--active' : ''}`}
              onClick={() => setAgent(key)}
              style={agent === key ? { borderColor: c.color, background: c.bg } : {}}
            >
              <span className="wrc-agent-btn__icon" style={{ color: agent === key ? c.color : undefined }}>
                {c.icon}
              </span>
              <div>
                <div className="wrc-agent-btn__name">{c.name}</div>
                <div className="wrc-agent-btn__role">{c.role}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="wr__msgs">
          {chatLoading
            ? <div className="wr__loading">Loading…</div>
            : messages.length === 0
              ? (
                <div className="wrc-empty">
                  <div className="wrc-empty__icon" style={{ color: cfg.color }}>{cfg.icon}</div>
                  <div className="wrc-empty__name">{cfg.name}</div>
                  <div className="wrc-empty__role">{cfg.role}</div>
                  <div className="wrc-empty__prompts">
                    {cfg.prompts.map((p, i) => (
                      <button key={i} className="wrc-empty__prompt" onClick={() => send(p)}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )
              : messages.map(m => <ChatMessage key={m.id} msg={m} />)
          }
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="wr__input-row">
          <textarea
            className="wr__input"
            rows={2}
            placeholder={`Ask ${cfg.name}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={sending}
          />
          <button className="wr__send-btn" onClick={() => send()} disabled={!input.trim() || sending}>
            {sending ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
