// File checks bound resource use and exclude executable/active web documents.
// They validate formats; they are not an antivirus scanner.
const securityFiles = (() => {
  const imageTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
  const formats = {
    png: ['image/png', 'png'], jpg: ['image/jpeg', 'jpeg'], jpeg: ['image/jpeg', 'jpeg'],
    gif: ['image/gif', 'gif'], webp: ['image/webp', 'webp'],
    pdf: ['application/pdf', 'pdf'], txt: ['text/plain', 'text'], csv: ['text/csv', 'text'],
    xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'zip'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'zip'],
    pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'zip'],
    hwpx: ['application/vnd.hancom.hwpx', 'zip'], hwp: ['application/x-hwp', 'ole'],
  };
  const allowedMime = new Set([...Object.values(formats).map(item => item[0]), 'application/octet-stream', 'application/haansofthwp', 'application/hwp', 'application/zip']);
  const maxBytes = 1024 * 1024;
  const hasPrefix = (bytes, values) => values.every((value, i) => bytes[i] === value);
  const ascii = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length));

  function matches(bytes, kind) {
    if (kind === 'png') return hasPrefix(bytes, [137,80,78,71,13,10,26,10]);
    if (kind === 'jpeg') return hasPrefix(bytes, [255,216,255]);
    if (kind === 'gif') return ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6));
    if (kind === 'webp') return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP';
    if (kind === 'pdf') return ascii(bytes, 0, 5) === '%PDF-';
    if (kind === 'zip') return hasPrefix(bytes, [80,75,3,4]);
    if (kind === 'ole') return hasPrefix(bytes, [208,207,17,224,161,177,26,225]);
    return kind === 'text' && !bytes.includes(0);
  }

  function decodeDataUrl(value, limit = maxBytes) {
    if (typeof value !== 'string' || value.length > Math.ceil(limit / 3) * 4 + 180) return null;
    const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([a-z0-9+/]*={0,2})$/i.exec(value);
    if (!match || match[2].length % 4 !== 0 || !allowedMime.has(match[1].toLowerCase())) return null;
    try {
      const raw = atob(match[2]);
      if (!raw.length || raw.length > limit) return null;
      return { type: match[1].toLowerCase(), bytes: Uint8Array.from(raw, char => char.charCodeAt(0)) };
    } catch (_) { return null; }
  }

  function attachment(file) {
    if (!file || typeof file.name !== 'string' || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069/\\]/.test(file.name)) return null;
    const ext = file.name.split('.').pop().toLowerCase();
    const format = Object.hasOwn(formats, ext) ? formats[ext] : null;
    const decoded = decodeDataUrl(file.dataUrl);
    if (!format || !decoded || !matches(decoded.bytes, format[1])) return null;
    if (imageTypes.has(decoded.type) && decoded.type !== format[0]) return null;
    return { name: file.name.slice(0, 160), type: format[0], size: decoded.bytes.length,
      dataUrl: file.dataUrl, addedAt: typeof file.addedAt === 'string' ? file.addedAt : new Date().toISOString() };
  }

  function imageUrl(value) {
    const decoded = decodeDataUrl(value);
    if (!decoded || !imageTypes.has(decoded.type)) return '';
    const kind = decoded.type.slice(6);
    return matches(decoded.bytes, kind) ? value : '';
  }

  function download(file) {
    const clean = attachment(file);
    if (!clean) return false;
    const decoded = decodeDataUrl(clean.dataUrl);
    const url = URL.createObjectURL(new Blob([decoded.bytes], { type: 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = clean.name;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  function csvCell(value) {
    const text = String(value ?? '');
    const protectedText = /^[\s\u0000-\u001f]*[=+@-]/.test(text) && typeof value !== 'number' ? "'" + text : text;
    return '"' + protectedText.replace(/"/g, '""') + '"';
  }

  function parseBackup(text) {
    if (typeof text !== 'string' || text.length > 5 * 1024 * 1024) throw new Error('Backup is too large');
    let nodes = 0;
    const data = JSON.parse(text, (key, value) => {
      if (++nodes > 150000) throw new Error('Backup has too many values');
      if (['__proto__', 'prototype', 'constructor'].includes(key)) return undefined;
      return value;
    });
    if (!data || !Array.isArray(data.projects) || !Array.isArray(data.tasks) || data.projects.length > 2000 || data.tasks.length > 10000) throw new Error('Invalid backup schema');
    if (![...data.projects, ...data.tasks].every(item => item && typeof item === 'object' && !Array.isArray(item))) throw new Error('Invalid backup record');
    return data;
  }

  return Object.freeze({ attachment, imageUrl, download, csvCell, parseBackup, decodeDataUrl });
})();
