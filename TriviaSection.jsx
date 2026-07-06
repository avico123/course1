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

// Detect RTL (Hebrew/Arabic)
function isRTL(str = '') {
  return /[֐-׿؀-ۿ]/.test(str)
}

function TriviaQuestion({ question, folderId, bgColor, textColor }) {
  const [selected, setSelected] = useState(null)

  const questionText = extractText(question.text)
  const rtl = isRTL(questionText)
  const answered = selected !== null
  const correct = answered && selected.isCorrect

  return (
    <div style={{ marginBottom: 24, background: bgColor || '#35608d', borderRadius: 10, overflow: 'hidden' }}>
      {question.media?.url && (
        <img
          src={imgUrl(question.media.url, folderId)}
          alt=""
          style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }}
          onError={e => { e.target.style.display = 'none' }}
        />
      )}

      <div style={{
        padding: '16px 20px',
        color: textColor || '#fff',
        fontSize: 18, fontWeight: 'bold', lineHeight: 1.5,
        direction: rtl ? 'rtl' : 'ltr',
        textAlign: rtl ? 'right' : 'left',
        unicodeBidi: 'embed',
      }}>
        {questionText}
      </div>

      <div style={{
        padding: '0 16px 16px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        direction: rtl ? 'rtl' : 'ltr',
      }}>
        {question.answers?.map(answer => {
          const answerText = extractText(answer.text)
          const ansRTL = isRTL(answerText) || rtl
          const isSelected = selected?.id === answer.id

          let bg = 'rgba(255,255,255,0.15)'
          let border = '2px solid rgba(255,255,255,0.3)'
          if (answered) {
            if (answer.isCorrect)               { bg = '#2e7d32'; border = '2px solid #81c784' }
            else if (isSelected)                { bg = '#c62828'; border = '2px solid #ef9a9a' }
          }

          return (
            <button
              key={answer.id}
              onClick={() => !answered && setSelected(answer)}
              style={{
                background: bg, border, borderRadius: 8, padding: '12px 14px',
                color: 'white', fontSize: 15, cursor: answered ? 'default' : 'pointer',
                textAlign: ansRTL ? 'right' : 'left',
                direction: ansRTL ? 'rtl' : 'ltr',
                unicodeBidi: 'embed',
                lineHeight: 1.4, transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
            >
              {answered && answer.isCorrect && <span style={{ marginInlineEnd: 6 }}>✓</span>}
              {answered && isSelected && !answer.isCorrect && <span style={{ marginInlineEnd: 6 }}>✗</span>}
              {answerText}
            </button>
          )
        })}
      </div>

      {answered && (
        <div style={{
          margin: '0 16px 16px', padding: '10px 16px', borderRadius: 8,
          background: correct ? 'rgba(46,125,50,0.3)' : 'rgba(198,40,40,0.3)',
          color: 'white', fontSize: 15, textAlign: 'center', fontWeight: 'bold',
        }}>
          {correct ? '✓ נכון!' : '✗ לא נכון'}
        </div>
      )}
    </div>
  )
}

export default function TriviaSection({ section, folderId }) {
  const bg = section.style?.backgroundColor
  const color = section.style?.color

  return (
    <div style={{ marginBottom: 28 }}>
      {section.questions?.map(q => (
        <TriviaQuestion
          key={q.id}
          question={q}
          folderId={folderId}
          bgColor={bg}
          textColor={color}
        />
      ))}
    </div>
  )
}
