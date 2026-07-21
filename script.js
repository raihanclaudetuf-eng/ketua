/* ====================================================================
   GANTI BAGIAN INI dengan konfigurasi proyek Firebase Anda sendiri.
   Ambil dari: Firebase Console > Project settings > General > Your apps
   ==================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBzCxRSat6Ll8Pv5TIVmNCm3UN_6xN7zXs",
  authDomain: "mangestic-voting.firebaseapp.com",
  projectId: "mangestic-voting",
  storageBucket: "mangestic-voting.firebasestorage.app",
  messagingSenderId: "120042129811",
  appId: "1:120042129811:web:a948af22cf82d56b0fc066"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const ADMIN_PASS = 'mangestic2026';

async function getFingerprint(){
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || 0,
    navigator.platform || ''
  ];
  try{
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('mangestic-2026-\u0002', 2, 2);
    parts.push(canvas.toDataURL());
  }catch(e){}
  const str = parts.join('|');
  let hash = 0;
  for(let i=0;i<str.length;i++){
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 'dev_' + Math.abs(hash).toString(36) + '_' + str.length;
}

async function loadCandidates(){
  try{
    const doc = await db.collection('mangestic').doc('candidates').get();
    return doc.exists ? (doc.data().list || []) : [];
  }catch(e){ console.error(e); return []; }
}
async function saveCandidates(list){
  await db.collection('mangestic').doc('candidates').set({ list });
}
async function loadVotes(){
  try{
    const doc = await db.collection('mangestic').doc('votes').get();
    return doc.exists ? doc.data() : {};
  }catch(e){ console.error(e); return {}; }
}
async function saveVotes(v){
  await db.collection('mangestic').doc('votes').set(v);
}
async function incrementVote(candidateId){
  await db.collection('mangestic').doc('votes').set(
    { [candidateId]: firebase.firestore.FieldValue.increment(1) },
    { merge: true }
  );
}
async function getVotedKey(fp){
  try{
    const doc = await db.collection('voted').doc(fp).get();
    return doc.exists ? doc.data().candidateId : null;
  }catch(e){ console.error(e); return null; }
}
async function setVotedKey(fp, candidateId){
  await db.collection('voted').doc(fp).set({ candidateId, ts: Date.now() });
}

const app = document.getElementById('app');
const overlayRoot = document.getElementById('overlay-root');
let fingerprint = null;
let candidates = [];
let votes = {};
let votedFor = null;

function closeOverlay(){ overlayRoot.innerHTML = ''; }

function renderLoading(){
  app.innerHTML = '<div class="loading">Memuat surat suara...</div>';
}

function compressImage(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      const img = new Image();
      img.onload = ()=>{
        const w2 = 200, h2 = 256;
        const canvas = document.createElement('canvas');
        canvas.width = w2; canvas.height = h2;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(w2/img.width, h2/img.height);
        const w = img.width*scale, h = img.height*scale;
        ctx.drawImage(img, (w2-w)/2, (h2-h)/2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderSetup(existing){
  const isEdit = existing && existing.length > 0;
  app.innerHTML = `
    <p style="font-size:13.5px;color:var(--ink-soft);margin:0 0 18px;line-height:1.6;">
      ${isEdit ? 'Ubah data kandidat di bawah ini.' : 'Masukkan nama-nama kandidat ketua Mangestic untuk membuka surat suara.'}
    </p>
    ${isEdit ? `<p style="font-size:12px;color:var(--gold);margin:-10px 0 18px;">Menyimpan perubahan akan mereset seluruh suara yang sudah masuk.</p>` : ''}
    <div id="setup-rows"></div>
    <button class="add-candidate-btn" id="add-row">+ Tambah kandidat</button>
    <button class="btn-pilih" id="save-setup" style="width:100%;padding:12px;">${isEdit ? 'Simpan perubahan' : 'Buka surat suara'}</button>
  `;
  const rows = document.getElementById('setup-rows');
  let rowCount = 0;

  function addRow(name, visi, photo){
    rowCount++;
    const idx = rowCount;
    const div = document.createElement('div');
    div.className = 'setup-row';
    div.dataset.idx = idx;
    div.dataset.photo = photo || '';
    div.innerHTML = `
      <button class="remove" data-remove="${idx}">Hapus</button>
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px;">
        <div class="photo-preview" style="width:52px;height:66px;border-radius:3px;border:1.5px solid var(--line);background:var(--paper-dark);flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;">
          ${photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:9.5px;color:var(--ink-soft);">Foto</span>`}
        </div>
        <div style="flex:1;">
          <label class="field-label">Foto kandidat (opsional)</label>
          <input type="file" accept="image/*" class="cand-photo">
        </div>
      </div>
      <label class="field-label">Nama kandidat</label>
      <input type="text" class="cand-name" value="${name||''}" placeholder="cth. Ahmad Fauzan">
      <label class="field-label">Visi singkat (opsional)</label>
      <input type="text" class="cand-visi" value="${visi||''}" placeholder="cth. Mangestic yang solid dan terbuka">
    `;
    rows.appendChild(div);

    div.querySelector('.cand-photo').addEventListener('change', async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const dataUrl = await compressImage(file);
      div.dataset.photo = dataUrl;
      div.querySelector('.photo-preview').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
    });
  }
  if(isEdit){
    existing.forEach(c => addRow(c.name, c.visi, c.photo));
  }else{
    addRow(); addRow();
  }

  rows.addEventListener('click', (e)=>{
    if(e.target.dataset.remove){
      const el = rows.querySelector(`[data-idx="${e.target.dataset.remove}"]`);
      if(rows.children.length > 1) el.remove();
    }
  });
  document.getElementById('add-row').addEventListener('click', ()=> addRow());

  document.getElementById('save-setup').addEventListener('click', async ()=>{
    const rowEls = [...rows.children];
    const list = rowEls.map((r, i)=>{
      const name = r.querySelector('.cand-name').value.trim();
      const visi = r.querySelector('.cand-visi').value.trim();
      const photo = r.dataset.photo || '';
      return name ? { id: 'c' + (i+1), name, visi, photo, nomor: i+1 } : null;
    }).filter(Boolean);
    if(list.length < 2){
      alert('Masukkan minimal 2 kandidat.');
      return;
    }
    await saveCandidates(list);
    candidates = list;
    votes = {};
    await saveVotes({});
    await init();
  });
}

function renderWaiting(){
  app.innerHTML = `
    <div class="status-banner"><span class="dot"></span>Surat suara belum dibuka</div>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.6;text-align:center;padding:16px 0 8px;">
      Panitia belum menambahkan kandidat. Silakan periksa kembali nanti.
    </p>
  `;
}

function renderVoting(){
  const cards = candidates.map(c => `
    <div class="candidate-card">
      <span class="nomor-tag">NOMOR URUT ${String(c.nomor).padStart(2,'0')}</span>
      <div class="card-avatar">
        ${c.photo ? `<img src="${c.photo}" alt="${escapeHtml(c.name)}">` : `<span class="fallback">${escapeHtml((c.name||'?').trim().charAt(0).toUpperCase())}</span>`}
      </div>
      <p class="card-name">${escapeHtml(c.name)}</p>
      ${c.visi ? `<p class="card-visi">${escapeHtml(c.visi)}</p>` : ''}
      <button class="btn-pilih" data-vote="${c.id}">Pilih</button>
    </div>
  `).join('');
  app.innerHTML = `
    <div class="status-banner"><span class="dot"></span>Surat suara terbuka &mdash; pilih satu kandidat</div>
    <div class="candidates-grid">${cards}</div>
  `;
  app.querySelectorAll('[data-vote]').forEach(btn=>{
    btn.addEventListener('click', ()=> confirmVote(btn.dataset.vote));
  });
}

function confirmVote(candidateId){
  const c = candidates.find(x=>x.id===candidateId);
  overlayRoot.innerHTML = `
    <div class="overlay">
      <div class="modal">
        <h3>Konfirmasi suara</h3>
        <p>Anda akan memilih <strong>${escapeHtml(c.name)}</strong> (nomor urut ${c.nomor}). Suara tidak dapat diubah setelah dikirim.</p>
        <div class="modal-actions">
          <button class="btn-secondary" id="cancel-vote">Batal</button>
          <button class="btn-pilih" id="confirm-vote">Kirim suara</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('cancel-vote').addEventListener('click', closeOverlay);
  document.getElementById('confirm-vote').addEventListener('click', async ()=>{
    closeOverlay();
    await castVote(candidateId);
  });
}

async function castVote(candidateId){
  app.innerHTML = '<div class="loading">Mencatat suara...</div>';
  const already = await getVotedKey(fingerprint);
  if(already){
    votedFor = already;
    votes = await loadVotes();
    renderThanks(true);
    return;
  }
  await incrementVote(candidateId);
  await setVotedKey(fingerprint, candidateId);
  votes = await loadVotes();
  votedFor = candidateId;
  renderThanks(false);
}

function renderThanks(wasAlready){
  const c = candidates.find(x=>x.id===votedFor);
  app.innerHTML = `
    <div class="seal-stamp"><span>SUARA<br>TERCATAT</span></div>
    <p class="thanks-title">${wasAlready ? 'Suara Anda sudah tercatat' : 'Terima kasih telah memilih'}</p>
    <p class="thanks-sub">${c ? 'Anda memilih ' + escapeHtml(c.name) + '.' : ''}</p>
    <p class="thanks-sub" style="margin-bottom:4px;">Perangkat ini hanya dapat memberikan satu suara.</p>
    <p class="thanks-sub" style="font-size:12px;">Hasil pemilihan akan diumumkan oleh panitia.</p>
  `;
}

function renderResults(mount){
  const total = candidates.reduce((s,c)=> s + (votes[c.id]||0), 0);
  const rows = candidates
    .slice()
    .sort((a,b)=> (votes[b.id]||0) - (votes[a.id]||0))
    .map(c=>{
      const count = votes[c.id] || 0;
      const pct = total > 0 ? Math.round((count/total)*100) : 0;
      return `
        <div class="results-row">
          <div class="results-label">
            <span class="name">No. ${c.nomor} &middot; ${escapeHtml(c.name)}</span>
            <span class="pct">${count} suara &middot; ${pct}%</span>
          </div>
          <div class="results-track"><div class="results-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');
  mount.innerHTML = `<div class="results-bar-wrap">${rows}</div><p class="total-votes">Total ${total} suara masuk</p>`;
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function openAdmin(){
  overlayRoot.innerHTML = `
    <div class="overlay">
      <div class="modal">
        <h3>Kelola pemilihan</h3>
        <p>Masukkan kata sandi admin untuk melanjutkan.</p>
        <input type="password" id="admin-pass" placeholder="Kata sandi">
        <div class="modal-actions">
          <button class="btn-secondary" id="cancel-admin">Batal</button>
          <button class="btn-pilih" id="submit-admin">Masuk</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('cancel-admin').addEventListener('click', closeOverlay);
  document.getElementById('submit-admin').addEventListener('click', ()=>{
    const val = document.getElementById('admin-pass').value;
    if(val === ADMIN_PASS){
      closeOverlay();
      if(candidates.length === 0){
        renderSetup();
      }else{
        renderAdminPanel();
      }
    }else{
      alert('Kata sandi salah.');
    }
  });
}

function renderAdminPanel(){
  const total = candidates.reduce((s,c)=> s + (votes[c.id]||0), 0);
  const list = candidates.map(c=>`
    <div class="admin-list-item">
      <span>No. ${c.nomor} &middot; ${escapeHtml(c.name)}</span>
      <span>${votes[c.id]||0} suara</span>
    </div>
  `).join('');
  overlayRoot.innerHTML = `
    <div class="overlay">
      <div class="modal" style="max-width:460px;">
        <h3>Panel admin</h3>
        <div style="margin-bottom:16px;">${list || '<p style="font-size:13px;color:var(--ink-soft);">Belum ada kandidat.</p>'}</div>
        <p style="font-size:12px;color:var(--ink-soft);font-family:'IBM Plex Mono',monospace;margin-bottom:18px;">Total: ${total} suara</p>
        <div class="modal-actions" style="justify-content:space-between;">
          <button class="btn-secondary" id="reset-all">Reset kandidat &amp; suara</button>
          <div style="display:flex;gap:10px;">
            <button class="btn-secondary" id="edit-candidates">Edit kandidat</button>
            <button class="btn-secondary" id="close-admin">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('close-admin').addEventListener('click', closeOverlay);
  document.getElementById('edit-candidates').addEventListener('click', ()=>{
    closeOverlay();
    renderSetup(candidates);
  });
  document.getElementById('reset-all').addEventListener('click', async ()=>{
    if(!confirm('Yakin ingin menghapus semua kandidat dan suara? Tindakan ini tidak dapat dibatalkan.')) return;
    await db.collection('mangestic').doc('candidates').delete();
    await db.collection('mangestic').doc('votes').delete();
    candidates = [];
    votes = {};
    votedFor = null;
    closeOverlay();
    await init();
  });
}

document.getElementById('admin-link').addEventListener('click', openAdmin);

async function init(){
  renderLoading();
  fingerprint = await getFingerprint();
  candidates = await loadCandidates();
  votes = await loadVotes();

  if(candidates.length === 0){
    renderWaiting();
    return;
  }

  const already = await getVotedKey(fingerprint);
  if(already){
    votedFor = already;
    renderThanks(true);
    return;
  }

  renderVoting();
}

init();
