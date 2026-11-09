// Master Product: import CSV, daftar, cari, edit, hapus, cek duplikat
let allProducts = [];
let pendingRows = [];

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const d = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = ''; rows.push(row); row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

async function loadProducts() {
  let out = [], from = 0;
  while (true) { // paginasi: Supabase membatasi 1000 baris per permintaan
    const { data, error } = await sb.from('products').select('*').order('internal_code').range(from, from + 999);
    if (error) { toast('Gagal memuat produk: ' + error.message, true); return; }
    out = out.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  allProducts = out;
  renderProducts();
}

function renderProducts() {
  const q = $('#p-search').value.trim().toLowerCase();
  const list = allProducts.filter(p => !q ||
    [p.barcode, p.internal_code, p.product_name].some(x => (x || '').toLowerCase().includes(q)));
  $('#p-count').textContent = `${list.length} dari ${allProducts.length} produk` + (list.length > 300 ? ' (menampilkan 300 pertama)' : '');
  $('#p-body').innerHTML = list.slice(0, 300).map(p => `
    <tr>
      <td>${esc(p.barcode)}</td><td>${esc(p.internal_code)}</td>
      <td>${esc(p.product_name)}</td><td>${esc(p.size)}</td>
      <td>${p.is_active ? '✔' : '✖'}</td>
      <td class="nowrap">
        <button class="btn small" data-edit="${p.id}">Edit</button>
        <button class="btn small danger" data-del="${p.id}">Hapus</button>
      </td>
    </tr>`).join('');
}

function prepareImport(text) {
  const rows = parseCSV(text);
  if (rows.length && rows[0][0].trim().toLowerCase() === 'barcode') rows.shift();
  const seen = new Set(), valid = [], dups = [], bad = [];
  rows.forEach((r, i) => {
    const barcode = (r[0] || '').trim();
    const name = (r[2] || '').trim();
    if (!barcode || !name) return bad.push(i + 2);
    if (seen.has(barcode)) return dups.push(barcode);
    seen.add(barcode);
    valid.push({
      barcode,
      internal_code: (r[1] || '').trim() || barcode,
      product_name: name,
      size: (r[3] || '').trim(),
      is_active: true
    });
  });
  pendingRows = valid;
  const s = $('#csv-summary');
  s.hidden = false;
  s.innerHTML = `<b>${valid.length}</b> baris siap diimpor.` +
    (dups.length ? `<br>⚠ Barcode ganda di file (baris ganda dilewati): ${esc(dups.slice(0, 10).join(', '))}${dups.length > 10 ? '…' : ''}` : '') +
    (bad.length ? `<br>⚠ Baris tidak valid (barcode/nama kosong), nomor baris: ${bad.slice(0, 10).join(', ')}${bad.length > 10 ? '…' : ''}` : '');
  $('#csv-import-btn').hidden = valid.length === 0;
}

async function runImport() {
  const btn = $('#csv-import-btn'); btn.disabled = true;
  for (let i = 0; i < pendingRows.length; i += 500) {
    const { error } = await sb.from('products').upsert(pendingRows.slice(i, i + 500), { onConflict: 'barcode' });
    if (error) { toast('Impor gagal: ' + error.message, true); btn.disabled = false; return; }
  }
  toast(`${pendingRows.length} produk berhasil diimpor/diperbarui.`);
  pendingRows = []; btn.hidden = true; btn.disabled = false;
  $('#csv-summary').hidden = true; $('#csv-file').value = '';
  await loadProducts();
}

function checkDuplicates() {
  const groups = {};
  allProducts.forEach(p => {
    const k = `${p.internal_code}|${(p.size || '').toUpperCase()}`;
    (groups[k] = groups[k] || []).push(p);
  });
  const dups = Object.values(groups).filter(g => g.length > 1);
  const el = $('#p-dup-result'); el.hidden = false;
  el.innerHTML = dups.length
    ? `⚠ ${dups.length} kombinasi Kode+Size ganda:<br>` + dups.slice(0, 20).map(g =>
        `${esc(g[0].internal_code)} / ${esc(g[0].size)} → barcode: ${esc(g.map(p => p.barcode).join(', '))}`).join('<br>')
    : '✔ Tidak ada duplikat. Barcode dijamin unik oleh database; Kode+Size juga tidak ada yang ganda.';
}

function openEdit(id) {
  const p = allProducts.find(x => x.id === id); if (!p) return;
  $('#edit-form').dataset.id = id;
  $('#e-barcode').value = p.barcode; $('#e-code').value = p.internal_code;
  $('#e-name').value = p.product_name; $('#e-size').value = p.size || '';
  $('#e-active').checked = p.is_active;
  $('#edit-dlg').showModal();
}

async function saveEdit(ev) {
  ev.preventDefault();
  const { error } = await sb.from('products').update({
    barcode: $('#e-barcode').value.trim(),
    internal_code: $('#e-code').value.trim(),
    product_name: $('#e-name').value.trim(),
    size: $('#e-size').value.trim(),
    is_active: $('#e-active').checked
  }).eq('id', $('#edit-form').dataset.id);
  if (error) return toast(error.code === '23505' ? 'Barcode sudah dipakai produk lain.' : 'Gagal: ' + error.message, true);
  $('#edit-dlg').close(); toast('Produk diperbarui.');
  await loadProducts();
}

async function deleteProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p || !confirm(`Hapus ${p.internal_code} (${p.product_name} ${p.size || ''})?`)) return;
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) return toast(error.code === '23503'
    ? 'Produk sudah punya riwayat penghitungan. Nonaktifkan lewat Edit, jangan dihapus.'
    : 'Gagal: ' + error.message, true);
  toast('Produk dihapus.'); await loadProducts();
}

function initProducts() {
  $('#csv-file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (f) prepareImport(await f.text());
  });
  $('#csv-import-btn').onclick = runImport;
  $('#p-search').addEventListener('input', renderProducts);
  $('#p-dup-btn').onclick = checkDuplicates;
  $('#p-body').addEventListener('click', e => {
    if (e.target.dataset.edit) openEdit(e.target.dataset.edit);
    if (e.target.dataset.del) deleteProduct(e.target.dataset.del);
  });
  $('#edit-form').addEventListener('submit', saveEdit);
  $('#e-cancel').onclick = () => $('#edit-dlg').close();
  registerView('products', 'Master Product', loadProducts);
}
