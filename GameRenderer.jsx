import StoryPattern from "./patterns/StoryPattern";
import GalleryPattern from "./patterns/GalleryPattern";
import BigPicturePattern from "./patterns/BigPicturePattern";
import TestYourselfPattern from "./patterns/TestYourselfPattern";
import MultipleChoicePattern from "./patterns/MultipleChoicePattern";
import GenericPattern from "./patterns/GenericPattern";

function getDir(locale = '') {
  const rtlLocales = ['he', 'ar', 'fa', 'ur'];
  const lang = locale.split('-')[0].toLowerCase();
  return rtlLocales.includes(lang) ? 'rtl' : 'ltr';
}

export default function GameRenderer({ game }) {
  if (!game) return <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>טוען...</div>;

  const pattern = (game.patternId || "").toLowerCase();
  const dir = getDir(game.locale);
  const textAlign = dir === 'rtl' ? 'right' : 'left';

  let content;
  switch (pattern) {
    case "story":
      content = <StoryPattern game={game} />; break;
    case "gallery":
      content = <GalleryPattern game={game} />; break;
    case "bigpicture":
      content = <BigPicturePattern game={game} />; break;
    case "testyourself":
      content = <TestYourselfPattern game={game} />; break;
    case "multiplechoice":
      content = <MultipleChoicePattern game={game} />; break;
    default:
      content = (
        <div>
          <div style={{ background: "#fef9c3", padding: "12px 16px", fontSize: "13px", color: "#854d0e", borderBottom: "1px solid #fde68a" }}>
            ⚠ סוג לא מוכר: <strong>{game.patternId}</strong> — מציג JSON גולמי
          </div>
          <GenericPattern game={game} />
        </div>
      );
  }

  return (
    <div dir={dir} style={{ textAlign }}>
      {content}
    </div>
  );
}
