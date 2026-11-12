import {Composition} from 'remotion';
import {ArbolClip} from './ArbolClip';
import {Saldo} from './Saldo';

const FPS = 30;

export const Raiz: React.FC = () => (
  <>
    <Composition id="arbol-crece" component={ArbolClip} defaultProps={{modo: 'crece' as const}} durationInFrames={18 * FPS} fps={FPS} width={2160} height={2160} />
    <Composition id="arbol-viento" component={ArbolClip} defaultProps={{modo: 'viento' as const}} durationInFrames={12 * FPS} fps={FPS} width={2160} height={2160} />
    <Composition id="arbol-respira" component={ArbolClip} defaultProps={{modo: 'respira' as const}} durationInFrames={10 * FPS} fps={FPS} width={2160} height={2160} />
    <Composition id="arbol-final" component={ArbolClip} defaultProps={{modo: 'final' as const}} durationInFrames={10 * FPS} fps={FPS} width={2160} height={2160} />
    <Composition id="saldo-86400" component={Saldo} durationInFrames={10 * FPS} fps={FPS} width={3840} height={2160} />
  </>
);
