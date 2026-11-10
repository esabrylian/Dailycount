// Riwayat: daftar transaksi scan per tanggal
async function loadHistory() {
  const date = $('#h-date').value;
  const me = (await sb.auth.getSession()).data.session?.user.id;
  let out = [], from = 0;
  while (true) {
    const { data, error } = await sb.from('stock_count_logs')
      .select('quantity_input,scanned_at,scanned_by,products(internal_code,product_name,size),daily_stock_counts!inner(count_date)')
      .eq('daily_stock_counts.count_date', date)
      .order('scanned_at', { ascending: false }).range(from, from + 999);
    if (error) return toast('Gagal memuat riwayat: ' + error.message, true);
    out = out.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  $('#h-count').textContent = `${out.length} transaksi`;
  const fmt = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  $('#h-body').innerHTML = out.map(r => `
    <tr><td class="nowrap">${fmt.format(new Date(r.scanned_at))}</td>
    <td>${esc(r.products?.internal_code)}</td><td>${esc(r.products?.product_name)}</td>
    <td>${esc(r.products?.size)}</td><td class="num"><b>+${r.quantity_input}</b></td>
    <td>${r.scanned_by === me ? 'Anda' : 'Petugas lain'}</td></tr>`).join('')
    || '<tr><td colspan="6" class="muted">Belum ada transaksi.</td></tr>';
}

function initHistory() {
  $('#h-date').value = todayJakarta();
  $('#h-date').addEventListener('change', loadHistory);
  $('#h-refresh').onclick = loadHistory;
  registerView('history', 'Riwayat', loadHistory);
}
