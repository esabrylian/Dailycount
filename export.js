// Export CSV: Internal Code, Product Name, Size, Quantity (UTF-8 BOM)
function csvCell(v, sep) {
  v = String(v ?? '');
  return new RegExp('["\\n\\r' + (sep === ';' ? ';' : ',') + ']').test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

async function exportCsv() {
  const date = $('#x-date').value, sep = $('#x-sep').value;
  if (!date) return toast('Pilih tanggal dulu.', true);
  const btn = $('#x-btn'); btn.disabled = true;
  try {
    const rows = await fetchCounts(date);
    if (!rows.length) return toast('Tidak ada data penghitungan pada tanggal itu.', true);
    const lines = [['Internal Code', 'Product Name', 'Size', 'Quantity'].join(sep)]
      .concat(rows.map(r => [r.products.internal_code, r.products.product_name, r.products.size, r.total_quantity]
        .map(v => csvCell(v, sep)).join(sep)));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `DAILY_STOCK_COUNT_${date}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`${rows.length} baris diekspor.`);
  } catch (e) { toast('Export gagal: ' + e.message, true); }
  finally { btn.disabled = false; }
}

function initExport() {
  $('#x-date').value = todayJakarta();
  $('#x-btn').onclick = exportCsv;
  registerView('export', 'Export CSV', () => {});
}
