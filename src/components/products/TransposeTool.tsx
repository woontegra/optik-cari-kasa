import { useState } from 'react';
import { transposeOptic } from '@/utils/transpose';
import { ipc } from '@/services/ipc';

interface TransposeToolProps {
  initial?: { sph?: string; cyl?: string; axis?: string };
  onApply?: (result: { sph: string; cyl: string; axis: string }) => void;
  compact?: boolean;
}

export default function TransposeTool({ initial, onApply, compact }: TransposeToolProps) {
  const [sph, setSph] = useState(initial?.sph || '');
  const [cyl, setCyl] = useState(initial?.cyl || '');
  const [axis, setAxis] = useState(initial?.axis || '');
  const [result, setResult] = useState<{ sph: string; cyl: string; axis: string } | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    const r = transposeOptic({ sph, cyl, axis });
    if (!r) {
      setError('SPH, CYL ve AXIS değerlerini girin. CYL sıfır olamaz.');
      setResult(null);
      return;
    }
    setResult(r);
    try {
      await ipc.opticalLookups.logTranspose({ sph, cyl, axis, result: r });
    } catch {
      /* audit optional */
    }
  };

  return (
    <div className={compact ? 'transpose-tool compact' : 'transpose-tool'} style={{ border: '1px solid var(--border-color)', padding: 8, borderRadius: 3, marginTop: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Transpoze Yardımcısı</div>
      <div className="form-row" style={{ marginBottom: 6 }}>
        <div className="form-group"><label>SPH</label><input className="form-input" value={sph} onChange={(e) => setSph(e.target.value)} /></div>
        <div className="form-group"><label>CYL</label><input className="form-input" value={cyl} onChange={(e) => setCyl(e.target.value)} /></div>
        <div className="form-group"><label>AXIS</label><input className="form-input" value={axis} onChange={(e) => setAxis(e.target.value)} /></div>
      </div>
      <button type="button" className="btn btn-sm" onClick={run}>Transpoze Et</button>
      {error && <div className="alert alert-error" style={{ marginTop: 6, fontSize: 11 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <div>SPH: <strong>{result.sph}</strong> | CYL: <strong>{result.cyl}</strong> | AXIS: <strong>{result.axis}</strong></div>
          {onApply && (
            <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => onApply(result)}>
              Forma Aktar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
