import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

export default function useRealtimeClocks() {
  const { clocks, turn, status } = useSelector((s) => s.game);
  const syncRef = useRef({ base: clocks, turn, ts: Date.now(), status });
  const [tick, setTick] = useState(0);

  // whenever redux clocks/turn/status change, reset base
  useEffect(() => {
    syncRef.current = { base: clocks, turn, ts: Date.now(), status };
  }, [clocks, turn, status]);

  useEffect(() => {
    let raf;
    const loop = () => {
      setTick(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // derive on every render
  const display = useMemo(() => {
    void tick; // force derive
    const { base, turn: t, ts, status: st } = syncRef.current;
    const elapsed = Math.max(0, Date.now() - ts);
    const w = st === 'active' && t === 'w' ? Math.max(0, base.w - elapsed) : base.w;
    const b = st === 'active' && t === 'b' ? Math.max(0, base.b - elapsed) : base.b;
    return { w, b };
  }, [tick]);

  return display;
}
