import { useEffect, useRef, useState } from 'react'
import { API, chat } from './chat.js'

// one conversation per professor per page load; the backend keeps the history under this id
const SESSION = crypto.randomUUID()

const GREETINGS = {
  zaman: "Yo! Welcome to MGT 409 👋 Ask me anything: AI agents, regression, the central limit theorem, which courses to take... I got you.",
}

export default function ChatPanel({ prof, onClose }) {
  const [log, setLog] = useState(() => [{ from: 'prof', text: GREETINGS[prof.id] ?? `Hi! I'm Prof. ${prof.name}. What's on your mind?` }])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef()
  const end = useRef()

  useEffect(() => {
    input.current?.focus()
  }, [])
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log, busy])
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const send = async (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    setLog((l) => [...l, { from: 'me', text }])
    setBusy(true)
    try {
      const r = await fetch(`${API}/chat/${prof.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION, message: text }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.detail || `The chat server answered ${r.status}.`)
      chat.speakingUntil = performance.now() + Math.min(9000, 1200 + data.reply.length * 40) // mouth moves while you read
      setLog((l) => [...l, { from: 'prof', text: data.reply }])
    } catch (err) {
      const msg = err instanceof TypeError ? "Can't reach the chat server. Is the backend running on port 8000?" : err.message
      setLog((l) => [...l, { from: 'error', text: msg }])
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  return (
    <div className="chat" role="dialog" aria-label={`Chat with Prof. ${prof.name}`}>
      <header>
        <div>
          <div className="kicker">{prof.course}</div>
          <h2>Prof. {prof.name}</h2>
        </div>
        <button className="close" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </header>
      <div className="log">
        {log.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="msg prof typing">typing…</div>}
        <div ref={end} />
      </div>
      <form onSubmit={send}>
        <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask a question…" maxLength={4000} />
        <button className="go" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
      <div className="chathint">Esc or ✕ to get back to walking</div>
    </div>
  )
}
