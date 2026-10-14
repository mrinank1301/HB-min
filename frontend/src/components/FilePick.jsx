import React from 'react';
import { Check, Upload } from 'lucide-react';

export default function FilePick({ title, detail, file, onFile, accept }) {
  return <label className="file-pick">
    <input type="file" accept={accept} onChange={e => onFile(e.target.files?.[0] || null)} />
    <span className="file-icon">
      <Upload size={18} />
    </span>
    <b>{title}
    </b>
    <small>{detail}
    </small>
    <span className="file-chosen">{file ? <>
      <Check size={14} />{file.name}
    </> : 'Choose file'}
    </span>
  </label>;
}
