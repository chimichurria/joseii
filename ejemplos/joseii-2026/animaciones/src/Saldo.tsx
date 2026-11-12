import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

const U = 2.4; // Medidas pensadas sobre el escenario de 1600 x 900.
const px = (n: number) => n * U;
const MONO = 'Menlo, Consolas, monospace';
const miles = (n: number) => Math.round(n).toLocaleString('es-AR');
const dos = (n: number) => String(n).padStart(2, '0');

export const Saldo: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrada = spring({frame: f, fps, config: {damping: 200}, durationInFrames: 24});
  const dia = interpolate(f, [24, 180], [6 / 24, 86399 / 86400], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.45, 0, 0.8, 0.7)});
  const medianoche = f >= 190;
  const pierde = interpolate(f, [190, 224], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.5, 0, 0.2, 1)});
  const deposito = spring({frame: f - 248, fps, config: {damping: 16, mass: 0.8}, durationInFrames: 36});
  const saldo = 86400 * (1 - pierde) + 86400 * (f >= 248 ? deposito : 0);
  const seg = medianoche ? (f >= 248 ? 21600 : 0) : Math.floor(dia * 86400);
  const hora = `${dos(Math.floor(seg / 3600))}:${dos(Math.floor((seg % 3600) / 60))}:${dos(seg % 60)}`;
  const llena = medianoche ? (f >= 248 ? 0.25 * deposito : 1 - pierde) : dia;
  const rojo = pierde > 0 && f < 262;
  const R = 150;
  const largo = 2 * Math.PI * R;

  return (
    <AbsoluteFill style={{background: '#fff', color: '#1B1F21', fontFamily: 'Arial, Helvetica, sans-serif'}}>
      <div style={{position: 'absolute', left: px(80), top: px(250), width: px(1000), opacity: entrada, transform: `translateY(${(1 - entrada) * px(24)}px)`}}>
        <div style={{fontFamily: MONO, fontWeight: 700, fontSize: px(24), letterSpacing: '.16em', color: '#485458'}}>SALDO DE HOY</div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: px(26), marginTop: px(18), lineHeight: 1}}>
          <span style={{fontSize: px(58), fontWeight: 700, color: '#666'}}>USD</span>
          <span style={{fontSize: px(176), fontWeight: 700, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', color: rojo ? '#FF3300' : '#1B1F21'}}>{miles(saldo)}</span>
        </div>
        <div style={{marginTop: px(46), height: px(16), borderRadius: px(8), background: 'rgba(72,84,88,.12)', overflow: 'hidden'}}>
          <div style={{height: '100%', width: `${llena * 100}%`, borderRadius: px(8), background: 'linear-gradient(90deg,#FF3300,#FF9900)'}} />
        </div>
        <div style={{marginTop: px(20), fontSize: px(30), color: '#666', height: px(40)}}>
          {f < 190 ? 'Lo que no usaste, a medianoche desaparece.' : f < 248 ? 'Se perdió. No se ahorra ni pasa para mañana.' : 'Nuevo día, nuevo depósito.'}
        </div>
      </div>
      <div style={{position: 'absolute', left: px(1132), top: px(236), width: px(360), height: px(360), opacity: entrada}}>
        <svg viewBox="0 0 360 360" style={{width: '100%', height: '100%'}}>
          <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#FF3300" /><stop offset="1" stopColor="#FF9900" /></linearGradient></defs>
          <circle cx="180" cy="180" r={R} fill="none" stroke="rgba(72,84,88,.12)" strokeWidth="18" />
          <circle cx="180" cy="180" r={R} fill="none" stroke="url(#g)" strokeWidth="18" strokeLinecap="round" strokeDasharray={largo} strokeDashoffset={largo * (1 - llena)} transform="rotate(-90 180 180)" />
        </svg>
        <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{fontFamily: MONO, fontWeight: 700, fontSize: px(46), fontVariantNumeric: 'tabular-nums'}}>{hora}</div>
          <div style={{fontSize: px(22), color: '#666', marginTop: px(6)}}>{f >= 190 && f < 248 ? 'medianoche' : 'hora del día'}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
