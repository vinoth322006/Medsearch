import { useState, useRef } from 'react';
import { X, Copy, Download } from 'lucide-react';
import type { SearchResultItem } from '../../api';
import { useToast } from '../../context/ToastContext';

interface CiteDialogProps {
  result: SearchResultItem;
  index: number;
  onClose: () => void;
}

const CITE_FORMATS = [
  { value: 'nlm', label: 'NLM' },
  { value: 'ama', label: 'AMA' },
  { value: 'apa', label: 'APA' },
  { value: 'vancouver', label: 'Vancouver' },
  { value: 'mla', label: 'MLA' },
] as const;

function formatCitation(result: SearchResultItem, format: string): string {
  const meta = result.meta;
  if (!meta) return result.text;

  const authors = meta.authors?.join(', ') ?? '';
  const title = meta.title ?? '';
  const journal = meta.journal ?? '';
  const pubDate = meta.pubDate ?? '';
  const pmid = result.pmid ?? '';
  const pmcid = result.pmcid ?? '';

  switch (format) {
    case 'ama':
      return `${authors}. ${title}. ${journal}. ${pubDate}.${pmid ? ` PMID: ${pmid}` : ''}${pmcid ? `; PMCID: ${pmcid}` : ''}.`;
    case 'apa':
      return `${authors} (${pubDate}). ${title}. ${journal}.${pmid ? ` PMID: ${pmid}` : ''}`;
    case 'vancouver':
      return `${authors}. ${title}. ${journal}. ${pubDate}.${pmid ? ` PMID: ${pmid}` : ''}.`;
    case 'mla':
      return `${authors}. "${title}." ${journal}, ${pubDate}.${pmid ? ` PMID: ${pmid}` : ''}.`;
    case 'nlm':
    default:
      return `${authors}. ${title}. ${journal}. ${pubDate}.${pmid ? ` PMID: ${pmid}` : ''}${pmcid ? `; PMCID: ${pmcid}` : ''}.`;
  }
}

export function CiteDialog({ result, onClose }: CiteDialogProps) {
  const { notify } = useToast();
  const [format, setFormat] = useState('nlm');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const citation = formatCitation(result, format);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(citation);
      notify('Citation copied to clipboard.', 'success');
    } catch {
      // Fallback: select text
      textareaRef.current?.select();
      document.execCommand('copy');
      notify('Citation copied.', 'success');
    }
  }

  function handleDownload() {
    const blob = new Blob([citation], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citation-${result.pmid ?? 'article'}.nbib`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pm-cite-dialog" role="dialog" aria-label="Cite article">
        <div className="pm-cite-dialog__header">
          <span className="pm-cite-dialog__title">CITE</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close citation dialog">
            <X size={20} />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="pm-cite-dialog__text"
          value={citation}
          readOnly
          rows={6}
        />
        <div className="pm-cite-dialog__actions">
          <button className="pm-cite-dialog__action-btn" onClick={handleCopy}>
            <Copy size={14} /> Copy
          </button>
          <button className="pm-cite-dialog__action-btn" onClick={handleDownload}>
            <Download size={14} /> Download .nbib
          </button>
          <label className="pm-cite-dialog__format">
            Format:
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {CITE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
