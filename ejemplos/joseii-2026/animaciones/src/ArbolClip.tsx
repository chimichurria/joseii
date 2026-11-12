import {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {crearArbol, dibujarEscena, type Modo} from './arbol';

export const ArbolClip: React.FC<{modo: Modo; semilla?: number}> = ({modo, semilla = 37}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useMemo(() => crearArbol(semilla), [semilla]);

  useLayoutEffect(() => {
    const ctx = lienzo.current?.getContext('2d');
    if (ctx) dibujarEscena(ctx, escena, modo, frame / fps);
  }, [frame, fps, escena, modo]);

  return (
    <AbsoluteFill style={{background: '#fff'}}>
      <canvas ref={lienzo} width={width} height={height} style={{width: '100%', height: '100%'}} />
    </AbsoluteFill>
  );
};
