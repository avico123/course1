import ImageBlock from './blocks/ImageBlock';
import VideoBlock from './blocks/VideoBlock';
import YoutubeBlock from './blocks/YoutubeBlock';
import IframeBlock from './blocks/IframeBlock';
import TextBlock from './blocks/TextBlock';
import HeaderBlock from './blocks/HeaderBlock';
import SeparatorBlock from './blocks/SeparatorBlock';
import FlipCardBlock from './blocks/FlipCardBlock';
import MultipleChoiceBlock from './blocks/MultipleChoiceBlock';
import OpenQuestionBlock from './blocks/OpenQuestionBlock';
import ChooseAnswerBlock from './blocks/ChooseAnswerBlock';
import ConnectBlock from './blocks/ConnectBlock';
import DragAnswerBlock from './blocks/DragAnswerBlock';
import { VideoCreatorBlock } from './blocks/VideoCreatorBlock.jsx';

const MAP = {
  'image':           ImageBlock,
  'video':           VideoBlock,
  'youtube':         YoutubeBlock,
  'iframe':          IframeBlock,
  'text':            TextBlock,
  'header':          HeaderBlock,
  'separator':       SeparatorBlock,
  'flip-card':       FlipCardBlock,
  'multiple-choice': MultipleChoiceBlock,
  'open-question':   OpenQuestionBlock,
  'choose-answer':   ChooseAnswerBlock,
  'connect':         ConnectBlock,
  'drag-answer':     DragAnswerBlock,
  'videoCreator':    VideoCreatorBlock,
};

export default function BlockRenderer({ block, isEditing, onChange, gameId, authFetch }) {
  const Component = MAP[block.type];
  if (!Component) {
    return (
      <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>
        סוג לא מוכר: <strong>{block.type}</strong>
      </div>
    );
  }
  return <Component block={block} isEditing={isEditing} onChange={onChange} gameId={gameId} authFetch={authFetch} />;
}
