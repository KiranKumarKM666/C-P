import { useState, useEffect, useRef } from 'react'
import { getUser } from '../api.js'

const KB = [
  { q: ['attendance','present','absent'], a: 'Go to a course → Attendance tab. Mark each student Present/Absent and hit Save, or upload a CSV via "Bulk Upload".' },
  { q: ['marks','cie','upload'], a: 'Open a course → Marks tab. Enter CIE scores per student and assessment, or upload XLSX/CSV with columns: usn, assessment, max_marks, marks (AB for absent).' },
  { q: ['deficit','at.risk','critical','advisory'], a: 'The Deficits tab ranks students by risk. Critical = below 75% attendance. Advisory = 75–85%. Students flagged on both metrics are ranked highest.' },
  { q: ['advisory','draft','approve','message'], a: 'On the Deficits tab, click "Draft advisory" on a student. The AI writes a draft — you edit it, then click Approve. Students only see approved messages.' },
  { q: ['report','pdf','excel','download'], a: 'Reports tab per course. Choose Attendance, CIE, or Deficit report. Download as PDF or Excel.' },
  { q: ['student portal','student view'], a: 'Log in with student credentials. The Student Portal shows your attendance %, CIE scores, and any approved advisories from faculty.' },
  { q: ['admin','settings','threshold','hod'], a: 'Log in as Admin → Admin Panel. Change attendance/CIE thresholds, manage users and courses.' },
  { q: ['login','sign in','password'], a: 'Demo: Faculty = meera@college.edu / faculty123, Admin = hod@college.edu / admin123, Student = asha@college.edu / student123.' },
]

function findAnswer(text) {
  const lower = text.toLowerCase()
  for (const item of KB) {
    if (item.q.some(k => lower.includes(k))) return item.a
  }
  return "I'm your FacultyFlow assistant. Ask about attendance, marks, deficits, advisories, or reports!"
}

export default function Chatbot() {
  const user = getUser()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: `Hi ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm your FacultyFlow assistant. How can I help?` }
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  if (!user) return null

  const send = () => {
    const text = input.trim()
    if (!text) return
    const answer = findAnswer(text)
    setMsgs(m => [...m, { role: 'user', text }, { role: 'bot', text: answer }])
    setInput('')
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full flex items-center justify-center transition-all"
        style={{ background: 'var(--accent)', boxShadow: '0 4px 20px rgba(45,106,79,0.4)', width: 52, height: 52 }}
        title="FacultyFlow Assistant"
      >
        {open
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        }
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 320, height: 420,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2"
               style={{ background: 'var(--accent)', color: '#fff' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            <span className="font-semibold text-sm">FacultyFlow Assistant</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="text-xs rounded-xl px-3 py-2 max-w-[85%]"
                  style={m.role === 'user'
                    ? { background: 'var(--accent)', color: '#fff', borderBottomRightRadius: 4 }
                    : { background: 'var(--surface2)', color: 'var(--text)', borderBottomLeftRadius: 4, border: '1px solid var(--border)' }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
            <input
              className="inp flex-1 text-xs"
              placeholder="Ask anything…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
            />
            <button onClick={send} className="btn btn-sm px-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
