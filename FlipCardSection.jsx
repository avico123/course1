import { useState } from 'react';
import { renderDelta } from '../deltaRenderer.jsx';

// Extract plain text from a Quill delta or return the string as-is
function extractText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val?.ops) return val.ops.map(o => (typeof o.insert === 'string' ? o.insert : '')).join('');
  return String(val);
}

function imgUrl(filePath, folderId) {
  if (!filePath) return null;
  if (filePath.startsWith('http') || filePath.startsWith('/')) return filePath;
  const filename = filePath.replace(/^files\//, '');
  return folderId ? `/game-files/${folderId}/${filename}` : `/files/${filename}`;
}

export default function FlipCardSection({ section, folderId }) {
  const [flipped, setFlipped] = useState(false);
  const media = section.media || {};
  const front = media.frontMedia || {};
  const back  = media.backMedia  || {};

  const frontImg = front.backgroundMedia?.url || imgUrl(front.backgroundMedia?.originalImageUrl, folderId);
  const backImg  = back.backgroundMedia?.url  || imgUrl(back.backgroundMedia?.originalImageUrl, folderId);

  // Use plain text to avoid bidi punctuation scrambling from delta spans
  const frontText = extractText(front.text);
  const backText  = extractText(back.text);

  return (
    <div
      onClick={() => setFlipped(f => !f)}
      style={{
        perspective: 1000,
        cursor: 'pointer',
        margin: '16px 0',
        userSelect: 'none',
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        minHeight: 200,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.6s',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* Front */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          background: '#1a2235',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, boxSizing: 'border-box', minHeight: 200,
        }}>
          {frontImg && <img src={frontImg} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />}
          <div style={{ fontSize: 18, color: '#e2e8f0', textAlign: 'center', direction: 'rtl', unicodeBidi: 'embed', whiteSpace: 'pre-wrap' }}>{frontText}</div>
          <div style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 11, color: '#475569' }}>לחץ להפיכה ↩</div>
        </div>

        {/* Back */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: '#0f2035',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, boxSizing: 'border-box', minHeight: 200,
        }}>
          {backImg && <img src={backImg} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />}
          <div style={{ fontSize: 18, color: '#e2e8f0', textAlign: 'center', direction: 'rtl' }}>{backText}</div>
          <div style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 11, color: '#475569' }}>לחץ להפיכה ↩</div>
        </div>
      </div>
    </div>
  );
}
