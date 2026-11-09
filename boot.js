initCount();      // urutan = urutan menu
initProducts();   // halaman lain didaftarkan di tahap berikutnya
initAuth();
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) await enterApp(session.user); else showLogin();
})();
