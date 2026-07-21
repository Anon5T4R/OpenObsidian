import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVaultStore, NoteFile } from '../../store/vaultStore'
import { extractCards } from '../../utils/cards'
import { useT } from '../../i18n'
import type { SrsCard, SrsGrade } from '../../../../preload/index'
import './ReviewPanel.css'

interface ReviewPanelProps {
  /** Restricts the session to a deck: a tag, a folder, or the open note */
  deck: ReviewDeck
  onFileSelect: (file: NoteFile) => void
  onClose: () => void
}

export type ReviewDeck =
  | { kind: 'all' }
  | { kind: 'tag'; tag: string }
  | { kind: 'note'; path: string }

interface DueCard { id: string; card: SrsCard }

const GRADES: { g: SrsGrade; key: string; cls: string }[] = [
  { g: 'again', key: 'reviewAgain', cls: 'again' },
  { g: 'hard',  key: 'reviewHard',  cls: 'hard' },
  { g: 'good',  key: 'reviewGood',  cls: 'good' },
  { g: 'easy',  key: 'reviewEasy',  cls: 'easy' },
]

export default function ReviewPanel({ deck, onFileSelect, onClose }: ReviewPanelProps) {
  const files     = useVaultStore((s) => s.files)
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const tags      = useVaultStore((s) => s.tags)
  const t = useT()

  const [queue,    setQueue]    = useState<DueCard[]>([])
  const [revealed, setRevealed] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [done,     setDone]     = useState(0)
  // Cards answered in this session, so they can be replayed without touching
  // the schedule — practice is not the same thing as reviewing
  const [seen,     setSeen]     = useState<string[]>([])
  const [practice, setPractice] = useState(false)
  const busy = useRef(false)

  // Which notes this deck covers. Cards are keyed by relative path, so this
  // list has to be relative too.
  const deckFiles = useMemo(() => {
    if (deck.kind === 'note') return [deck.path]
    if (deck.kind === 'tag') {
      const names = new Set((tags[deck.tag] ?? []).map((n) => n.toLowerCase()))
      return files.filter((f) => names.has(f.name.toLowerCase())).map((f) => f.relativePath)
    }
    return undefined // everything
  }, [deck, files, tags])

  const load = useCallback(async () => {
    if (!vaultPath) return
    setLoading(true)
    const due = await window.api.srsDue(vaultPath, deckFiles)
    setQueue(due)
    setRevealed(false)
    setLoading(false)
  }, [vaultPath, deckFiles])

  useEffect(() => { load() }, [load])

  const current = queue[0]

  const answer = useCallback(async (g: SrsGrade) => {
    if (!vaultPath || !current || busy.current) return
    busy.current = true
    try {
      // In practice mode nothing is graded: the schedule stays as it was
      if (!practice) await window.api.srsGrade(vaultPath, current.id, g)
      // "again" keeps the card in this session, at the back of the queue
      setQueue((q) => (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)))
      setRevealed(false)
      if (g !== 'again') {
        setDone((d) => d + 1)
        if (!practice) setSeen((s) => (s.includes(current.id) ? s : [...s, current.id]))
      }
    } finally {
      busy.current = false
    }
  }, [vaultPath, current, practice])

  // Replays the cards from this session. Grading them again would punish the
  // schedule for extra study, so this round does not write anything.
  const repeatSession = useCallback(async () => {
    if (!vaultPath || seen.length === 0) return
    const cards = await window.api.srsById(vaultPath, seen)
    setPractice(true)
    setQueue(cards)
    setDone(0)
    setRevealed(false)
  }, [vaultPath, seen])

  // Pulls in what is due over the next week, for whoever wants to keep going
  const reviewAhead = useCallback(async () => {
    if (!vaultPath) return
    setLoading(true)
    const ahead = await window.api.srsDue(vaultPath, deckFiles, 7)
    setPractice(false)
    setQueue(ahead.filter((c) => !seen.includes(c.id)))
    setRevealed(false)
    setLoading(false)
  }, [vaultPath, deckFiles, seen])

  // Parking a card you cannot answer yet beats failing it over and over
  const suspend = useCallback(async () => {
    if (!vaultPath || !current) return
    await window.api.srsSuspend(vaultPath, current.id, true)
    setQueue((q) => q.slice(1))
    setRevealed(false)
  }, [vaultPath, current])

  // Space reveals, 1–4 grade — the whole session is meant to be keyboard-only
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (!current) return
      if (e.code === 'Space') { e.preventDefault(); setRevealed(true); return }
      if (!revealed) return
      const idx = ['1', '2', '3', '4'].indexOf(e.key)
      if (idx !== -1) { e.preventDefault(); answer(GRADES[idx].g) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, revealed, answer, onClose])

  // Cards are keyed by relative path, but tolerate an absolute one: cards
  // scheduled before that was fixed still carry it
  const findNote = useCallback((cardFile: string): NoteFile | undefined => {
    const wanted = cardFile.replace(/\\/g, '/')
    return files.find((f) => f.relativePath.replace(/\\/g, '/') === wanted)
      ?? files.find((f) => f.path.replace(/\\/g, '/') === wanted)
      ?? files.find((f) => f.path.replace(/\\/g, '/').endsWith('/' + wanted))
  }, [files])

  // The answer text comes from the note itself, so an edited answer shows up
  // on the next review without any re-sync
  const [answerText, setAnswerText] = useState('')
  useEffect(() => {
    let cancelled = false
    if (!current) { setAnswerText(''); return }
    const file = findNote(current.card.file)
    // Never echo the question back as the answer — that hides the failure
    if (!file) { setAnswerText(''); return }
    window.api.readFile(file.path).then((content) => {
      if (cancelled) return
      const card = extractCards(file.relativePath, content).find((c) => c.id === current.id)
      setAnswerText(card?.a ?? '')
    }).catch(() => { if (!cancelled) setAnswerText('') })
    return () => { cancelled = true }
  }, [current, findNote])

  const openSource = () => {
    if (!current) return
    const file = findNote(current.card.file)
    if (file) onFileSelect(file)
  }

  return (
    <div className="review-panel">
      <div className="review-header">
        <span className="review-title">🃏 {t('reviewTitle')}</span>
        <span className="review-progress">
          {t('reviewProgress', { left: queue.length, done })}
          {practice && <span className="review-practice-tag">{t('reviewPractice')}</span>}
        </span>
        {current && (
          <button className="review-suspend" onClick={suspend} title={t('reviewSuspendTip')}>
            {t('reviewSuspend')}
          </button>
        )}
        <button className="review-close" onClick={onClose}>{t('searchClose')}</button>
      </div>

      <div className="review-body">
        {loading ? (
          <div className="review-empty">{t('searching')}</div>
        ) : !current ? (
          <div className="review-empty">
            <div className="review-done-icon">✅</div>
            {done > 0 ? t('reviewFinished', { count: done }) : t('reviewNothing')}
            <div className="review-again-row">
              {seen.length > 0 && (
                <button className="review-again-btn" onClick={repeatSession}>
                  🔁 {t('reviewRepeat', { count: seen.length })}
                </button>
              )}
              <button className="review-again-btn" onClick={reviewAhead}>
                ⏩ {t('reviewAhead')}
              </button>
            </div>
            {practice && <div className="review-practice-note">{t('reviewPracticeNote')}</div>}
          </div>
        ) : (
          <>
            <button className="review-source" onClick={openSource} title={t('reviewOpenNote')}>
              📄 {current.card.file}
            </button>

            <div className="review-question">{current.card.q}</div>

            {revealed ? (
              <div className="review-answer">{answerText || t('reviewNoAnswer')}</div>
            ) : (
              <button className="review-reveal" onClick={() => setRevealed(true)}>
                {t('reviewReveal')} <kbd>Espaço</kbd>
              </button>
            )}
          </>
        )}
      </div>

      {current && revealed && (
        <div className="review-grades">
          {GRADES.map(({ g, key, cls }, i) => (
            <button key={g} className={`review-grade ${cls}`} onClick={() => answer(g)}>
              {t(key as 'reviewAgain')}
              <span className="review-grade-key">{i + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
