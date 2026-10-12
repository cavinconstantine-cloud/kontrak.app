/* Adapter data untuk versi server (Node). Antarmuka yang sama dipakai versi web (web/api-artifact.js). */
'use strict';
window.API = (() => {
  async function call(path, body, method) {
    const r = await fetch(path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Gagal'); e.status = r.status; throw e; }
    return j;
  }
  // foto dikirim sebagai data URL (dikecilkan dulu di browser)
  function shrink(file, max = 1024) { return new Promise((res, rej) => { const im = new Image(); const url = window.URL.createObjectURL(file); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); window.URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.72)); }; im.onerror = rej; im.src = url; }); }
  return {
    kind: 'server',
    async init() {},
    async me() { try { return (await call('/api/me')).user; } catch (e) { return null; } },
    login: (role, password) => call('/api/login', { role, password }).then((j) => j.user),
    logout: () => call('/api/logout', {}),
    state: () => call('/api/state'),
    password: (o, n) => call('/api/password', { old: o, new: n }),
    async absen(b) { const photo = await shrink(b.file, 800); return call('/api/absen', { projectId: b.projectId, type: b.type, lat: b.lat, lng: b.lng, workers: b.workers, photo }); },
    async report(b) { const photos = []; for (const f of b.files.slice(0, 8)) photos.push(await shrink(f)); return call('/api/report', { projectId: b.projectId, items: b.items, note: b.note, photos }); },
    async nota(b) { const photo = await shrink(b.file); return call('/api/nota', { projectId: b.projectId, type: b.type, desc: b.desc, shop: b.shop, amount: b.amount, qty: b.qty, unitKey: b.unitKey, rm: b.rm, photo }); },
    decide: (id, decision, note) => call('/api/nota/decide', { id, decision, note }).then((n) => n.status),
    verify: (projectId, reportId) => call('/api/verify', { projectId, reportId }),
    saveProject: (b) => call('/api/project/save', b),
    invoice: (projectId, termin) => call('/api/invoice', { projectId, termin }),
    paid: (id) => call('/api/invoice/paid', { id }),
    matrix: (key, patch) => call('/api/matrix', Object.assign({ key }, patch)),
    vo: (b) => call('/api/vo', b),
    voStatus: (id, status, by) => call('/api/vo/status', { id, status, by }),
    photoUrl: (ref) => ref,
    exportCsv(p) { window.location.href = '/api/export?projectId=' + encodeURIComponent(p.id); },
    canUpload: () => true
  };
})();
