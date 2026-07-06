import React from 'react'
import { renderDelta } from '../deltaRenderer.jsx'
import TriviaSection from './TriviaSection.jsx'
import FlipCardSection from './FlipCardSection.jsx'
import ConvoSection from './ConvoSection.jsx'
import QuoteSection from './QuoteSection.jsx'
import VideoCreatorSection from './VideoCreatorSection.jsx'

const styles = {
  page: { maxWidth: 760, margin: '0 auto', padding: '0 20px 60px', overflowX: 'hidden' },
  cover: { width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' },
  header: { background: 'white', padding: '24px 0 16px', borderBottom: '1px solid #eee', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', lineHeight: 1.4, color: '#1a1a1a' },
  description: { fontSize: 16, color: '#555', marginTop: 8 },
  section: { marginBottom: 28 },
  paragraph: { fontSize: 18, lineHeight: 1.8, color: '#222', background: 'white', padding: '20px 24px', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  image: { width: '100%', borderRadius: 8, display: 'block' },
  caption: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  credits: { fontSize: 12, color: '#aaa', textAlign: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
}

// Detect if a string is primarily RTL (Hebrew/Arabic)
function textDir(str = '') {
  return /[֐-׿؀-ۿ]/.test(str) ? 'rtl' : 'ltr';
}

function imgUrl(filePath, folderId) {
  if (!filePath) return null
  const filename = filePath.replace(/^files\//, '')
  return `/game-files/${folderId}/${filename}`
}

function ParagraphSection({ section }) {
  const titleText = section.title?.ops?.map(o => o.insert).join('').trim()
  const bodyText  = section.text?.ops?.map(o => o.insert).join('') || ''
  return (
    <div style={styles.section}>
      {titleText && <div style={{ ...styles.sectionTitle, direction: textDir(titleText), textAlign: textDir(titleText) === 'rtl' ? 'right' : 'left' }}>{titleText}</div>}
      <div style={{ ...styles.paragraph, direction: textDir(bodyText), textAlign: textDir(bodyText) === 'rtl' ? 'right' : 'left' }}>{typeof section.text === 'string' ? section.text : renderDelta(section.text)}</div>
    </div>
  )
}

function MediaSection({ section, folderId }) {
  const media = section.media || {}
  const mt = media.mediaType
  const titleText = section.title?.ops?.map(o => o.insert).join('').replace(/\n/g, '').trim()
  const caption = section.caption || section.description?.ops?.map(o => o.insert).join('').trim()

  let content = null

  if (mt === 'youtube' || media.videoId) {
    const videoId = media.videoId
    const start = media.videoStart || 0
    if (!videoId) return null
    // Numeric-only IDs are legacy Brightcove IDs — not YouTube, cannot embed
    if (/^\d{8,}$/.test(videoId)) {
      content = (
        <div style={{ background: '#1a1a2e', borderRadius: 8, padding: '32px 24px', textAlign: 'center', color: '#9ca3af', direction: 'rtl' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#e5e7eb', marginBottom: 8 }}>הסרטון אינו זמין</div>
          <div style={{ fontSize: 13 }}>הסרטון המקורי לא הועלה ל-YouTube ואינו ניתן להצגה במערכת זו.</div>
        </div>
      )
    } else {
      content = (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8 }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?start=${start}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      )
    }
  } else if (mt === 'video') {
    const url = media.originalVideoUrl || media.url
    if (!url) return null
    content = <video src={url} controls style={{ width: '100%', borderRadius: 8, display: 'block' }} />
  } else if (mt === 'iframe') {
    const url = media.url
    if (!url) return null
    content = <iframe src={url} width="100%" height={media.height || 400} style={{ border: 'none', borderRadius: 8, display: 'block' }} />
  } else {
    const url = media.url || media.originalImageUrl
    if (!url) return null
    content = (
      <img
        src={imgUrl(url, folderId)}
        alt={media.alt || caption || ''}
        style={styles.image}
        onError={e => { e.target.style.display = 'none' }}
      />
    )
  }

  return (
    <div style={styles.section}>
      {titleText && <div style={{ ...styles.sectionTitle, direction: textDir(titleText), textAlign: textDir(titleText) === 'rtl' ? 'right' : 'left' }}>{titleText}</div>}
      {content}
      {caption && <div style={styles.caption}>{caption}</div>}
      {media.credits && <div style={styles.credits}>© {media.credits}</div>}
    </div>
  )
}

function renderSection(section, folderId) {
  switch (section.type) {
    case 'paragraphSection': return <ParagraphSection key={section.id} section={section} />
    case 'imageSection':
    case 'mediaSection':     return <MediaSection key={section.id} section={section} folderId={folderId} />
    case 'triviaSection':    return <TriviaSection key={section.id} section={section} folderId={folderId} />
    case 'flipCardSection':  return <FlipCardSection key={section.id} section={section} folderId={folderId} />
    case 'convoSection':     return <ConvoSection key={section.id} section={section} folderId={folderId} />
    case 'quoteSection':     return <QuoteSection key={section.id} section={section} />
    case 'videoCreatorSection': return <VideoCreatorSection key={section.id} section={section} folderId={folderId} />
    default:
      return (
        <div key={section.id} style={{ background: '#fff8e1', border: '1px dashed #f9a825', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          <strong>סוג לא מוכר:</strong> {section.type}
          <pre style={{ marginTop: 8, fontSize: 11, overflow: 'auto' }}>{JSON.stringify(section, null, 2)}</pre>
        </div>
      )
  }
}

export default function StoryPattern({ game }) {
  const folderId = game._folderId
  const cover = game.cover?.url
  const showHeadImage = game._meta?.showHeadImage === true

  // showGameTitle: if explicitly set in meta, use it.
  // Otherwise auto-hide when title is Hebrew but game locale is LTR (Spanish/English).
  const titleIsHebrew = /[֐-׿]/.test(game.title || '')
  const gameIsRTL     = /^(he|ar)/.test((game.locale || '').toLowerCase())
  const showGameTitle = game._meta?.showGameTitle !== undefined
    ? game._meta.showGameTitle === true
    : !(titleIsHebrew && !gameIsRTL)

  return (
    <div>
      {cover && showHeadImage && (
        <img
          src={imgUrl(cover, folderId)}
          alt={game.title}
          style={styles.cover}
          onError={e => { e.target.style.display = 'none' }}
        />
      )}
      <div style={styles.page}>
        {showGameTitle && (
          <div style={{ ...styles.header, direction: textDir(game.title), textAlign: textDir(game.title) === 'rtl' ? 'right' : 'left' }}>
            <div style={styles.title}>{game.title}</div>
            {game.description && <div style={{ ...styles.description, direction: textDir(game.description), textAlign: textDir(game.description) === 'rtl' ? 'right' : 'left' }}>{game.description}</div>}
          </div>
        )}
        {game.sections?.map((slide, i) =>
          Array.isArray(slide)
            ? slide.map(section => renderSection(section, folderId))
            : renderSection(slide, folderId)
        )}
      </div>
    </div>
  )
}
