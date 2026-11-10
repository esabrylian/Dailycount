// Dashboard: rekap per tanggal, pencarian, update otomatis (Realtime)
let dashRows = [], dashChannel = null, dashTimer = null;

// Dipakai juga oleh Export. Satu baris per produk per tanggal, urut Internal Code.
async function fetchCounts(date) {
  let out = [], from = 0;
  while (true) {
    const { data, error } = await sb.from('daily_stock_counts')
      .select('total_quantity,total_scans,products(barcode,internal_code,product_name,size)')
      .eq('count_date', date).order('id').range(from, from + 999);
    if (error) throw error;
    out = out.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return out.filter(r => r.products)
    .sort((a, b) => a.products.internal_code.localeCompare(b.products.internal_code, undefined, { numeric: true }));
}

function renderDashboard() {
  const q = $('#d-search').value.trim().toLowerCase();
  const list = dashRows.filter(r => !q || [r.products.internal_code, r.products.product_name, r.products.barcode]
    .some(x => (x || '').toLowerCase().includes(q)));
  $('#d-body').innerHTML = list.map(r => `
    <tr><td>${esc(r.products.internal_code)}</td><td>${esc(r.products.product_name)}</td>
    <td>${esc(r.products.size)}</td><td class="num"><b>${r.total_quantity}</b></td></tr>`).join('')
    || '<tr><td colspan="4" class="muted">Belum ada data.</td></tr>';
}

async function loadDashboard() {
  try { dashRows = await fetchCounts($('#d-date').value); }
  catch (e) { return toast('Gagal memuat rekap: ' + e.message, true); }
  $('#d-products').textContent = dashRows.length;
  $('#d-units').textContent = dashRows.reduce((s, r) => s + r.total_quantity, 0);
  $('#d-scans').textContent = dashRows.reduce((s, r) => s + r.total_scans, 0);
  renderDashboard();
}

function subscribeDashboard() {
  if (dashChannel) return;
  dashChannel = sb.channel('dsc-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stock_counts' }, () => {
      if ($('#view-dashboard').hidden) return;
      clearTimeout(dashTimer); dashTimer = setTimeout(loadDashboard, 400);
    }).subscribe();
}

function initDashboard() {
  $('#d-date').value = todayJakarta();
  $('#d-date').addEventListener('change', loadDashboard);
  $('#d-search').addEventListener('input', renderDashboard);
  $('#d-refresh').onclick = loadDashboard;
  sb.auth.onAuthStateChange(ev => {
    if (ev === 'SIGNED_OUT' && dashChannel) { sb.removeChannel(dashChannel); dashChannel = null; }
  });
  registerView('dashboard', 'Dashboard', async () => { subscribeDashboard(); await loadDashboard(); });
}
