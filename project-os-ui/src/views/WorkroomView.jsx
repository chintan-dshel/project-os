import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchWorkroomLog, postLogEntry, fetchChatThread, postChatMessage } from '../lib/api.js'

const KIND_CFG = {
  user:   { color: 'var(--teal)',  label: 'USER' },
  agent:  { color: 'var(--blue)',  label: 'AGENT' },
  system: { color: 'var(--text-3)', label: 'SYS' },
}

function LogEntry({ entry }) {
  const cfg = KIND_CFG[entry.kind] ?? KIND_CFG.system
  const time = new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="logent">
      <div className="logent__meta">
        <span className="logent__kind mono" style={{ color: cfg.color }}>{cfg.label}</span>
        <span className="logent__author">{entry.author ?? (entry.kind === 'system' ? 'System' : 'Unknown')}</span>
        <span className="logent__time">{time}</span>
      </div>
      <div className="logent__body">{entry.body}</div>
      {entry.delta_summary && (
        <div className="logent__delta">{entry.delta_summary}</div>
      )}
    </div>
  )
}

function ChatMessage({ msg }) {
  const isAgent = msg.role === 'agent'
  return (
    <div className={`msg${isAgent ? ' msg--agent' : ' msg--user'}`}>
      {isAgent && <div className="msg__name">{msg.agent_name ?? 'Agent'}</div>}
      <div className="msg__body">{msg.body}</div>
    </div>
  )
}

const AGENTS = ['planner', 'risk-advisor', 'execution-coach']

export default function WorkroomView({ projectId, project }) {
  const [entries,    setEntries]    = useState([])
  const [logLoading, setLogLoading] = useState(true)
  const [agent,      setAgent]      = useState('planner')
  const [messages,   setMessages]   = useState([])
  const [chatLoading,setChatLoading]= useState(false)
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [newNote,    setNewNote]    = useState('')
  const [addingNote, setAddingNote] = useState(false)
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
    try {
      const d = await fetchChatThread(projectId, agentName)
      setMessages(d.messages ?? [])
    } catch (e) { console.error(e) }
    finally { setChatLoading(false) }
  }, [projectId])

  useEffect(() => { loadLog() }, [loadLog])
  useEffect(() => { loadChat(agent) }, [loadChat, agent])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const d = await postChatMessage(projectId, agent, text)
      setMessages(prev => [...prev, d.user, d.agent])
    } catch (e) { console.error(e) }
    finally { setSending(false) }
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

  return (
    <div className="wr">
      {/* ── Timeline log (left) ─────────────────────────────────────────────── */}
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
              ? <div className="wr__empty">No activity yet. Events from agents and your actions appear here.</div>
              : entries.map(e => <LogEntry key={e.id} entry={e} />)
          }
        </div>
      </div>

      {/* ── Agent chat (right) ──────────────────────────────────────────────── */}
      <div className="wr__chat">
        <div className="wr__chat-head">
          <div className="wr__agent-tabs">
            {AGENTS.map(a => (
              <button
                key={a}
                className={`wr__agent-tab${agent === a ? ' wr__agent-tab--active' : ''}`}
                onClick={() => setAgent(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="wr__msgs">
          {chatLoading
            ? <div className="wr__loading">Loading…</div>
            : messages.length === 0
              ? <div className="wr__empty">Start a conversation with the {agent}.</div>
              : messages.map(m => <ChatMessage key={m.id} msg={m} />)
          }
          <div ref={chatEndRef} />
        </div>
        <div className="wr__input-row">
          <textarea
            className="wr__input"
            rows={2}
            placeholder={`Message ${agent}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={sending}
          />
          <button className="wr__send-btn" onClick={send} disabled={!input.trim() || sending}>
            {sending ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
