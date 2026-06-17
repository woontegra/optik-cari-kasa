import { useState } from 'react';
import { ipc } from '@/services/ipc';
import type { CommunicationChannel, PreparedMessage } from '@/types/customerTracking';

interface CommunicationPrepModalProps {
  customerId: number;
  channel: CommunicationChannel;
  defaultTemplateName?: string;
  appointmentId?: number;
  onClose: () => void;
  onLogged?: () => void;
}

export default function CommunicationPrepModal({
  customerId,
  channel,
  defaultTemplateName,
  appointmentId,
  onClose,
  onLogged,
}: CommunicationPrepModalProps) {
  const [prepared, setPrepared] = useState<PreparedMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const prepare = async (templateName?: string) => {
    setLoading(true);
    setError('');
    try {
      const templates = await ipc.communications.listTemplates();
      const tpl = templates.find(
        (t) => t.channel === channel && t.is_active && (!templateName || t.name === templateName)
      );
      const result = await ipc.communications.prepareMessage({
        customer_id: customerId,
        channel,
        template_id: tpl?.id,
        appointment_id: appointmentId,
      });
      setPrepared(result);
      await ipc.communications.log({
        customer_id: customerId,
        channel,
        template_id: tpl?.id,
        subject: result.subject,
        message: result.body,
        status: 'Hazırlandı',
      });
      onLogged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyText = async () => {
    if (!prepared) return;
    await navigator.clipboard.writeText(prepared.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const markSent = async () => {
    if (!prepared) return;
    await ipc.communications.log({
      customer_id: customerId,
      channel,
      subject: prepared.subject,
      message: prepared.body,
      status: 'Gönderildi İşaretlendi',
    });
    onLogged?.();
    onClose();
  };

  const channelLabel = channel === 'WHATSAPP' ? 'WhatsApp' : channel === 'SMS' ? 'SMS' : 'E-posta';

  return (
    <div className="product-form-overlay" style={{ zIndex: 1100 }}>
      <div className="product-form-panel" style={{ width: 520 }}>
        <div className="product-form-header">
          <span>{channelLabel} Mesajı Hazırla</span>
          <button type="button" className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="product-form-body">
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 10 }}>
            Mesajlar manuel gönderim için hazırlanır. Gerçek SMS/e-posta API entegrasyonu bu sürümde yoktur.
          </p>
          {error && <div className="alert alert-error">{error}</div>}
          {!prepared ? (
            <button type="button" className="btn btn-primary" onClick={() => prepare(defaultTemplateName)} disabled={loading}>
              {loading ? 'Hazırlanıyor...' : 'Mesaj Hazırla'}
            </button>
          ) : (
            <>
              {prepared.subject && (
                <div className="form-group">
                  <label>Konu</label>
                  <input className="form-input" value={prepared.subject} readOnly />
                </div>
              )}
              <div className="form-group">
                <label>Mesaj</label>
                <textarea className="form-textarea" value={prepared.body} readOnly rows={6} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={copyText}>{copied ? 'Kopyalandı' : 'Panoya Kopyala'}</button>
                {channel === 'WHATSAPP' && prepared.whatsappUrl && (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => window.open(prepared.whatsappUrl, '_blank')}>
                    WhatsApp Aç
                  </button>
                )}
                {channel === 'EMAIL' && (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => { window.location.href = prepared.mailtoUrl; }}>
                    E-posta Aç
                  </button>
                )}
                <button type="button" className="btn btn-sm" onClick={markSent}>Gönderildi İşaretle</button>
              </div>
            </>
          )}
        </div>
        <div className="product-form-footer">
          <button type="button" className="btn" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
