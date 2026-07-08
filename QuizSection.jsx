import React, { useState } from 'react'

function imgUrl(filePath, folderId) {
  if (!filePath) return null
  const filename = filePath.replace(/^files\//, '')
  return `/game-files/${folderId}/${filename}`
}

function extractText(val) {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (val?.ops) return val.ops.map(o => (typeof o.insert === 'string' ? o.insert : '')).join('').replace(/\n$/, '')
  return String(val)
}

function textDir(str = '') {
  const rtl = (str.match(/[֐-׿؀-ۿ]/g) || []).length
  const ltr = (str.match(/[A-Za-zÀ-ɏ]/g) || []).length
  if (rtl === 0 && ltr === 0) return 'rtl'
  return rtl >= ltr ? 'rtl' : 'ltr'
}

// In quizSection, correct answer has the highest results[].value (typically 2 vs 0)
function isCorrect(answer) {
  const vals = (answer.results || []).map(r => r.value || 0)
  return vals.some(v => v > 0)
}

function QuizQuestion({ question, folderId, bgColor, textColor, index, total, onAnswer }) {
  const [selected, setSelected] = useState(null)

  const questionText = extractText(question.text)
  const dir = textDir(questionText)
  const answered = selected !== null
  const correct = answered && isCorrect(selected)

  const handleSelect = (answer) => {
    if (answered) return
    setSelected(answer)
    onAnswer(isCorrect(answer))
  }

  return (
    <div style={{ marginBottom: 24, background: bgColor || '#1a3a5c', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>
      {/* Progress */}
      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${((index + 1) / total) * 100}%`, background: '#60a5fa', height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, flexShrink: 0 }}>{index + 1} / {total}</span>
      </div>

      {/* Image */}
      {question.media?.url && (
        <img
          src={imgUrl(question.media.url, folderId)}
          alt=""
          style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }}
          onError={e => { e.target.style.display = 'none' }}
        />
      )}

      {/* Question text */}
      <div style={{
        padding: '16px 20px 12px',
        color: textColor || '#fff',
        fontSize: 17, fontWeight: 'bold', lineHeight: 1.6,
        direction: dir, textAlign: dir === 'rtl' ? 'right' : 'left',
      }}>
        {questionText}
      </div>

      {/* Answers */}
      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {question.answers?.map(answer => {
          const ansText = extractText(answer.text)
          const ansDir = textDir(ansText)
          const isSelected = selected?.id === answer.id
          const ansIsCorrect = isCorrect(answer)

          let bg = 'rgba(255,255,255,0.12)'
          let border = '2px solid rgba(255,255,255,0.2)'
          if (answered) {
            if (ansIsCorrect)              { bg = '#166534'; border = '2px solid #4ade80' }
            else if (isSelected)           { bg = '#991b1b'; border = '2px solid #f87171' }
          }

          return (
            <button
              key={answer.id}
              onClick={() => handleSelect(answer)}
              style={{
                background: bg, border, borderRadius: 8, padding: '11px 14px',
                color: 'white', fontSize: 15, cursor: answered ? 'default' : 'pointer',
                textAlign: ansDir === 'rtl' ? 'right' : 'left', direction: ansDir,
                lineHeight: 1.4, transition: 'all 0.2s', fontFamily: 'inherit',
              }}
            >
              {answered && ansIsCorrect && <span style={{ marginInlineEnd: 6 }}>✓</span>}
              {answered && isSelected && !ansIsCorrect && <span style={{ marginInlineEnd: 6 }}>✗</span>}
              {ansText}
            </button>
          )
        })}
      </div>

      {answered && (
        <div style={{
          margin: '0 16px 16px', padding: '10px 16px', borderRadius: 8,
          background: correct ? 'rgba(22,101,52,0.5)' : 'rgba(153,27,27,0.5)',
          color: 'white', fontSize: 15, textAlign: 'center', fontWeight: 'bold',
        }}>
          {correct ? '✓ נכון!' : '✗ לא נכון'}
        </div>
      )}
    </div>
  )
}

export default function QuizSection({ section, folderId }) {
  const questions = section.questions || []
  const bg    = section.style?.backgroundColor
  const color = section.style?.color
  const [scores, setScores] = useState([])

  const handleAnswer = (correct) => {
    setScores(prev => [...prev, correct])
  }

  const allAnswered = scores.length === questions.length
  const totalCorrect = scores.filter(Boolean).length

  return (
    <div style={{ marginBottom: 28 }}>
      {questions.map((q, i) => (
        <QuizQuestion
          key={q.id}
          question={q}
          folderId={folderId}
          bgColor={bg}
          textColor={color}
          index={i}
          total={questions.length}
          onAnswer={handleAnswer}
        />
      ))}

      {allAnswered && (
        <div style={{
          background: totalCorrect === questions.length ? '#14532d' : '#1e3a5f',
          borderRadius: 12, padding: '20px 24px', textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>
            {totalCorrect === questions.length ? '🏆' : totalCorrect >= questions.length / 2 ? '👍' : '📚'}
          </div>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>
            {totalCorrect} / {questions.length}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
            {totalCorrect === questions.length ? 'מושלם! כל התשובות נכונות' : `${questions.length - totalCorrect} שגיאות`}
          </div>
        </div>
      )}
    </div>
  )
}
