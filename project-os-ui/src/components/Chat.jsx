/**
 * Chat.jsx — v0.4
 * Message list + input. Uses new design system CSS.
 */

import { useEffect, useRef, useState } from 'react'

function stripJSON(content) {
  return content
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .trim()
}

function Message({ msg }) {
  const isUser   = msg.role === 'user'
  const isSystem = msg.role === 'system'
  // Derive a human-readable agent label from the message's agent field or context
  const agentLabel = msg.agent
    ? { intake: 'Intake', planning: 'Planning', execution: 'Execution', retro: 'Retro' }[msg.agent] ?? 'Agent'
    : 'Agent'

  const content  = stripJSON(msg.content)
  const time     = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  if (isSystem) {
    return (
      <div className="msg msg--system">
        <span className="msg__system-text">{content}</span>
      </div>
    )
  }

  return (
    <div className={`msg msg--${isUser ? 'user' : 'agent'}`}>
      <div className="msg__meta">
        <span className="msg__role">{isUser ? 'YOU' : agentLabel}</span>
        {time && <span className="msg__time">{time}</span>}
      </div>
      <div className="msg__bubble">
        {content.split('\n').filter(Boolean).map((line, i) => (
          <p key={i} className="msg__line">{line}</p>
        ))}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="msg msg--agent">
      <div className="msg__meta"><span className="msg__role">AGENT</span></div>
      <div className="msg__bubble" style={{ padding: '12px 16px' }}>
        <div className="typing">
          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
        </div>
      </div>
    </div>
  )
}

export default function Chat({ conversation, sending, onSend, disabled }) {
  const [input,  setInput]  = useState('')
  const bottomRef            = useRef(null)
  const textareaRef          = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation, sending])

  function submit() {
    const msg = input.trim()
    if (!msg || sending || disabled) return
    onSend(msg)
    setInput('')
    textareaRef.current?.focus()
  }

  return (
    <div className="chat">
      <div className="chat__messages">
        {conversation.length === 0 && (
          <div className="chat__empty">
            <div className="chat__empty-icon">◎</div>
            <div className="chat__empty-title">Start the conversation</div>
            <div className="chat__empty-sub">Describe your project idea to begin intake</div>
          </div>
        )}
        {conversation.map((msg, i) => <Message key={msg.id ?? `m${i}`} msg={msg} />)}
        {sending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <div className="chat__input-area">
        <textarea
          ref={textareaRef}
          className="chat__textarea"
          rows={3}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
          }}
          placeholder={disabled
            ? 'Resolve the gate above to continue…'
            : 'Message the agent… (Enter to send, Shift+Enter for newline)'
          }
          disabled={sending}
        />
        <button
          className="chat__send"
          onClick={submit}
          disabled={sending || !input.trim() || disabled}
        >
          {sending ? <span className="chat__spinner" /> : '↑'}
        </button>
      </div>
    </div>
  )
}
