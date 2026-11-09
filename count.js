// Daily Stock Count: scan Code 39 -> cari produk -> simpan lewat RPC atomic
const ZX = window.ZXing;
let reader = null, scanning = false, handling = false;
let current = null; // { product, key, locked }

const todayJakarta = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2) + '-' + Math.random().toString(16).slice(2));

function setMsg(t, isErr) {
  const m = $('#scan-msg'); m.textContent = t || ''; m.className = isErr ? 'error small' : 'muted small';
}

async function startScanner() {
  if (scanning) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return setMsg('Kamera tidak tersedia. Buka lewat HTTPS (GitHub Pages) atau localhost.', true);
  }
  const hints = new Map();
  hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.CODE_39]);
  hints.set(ZX.DecodeHintType.TRY_HARDER, true);
  reader = new ZX.BrowserMultiFormatReader(hints, 200);
  scanning = true; handling = false;
  $('#cam-hint').hidden = true; $('#scan-btn').textContent = 'STOP KAMERA';
  setMsg('Arahkan kamera ke barcode...');
  try {
    await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      $('#cam'),
      result => { if (result && !handling) onDecoded(result.getText()); }
    );
  } catch (e) {
    stopScanner();
    setMsg(e && e.name === 'NotAllowedError'
      ? 'Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser.'
      : 'Kamera gagal dibuka: ' + (e && e.message || e), true);
  }
}

function stopScanner() {
  if (reader) { try { reader.reset(); } catch (_) {} reader = null; }
  scanning = false;
  const h = $('#cam-hint'), b = $('#scan-btn');
  if (h) h.hidden = false;
  if (b) b.textContent = 'SCAN BARCODE';
}
window.stopScanner = stopScanner;

async function findProduct(code) {
  const cands = [code];
  const stripped = code.replace(/^\*|\*$/g, ''); // jaga-jaga jika start/stop * ikut terbaca
  if (stripped && stripped !== code) cands.push(stripped);
  for (const c of cands) {
    const { data, error } = await sb.from('products').select('*').eq('barcode', c).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}

async function onDecoded(code) {
  handling = true;
  stopScanner();
  if (navigator.vibrate) navigator.vibrate(60);
  $('#last-result').hidden = true;
  let p;
  try { p = await findProduct(code); }
  catch (e) { setMsg('Gagal mencari produk: ' + e.message, true); handling = false; return; }

  if (!p) {
    current = null; $('#product-card').hidden = true;
    $('#nf-code').textContent = 'Hasil baca: ' + code;
    $('#notfound').hidden = false;
    setMsg('');
    setTimeout(startScanner, 1500); // tidak ada data yang disimpan; siap scan lagi
    return;
  }
  if (!p.is_active) {
    $('#nf-code').textContent = `${p.internal_code} tidak aktif.`;
    $('#notfound').hidden = false; setTimeout(startScanner, 1500); return;
  }
  $('#notfound').hidden = true;
  current = { product: p, key: newKey(), locked: false };
  $('#pi-barcode').textContent = p.barcode;
  $('#pi-code').textContent = p.internal_code;
  $('#pi-name').textContent = p.product_name;
  $('#pi-size').textContent = p.size || '-';
  $('#qty').value = ''; $('#qty').readOnly = false;
  $('#cur-total').textContent = '...';
  $('#product-card').hidden = false;
  $('#qty').focus();
  setMsg('');
  const { data } = await sb.from('daily_stock_counts').select('total_quantity')
    .eq('count_date', todayJakarta()).eq('product_id', p.id).maybeSingle();
  $('#cur-total').textContent = data ? data.total_quantity : 0;
}

function discard() {
  current = null; handling = false;
  $('#product-card').hidden = true; $('#notfound').hidden = true;
}

async function saveCount() {
  if (!current) return;
  const q = Number($('#qty').value);
  if (!Number.isInteger(q) || q < 1 || q > 100000) return toast('Jumlah harus bilangan bulat 1 - 100000.', true);
  const btn = $('#save-btn'); btn.disabled = true;
  $('#qty').readOnly = true; // kunci jumlah: kirim ulang memakai transaksi yang sama
  const { data, error } = await sb.rpc('add_daily_stock_count', {
    p_product_id: current.product.id, p_quantity: q, p_idempotency_key: current.key
  });
  btn.disabled = false;
  if (error) {
    if (error.code) { // ditolak server (bukan masalah jaringan)
      $('#qty').readOnly = false; current.key = newKey();
      return toast('Ditolak: ' + error.message, true);
    }
    return toast('Koneksi bermasalah. Tekan SIMPAN lagi: aman, tidak akan terhitung dua kali.', true);
  }
  const p = current.product;
  $('#last-result').innerHTML = `✔ <b>${esc(p.internal_code)}</b> ${esc(p.product_name)} ${esc(p.size || '')}` +
    `<br>Ditambah ${q}${data.duplicate ? ' (transaksi ini sudah tercatat sebelumnya)' : ''}` +
    `<br>Total hari ini: <b>${data.total_quantity}</b> (${data.total_scans} scan)`;
  $('#last-result').hidden = false;
  discard();
  startScanner(); // otomatis siap scan berikutnya
}

function initCount() {
  $('#scan-btn').onclick = () => scanning ? stopScanner() : (discard(), startScanner());
  $('#save-btn').onclick = saveCount;
  $('#cancel-btn').onclick = () => { discard(); stopScanner(); setMsg('Dibatalkan. Tidak ada data tersimpan.'); };
  $('#next-btn').onclick = () => { discard(); startScanner(); };
  registerView('count', 'Daily Stock Count', () => {});
}
