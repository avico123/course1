import { useState } from 'react';
import { renderDelta } from '../deltaRenderer.jsx';

function extractText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val?.ops) return val.ops.map(o => (typeof o.insert === 'string' ? o.insert : '')).join('');
  return String(val);
}

function isRTL(str = '') {
  return /[֐-׿؀-ۿ]/.test(str);
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

  const cardHeight = section.cardHeight || 400;
  const cardWidth  = section.cardWidth  || 100; // percent

  const frontImg = front.backgroundMedia?.url || imgUrl(front.backgroundMedia?.originalImageUrl, folderId);
  const backImg  = back.backgroundMedia?.url  || imgUrl(back.backgroundMedia?.originalImageUrl, folderId);

  const frontText = extractText(front.text);
  const backText  = extractText(back.text);
  const frontRTL  = isRTL(frontText);
  const backRTL   = isRTL(backText);

  const faceStyle = (bg, img, rtl) => ({
    position: 'absolute', inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 12,
    overflow: 'hidden',
    background: img ? `url(${img}) center/cover no-repeat` : bg,
    display: 'flex', flexDirection: 'column',
    alignItems: rtl ? 'center' : 'flex-start',
    justifyContent: img ? 'flex-end' : 'center',
    boxSizing: 'border-box',
  });

  const textStyle = (hasImg, rtl) => ({
    fontSize: 18, color: '#e2e8f0',
    textAlign: rtl ? 'center' : 'left',
    direction: rtl ? 'rtl' : 'ltr',
    unicodeBidi: 'embed',
    whiteSpace: 'pre-wrap',
    padding: '12px 24px',
    width: '100%',
    ...(hasImg ? {
      background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
      paddingTop: 32,
    } : {}),
  });

  return (
    <div
      onClick={() => setFlipped(f => !f)}
      style={{ perspective: 1000, cursor: 'pointer', margin: '16px auto', userSelect: 'none', width: `${cardWidth}%` }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        height: cardHeight,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.6s',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* Front */}
        <div style={faceStyle('#1a2235', frontImg, frontRTL)}>
          <div style={textStyle(!!frontImg, frontRTL)}>{frontText}</div>
          <div style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>לחץ להפיכה ↩</div>
        </div>

        {/* Back */}
        <div style={{ ...faceStyle('#0f2035', backImg, backRTL), transform: 'rotateY(180deg)' }}>
          <div style={textStyle(!!backImg, backRTL)}>{backText}</div>
          <div style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>לחץ להפיכה ↩</div>
        </div>
      </div>
    </div>
  );
}
