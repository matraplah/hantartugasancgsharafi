/******************************************************************
 *  SISTEM KERJA RUMAH + SEMAKAN AI (OpenRouter)
 *  - Murid upload gambar kerja melalui pautan web
 *  - AI semak berdasarkan skema guru & beri markah + komen
 *  - Rekod penghantaran & markah dikemaskini automatik
 *
 *  Tab dalam Google Sheet:
 *    TETAPAN       - tetapan sistem
 *    MURID         - senarai murid ikut kelas
 *    TUGASAN       - senarai kerja rumah + skema jawapan
 *    PENGHANTARAN  - log setiap hantaran (dijana sistem)
 *    REKOD <KELAS> - jadual murid x tugasan (dijana sistem)
 ******************************************************************/

const TZ = 'Asia/Kuala_Lumpur';
const TAB = { TETAPAN: 'TETAPAN', MURID: 'MURID', TUGASAN: 'TUGASAN', HANTAR: 'PENGHANTARAN' };
const PREFIX_REKOD = 'REKOD ';
const KELAS_LALAI = ['FIZIK 4 SAINS', 'FIZIK 5 SAINS', 'SAINS 3 ALAMANDA', 'SAINS 3 DAISY', 'SAINS 3 JASMINE'];

const H_MURID = ['Kelas', 'Nama Murid'];
const H_TUGASAN = [
  'ID Tugasan',
  'Kelas (pisah dengan koma jika lebih dari satu)',
  'Tajuk',
  'Soalan / Arahan (murid nampak)',
  'Skema Jawapan & Peraturan Markah (RAHSIA - murid tidak nampak)',
  'Pautan Fail Skema di Drive (pilihan: PDF/gambar/Google Doc)',
  'Markah Penuh',
  'Tarikh Akhir',
  'Status (BUKA/TUTUP)'
];
const H_HANTAR = [
  'ID Hantaran', 'Cap Masa', 'Kelas', 'Nama Murid', 'ID Tugasan', 'Tajuk', 'Hantar Ke-',
  'Status Masa', 'Markah AI', 'Markah Penuh', 'Markah Guru (isi jika mahu ubah)', 'Markah Akhir',
  'Peratus', 'Komen AI', 'Status Semakan', 'Catatan AI', 'Pautan Gambar', 'ID Fail', 'E-mel', 'Cubaan AI'
];
// Indeks lajur (0-based) PENGHANTARAN
const C = {};
['ID', 'MASA', 'KELAS', 'NAMA', 'TUGAS', 'TAJUK', 'KE', 'STATMASA', 'AI', 'PENUH', 'GURU', 'AKHIR',
  'PERATUS', 'KOMEN', 'SEMAKAN', 'CATATAN', 'PAUTAN', 'FAIL', 'EMEL', 'CUBAAN']
  .forEach((k, i) => C[k] = i);

const ST = {
  MENUNGGU: 'MENUNGGU',
  SIAP: 'SIAP (AI)',
  SEMAK: 'PERLU SEMAK GURU',
  RALAT: 'RALAT - SEMAK MANUAL'
};
const MAKS_CUBAAN = 5;
const NAMA_KEY = 'OPENROUTER_API_KEY';

/* ======================== MENU ======================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📚 Kerja Rumah')
    .addItem('1. Setup sistem (kali pertama)', 'setupSistem')
    .addItem('2. Masukkan API Key OpenRouter', 'masukkanApiKey')
    .addItem('3. Uji sambungan AI', 'ujiAI')
    .addSeparator()
    .addItem('Tunjuk pautan & QR untuk murid', 'tunjukPautan')
    .addItem('Kemaskini semua tab REKOD', 'kemaskiniSemuaRekod')
    .addItem('Proses semakan yang tertangguh', 'prosesBarisMenunggu')
    .addItem('Semak semula baris dipilih (tab PENGHANTARAN)', 'semakSemulaBarisDipilih')
    .addToUi();
}

/* ======================== SETUP ======================== */

function setupSistem() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);

  // --- TETAPAN ---
  const tt = tabAtauBuat_(TAB.TETAPAN);
  if (tt.getLastRow() === 0) {
    tt.getRange(1, 1, 1, 3).setValues([['Tetapan', 'Nilai', 'Keterangan']]).setFontWeight('bold');
  }
  const lalai = [
    ['NAMA_GURU', 'Cikgu', 'Dipaparkan pada borang murid'],
    ['SENARAI_KELAS', KELAS_LALAI.join(', '), 'Semua kelas yang anda ajar (pisah dengan koma)'],
    ['MODEL_AI', 'google/gemini-2.5-flash', 'ID model OpenRouter yang boleh baca gambar (lihat openrouter.ai/models). Cth: google/gemini-2.5-flash, openai/gpt-4o-mini, anthropic/claude-sonnet-4.5'],
    ['TUNJUK_MARKAH_KEPADA_MURID', 'YA', 'YA = murid nampak markah & komen selepas hantar. TIDAK = murid hanya nampak "diterima"'],
    ['MAKS_GAMBAR', '5', 'Bilangan gambar maksimum bagi setiap hantaran'],
    ['FOLDER_ID', '', 'Diisi automatik: folder Google Drive tempat gambar disimpan']
  ];
  lalai.forEach(r => { if (getTetapan_(r[0]) === null) tt.appendRow(r); });
  tt.setColumnWidth(1, 230); tt.setColumnWidth(2, 320); tt.setColumnWidth(3, 520);
  tt.setFrozenRows(1);

  // Folder Drive
  folderUtama_();

  // --- MURID ---
  const tm = tabAtauBuat_(TAB.MURID);
  if (tm.getLastRow() === 0) {
    tm.getRange(1, 1, 1, H_MURID.length).setValues([H_MURID]).setFontWeight('bold').setBackground('#d9ead3');
    tm.setFrozenRows(1);
    tm.setColumnWidth(1, 200); tm.setColumnWidth(2, 380);
  }
  const ruleKelas = SpreadsheetApp.newDataValidation()
    .requireValueInList(senaraiKelas_(), true).setAllowInvalid(false).build();
  tm.getRange(2, 1, Math.max(tm.getMaxRows() - 1, 1), 1).setDataValidation(ruleKelas);

  // --- TUGASAN ---
  const tg = tabAtauBuat_(TAB.TUGASAN);
  if (tg.getLastRow() === 0) {
    tg.getRange(1, 1, 1, H_TUGASAN.length).setValues([H_TUGASAN])
      .setFontWeight('bold').setBackground('#cfe2f3').setWrap(true);
    const esok = new Date(); esok.setDate(esok.getDate() + 7); esok.setHours(0, 0, 0, 0);
    tg.appendRow([
      'F4-T01', 'FIZIK 4 SAINS', 'CONTOH: Gerakan Linear',
      'Jawab soalan 1-3 Latihan 2.1 dalam buku latihan. Tunjukkan jalan kerja.',
      'S1 (3m): u=0, a=2 m/s², t=5 s. v=u+at [1m], v=0+2(5) [1m], v=10 m/s [1m - mesti ada unit]\n' +
      'S2 (3m): s=ut+½at² [1m], s=0+½(2)(25) [1m], s=25 m [1m]\n' +
      'S3 (4m): Terangkan inersia: sifat objek menentang perubahan keadaan gerakan [2m]; contoh betul [2m]\n' +
      'Terima jawapan setara. Tolak 1m jika unit tiada pada jawapan akhir.',
      '', 10, esok, 'TUTUP'
    ]);
    tg.setFrozenRows(1);
    [110, 220, 220, 320, 460, 220, 90, 110, 110].forEach((w, i) => tg.setColumnWidth(i + 1, w));
  }
  const nT = Math.max(tg.getMaxRows() - 1, 1);
  tg.getRange(2, 8, nT, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build()).setNumberFormat('dd/MM/yyyy');
  tg.getRange(2, 9, nT, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['BUKA', 'TUTUP'], true).build());
  tg.getRange(2, 4, nT, 2).setWrap(true).setVerticalAlignment('top');

  // --- PENGHANTARAN ---
  const th = tabAtauBuat_(TAB.HANTAR);
  if (th.getLastRow() === 0) {
    th.getRange(1, 1, 1, H_HANTAR.length).setValues([H_HANTAR])
      .setFontWeight('bold').setBackground('#fce5cd').setWrap(true);
    th.setFrozenRows(1);
    th.hideColumns(C.FAIL + 1);
    th.hideColumns(C.CUBAAN + 1);
    th.setColumnWidth(C.KOMEN + 1, 380);
    th.setColumnWidth(C.CATATAN + 1, 300);
    th.setColumnWidth(C.NAMA + 1, 220);
    th.getRange(1, C.GURU + 1).setBackground('#fff2cc');
  }
  th.getRange(2, C.MASA + 1, th.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  th.getRange(2, C.PERATUS + 1, th.getMaxRows() - 1, 1).setNumberFormat('0%');
  warnaPenghantaran_(th);

  // Susun tab
  [TAB.TETAPAN, TAB.MURID, TAB.TUGASAN, TAB.HANTAR].forEach((n, i) => {
    ss.setActiveSheet(ss.getSheetByName(n)); ss.moveActiveSheet(i + 1);
  });
  const lalaiSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Helaian1');
  if (lalaiSheet && lalaiSheet.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(lalaiSheet);

  // --- TRIGGER automatik ---
  pasangTrigger_();

  kemaskiniSemuaRekod();
  ss.setActiveSheet(tm);

  maklum_('✅ Setup siap',
    'Langkah seterusnya:\n\n' +
    '1. Masukkan API Key OpenRouter (menu 2, atau Project Settings → Script Properties: OPENROUTER_API_KEY)\n' +
    '2. Isi nama murid di tab MURID\n' +
    '3. Deploy sebagai Web App (lihat panduan)\n' +
    '4. Tambah tugasan di tab TUGASAN dan set Status = BUKA');
}

/** Papar mesej: dialog jika dari Sheet, atau log jika dijalankan dari editor Apps Script. */
function maklum_(tajuk, mesej) {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert(tajuk, mesej, ui.ButtonSet.OK);
  } catch (e) {
    console.log(tajuk + '\n' + mesej);
  }
}

function pasangTrigger_() {
  const handler = ['prosesBarisMenunggu', 'kemaskiniSemuaRekod'];
  ScriptApp.getProjectTriggers().forEach(t => {
    if (handler.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('prosesBarisMenunggu').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('kemaskiniSemuaRekod').timeBased().everyDays(1).atHour(6).create();
}

function warnaPenghantaran_(sh) {
  const julat = sh.getRange(2, 1, sh.getMaxRows() - 1, H_HANTAR.length);
  const kol = (c) => String.fromCharCode(65 + c);
  const s = kol(C.SEMAKAN), m = kol(C.STATMASA);
  const r = (f, warna) => SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(f).setBackground(warna).setRanges([julat]).build();
  sh.setConditionalFormatRules([
    r('=$' + s + '2="' + ST.RALAT + '"', '#f4cccc'),
    r('=$' + s + '2="' + ST.SEMAK + '"', '#fff2cc'),
    r('=$' + s + '2="' + ST.MENUNGGU + '"', '#efefef'),
    r('=$' + m + '2="LEWAT"', '#fce5cd')
  ]);
}

function masukkanApiKey() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('API Key OpenRouter',
    'Dapatkan di https://openrouter.ai/keys (bermula dengan sk-or-...)\nTampal API key di bawah:',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const key = r.getResponseText().trim();
  if (!key) return ui.alert('API key kosong.');
  PropertiesService.getScriptProperties().setProperty(NAMA_KEY, key);
  ui.alert('✅ API key disimpan. Sekarang pilih menu "3. Uji sambungan AI".');
}

function ujiAI() {
  const masa = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm');
  const key = PropertiesService.getScriptProperties().getProperty(NAMA_KEY) || '';
  const infoKey = key ? 'API key dijumpai (' + key.length + ' aksara, bermula "' + key.slice(0, 4) + '…")'
                      : 'API key TIDAK dijumpai dalam Script Properties (nama mesti tepat: ' + NAMA_KEY + ')';
  let hasil;
  try {
    const t = panggilAI_([{ type: 'text', text: 'Balas JSON sahaja: {"ok": true, "mesej": "Sambungan berjaya"}' }]);
    hasil = '✅ AI berfungsi | ' + masa + ' | Model: ' + (getTetapan_('MODEL_AI') || '') + ' | Jawapan: ' + t;
  } catch (e) {
    hasil = '❌ Gagal | ' + masa + ' | ' + infoKey + ' | ' + e.message;
  }
  try { setTetapan_('UJIAN_AI_TERAKHIR', selamat_(hasil.slice(0, 900))); } catch (e) { }
  maklum_('Ujian AI', hasil);
}

function tunjukPautan() {
  let url = null;
  try { url = ScriptApp.getService().getUrl(); } catch (e) { }
  if (!url) {
    return SpreadsheetApp.getUi().alert('Belum di-deploy',
      'Buka Extensions → Apps Script → Deploy → New deployment → Web app.\nLihat panduan langkah 6.',
      SpreadsheetApp.getUi().ButtonSet.OK);
  }
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(url);
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;text-align:center">' +
    '<p>Kongsi pautan ini kepada murid (Classroom / WhatsApp):</p>' +
    '<input style="width:100%;padding:6px" value="' + url + '" onclick="this.select()" readonly>' +
    '<p><a href="' + url + '" target="_blank">Buka borang</a></p>' +
    '<img src="' + qr + '" width="260" height="260" alt="QR"><p style="font-size:12px">Klik kanan QR → Save image untuk cetak/tampal.</p></div>'
  ).setWidth(380).setHeight(470);
  SpreadsheetApp.getUi().showModalDialog(html, 'Pautan untuk murid');
}

/* ======================== WEB APP (MURID) ======================== */

function doGet() {
  const t = HtmlService.createTemplateFromFile('Borang');
  t.namaGuru = getTetapan_('NAMA_GURU') || '';
  return t.evaluate()
    .setTitle('Hantar Kerja Rumah')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Data untuk borang murid. Skema jawapan TIDAK dihantar ke pelayar. */
function getDataBorang() {
  const murid = muridIkutKelas_();
  const kelas = senaraiKelas_().filter(k => (murid[k] || []).length);
  const tugasan = bacaTugasan_()
    .filter(t => t.status === 'BUKA')
    .map(t => ({
      id: t.id, tajuk: t.tajuk, kelas: t.kelas, soalan: t.soalan, penuh: t.penuh,
      tarikhAkhir: t.tarikhAkhir ? Utilities.formatDate(t.tarikhAkhir, TZ, 'dd/MM/yyyy') : ''
    }));
  return { kelas, murid, tugasan, maksGambar: Number(getTetapan_('MAKS_GAMBAR')) || 5, namaGuru: getTetapan_('NAMA_GURU') || '' };
}

/**
 * API untuk antaramuka HTML luar (index.html yang dihoskan di Netlify/GitHub Pages, dll).
 * Permintaan: POST teks JSON {action: 'data' | 'hantar', data: {...}}
 * Jawapan:   {ok: true, hasil: ...}  atau  {ok: false, ralat: '...'}
 */
function doPost(e) {
  let jawapan;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.action === 'data') jawapan = { ok: true, hasil: getDataBorang() };
    else if (req.action === 'hantar') jawapan = { ok: true, hasil: hantarKerja(req.data) };
    else throw new Error('Tindakan tidak dikenali.');
  } catch (err) {
    jawapan = { ok: false, ralat: err && err.message ? err.message : String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(jawapan)).setMimeType(ContentService.MimeType.JSON);
}

/** Dipanggil oleh borang murid. p = {kelas, nama, idTugasan, gambar:[dataURL,...]} */
function hantarKerja(p) {
  if (!p || !p.kelas || !p.nama || !p.idTugasan) throw new Error('Maklumat tidak lengkap.');
  const kelas = norm_(p.kelas);
  const maks = Number(getTetapan_('MAKS_GAMBAR')) || 5;
  if (!p.gambar || !p.gambar.length) throw new Error('Sila pilih sekurang-kurangnya satu gambar.');
  if (p.gambar.length > maks) throw new Error('Maksimum ' + maks + ' gambar sahaja.');

  const t = bacaTugasan_().find(x => x.id === p.idTugasan);
  if (!t || t.status !== 'BUKA' || t.kelas.indexOf(kelas) < 0) {
    throw new Error('Tugasan ini tidak dibuka untuk kelas anda.');
  }
  if ((muridIkutKelas_()[kelas] || []).indexOf(p.nama) < 0) {
    throw new Error('Nama tidak dijumpai dalam senarai kelas.');
  }

  // Simpan gambar ke Drive
  const folder = folderTugasan_(kelas, t);
  const cap = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmm');
  const ids = [], urls = [];
  p.gambar.forEach((d, i) => {
    const m = String(d).match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (!m) throw new Error('Format gambar ke-' + (i + 1) + ' tidak sah.');
    const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1],
      p.nama + ' - ' + t.id + ' - ' + cap + ' - ' + (i + 1) + '.jpg');
    const f = folder.createFile(blob);
    ids.push(f.getId()); urls.push(f.getUrl());
  });

  const sekarang = new Date();
  const lewat = !!(t.tarikhAkhir && sekarang > akhirHari_(t.tarikhAkhir));
  let emel = '';
  try { emel = Session.getActiveUser().getEmail() || ''; } catch (e) { }
  const idH = Utilities.getUuid().slice(0, 8).toUpperCase();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = tab_(TAB.HANTAR);
    const ke = kiraHantaran_(sh, kelas, p.nama, t.id) + 1;
    const row = new Array(H_HANTAR.length).fill('');
    row[C.ID] = idH; row[C.MASA] = sekarang; row[C.KELAS] = kelas; row[C.NAMA] = p.nama;
    row[C.TUGAS] = t.id; row[C.TAJUK] = selamat_(t.tajuk); row[C.KE] = ke;
    row[C.STATMASA] = lewat ? 'LEWAT' : 'TEPAT MASA'; row[C.PENUH] = t.penuh;
    row[C.SEMAKAN] = ST.MENUNGGU; row[C.PAUTAN] = urls.join('\n'); row[C.FAIL] = ids.join(',');
    row[C.EMEL] = emel; row[C.CUBAAN] = 0;
    sh.appendRow(row);
    const b = sh.getLastRow();
    sh.getRange(b, C.AKHIR + 1).setFormulaR1C1('=IF(R[0]C[-1]<>"",R[0]C[-1],R[0]C[-3])');
    sh.getRange(b, C.PERATUS + 1).setFormulaR1C1('=IF(AND(ISNUMBER(R[0]C[-1]),R[0]C[-3]>0),R[0]C[-1]/R[0]C[-3],"")');
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // Semak terus (jika AI sibuk, akan diproses semula oleh trigger 10 minit)
  const h = semakBaris_(idH);
  try { kemaskiniRekodKelas_(kelas); } catch (e) { console.warn(e); }

  const tunjuk = String(getTetapan_('TUNJUK_MARKAH_KEPADA_MURID') || 'YA').toUpperCase() === 'YA';
  return {
    idHantaran: idH,
    lewat: lewat,
    status: h.status,
    tunjuk: tunjuk,
    markah: (tunjuk && h.status === ST.SIAP) ? h.markah : null,
    penuh: t.penuh,
    komen: (tunjuk && h.status === ST.SIAP) ? h.komen : ''
  };
}

/* ======================== SEMAKAN AI ======================== */

/** Semak satu hantaran berdasarkan ID. Pulangkan {status, markah, komen}. */
function semakBaris_(idH) {
  const sh = tab_(TAB.HANTAR);
  const b = cariBaris_(sh, idH);
  if (!b) return { status: ST.RALAT, markah: null, komen: '' };
  const r = sh.getRange(b, 1, 1, H_HANTAR.length).getValues()[0];
  const cubaan = (Number(r[C.CUBAAN]) || 0) + 1;
  sh.getRange(b, C.CUBAAN + 1).setValue(cubaan);

  try {
    const t = bacaTugasan_().find(x => x.id === String(r[C.TUGAS]));
    if (!t) throw new RalatKekal_('Tugasan ' + r[C.TUGAS] + ' tiada dalam tab TUGASAN.');
    const fail = String(r[C.FAIL]).split(',').filter(String);
    const hasil = nilaiDenganAI_(t, fail);

    const tulis = sh.getRange(b, 1, 1, H_HANTAR.length).getValues()[0];
    tulis[C.AI] = hasil.markah;
    tulis[C.KOMEN] = selamat_(hasil.komen);
    tulis[C.SEMAKAN] = hasil.perluSemak ? ST.SEMAK : ST.SIAP;
    tulis[C.CATATAN] = selamat_(hasil.catatan);
    // jangan tindih formula Markah Akhir & Peratus
    sh.getRange(b, C.AI + 1).setValue(tulis[C.AI]);
    sh.getRange(b, C.KOMEN + 1, 1, 3).setValues([[tulis[C.KOMEN], tulis[C.SEMAKAN], tulis[C.CATATAN]]]);
    return { status: tulis[C.SEMAKAN], markah: hasil.markah, komen: hasil.komen };
  } catch (e) {
    const kekal = (e instanceof RalatKekal_) || cubaan >= MAKS_CUBAAN;
    const st = kekal ? ST.RALAT : ST.MENUNGGU;
    sh.getRange(b, C.SEMAKAN + 1, 1, 2).setValues([[st, selamat_('Cubaan ' + cubaan + ': ' + e.message)]]);
    return { status: st, markah: null, komen: '' };
  }
}

function nilaiDenganAI_(t, idFail) {
  const subjek = t.kelas.some(k => k.indexOf('FIZIK') >= 0) ? 'Fizik (KSSM)' : 'Sains (KSSM)';
  const arahan =
    'Anda ialah guru ' + subjek + ' di sekolah menengah Malaysia yang menyemak kerja rumah murid.\n\n' +
    'TAJUK TUGASAN: ' + t.tajuk + '\n' +
    'SOALAN / ARAHAN:\n' + (t.soalan || '(tiada)') + '\n\n' +
    'SKEMA JAWAPAN & PERATURAN MARKAH:\n' + (t.skema || '(lihat fail skema yang dilampirkan)') + '\n\n' +
    'MARKAH PENUH: ' + t.penuh + '\n\n' +
    'PERATURAN MENYEMAK:\n' +
    '1. Beri markah berdasarkan skema sahaja. Beri markah separa jika skema membenarkan.\n' +
    '2. Terima jawapan yang betul dari segi sains walaupun ayat berbeza daripada skema.\n' +
    '3. Ikut peraturan skema tentang unit, formula dan jalan kerja.\n' +
    '4. Markah tidak boleh melebihi ' + t.penuh + ' dan tidak kurang daripada 0.\n' +
    '5. Jika gambar kabur, tiada kaitan dengan tugasan, kosong, atau sebahagian jawapan tidak dapat dibaca, ' +
    'nyatakan dalam "isu" dan set "keyakinan" kepada RENDAH.\n' +
    '6. Komen ditujukan kepada murid, dalam Bahasa Melayu, maksimum 3 ayat, membina: nyatakan apa yang betul dan apa yang perlu diperbaiki.\n\n' +
    'Balas dalam JSON SAHAJA dengan format:\n' +
    '{"markah": nombor, "komen": "...", "pecahan": "markah setiap soalan, cth S1: 3/3; S2: 1/3", ' +
    '"keyakinan": "TINGGI" | "SEDERHANA" | "RENDAH", "isu": "kosongkan jika tiada"}';

  const parts = [{ type: 'text', text: arahan }];

  if (t.failSkema) {
    const blobSkema = blobDariPautan_(t.failSkema);
    parts.push({ type: 'text', text: '=== FAIL SKEMA JAWAPAN GURU (BUKAN kerja murid) ===' });
    parts.push(bahagianFail_(blobSkema, 'skema'));
  }

  parts.push({ type: 'text', text: '=== KERJA MURID BERMULA (' + idFail.length + ' gambar, ikut turutan muka surat) ===' });
  idFail.forEach(id => parts.push(bahagianFail_(DriveApp.getFileById(id).getBlob(), 'kerja')));

  const teks = panggilAI_(parts);
  const j = hurai_(teks);

  let markah = Number(j.markah);
  if (!isFinite(markah)) throw new Error('AI tidak memberi markah yang sah: ' + teks.slice(0, 200));
  markah = Math.max(0, Math.min(t.penuh || markah, markah));
  markah = Math.round(markah * 2) / 2;

  const keyakinan = String(j.keyakinan || '').toUpperCase();
  const isu = String(j.isu || '').trim();
  return {
    markah: markah,
    komen: String(j.komen || '').trim(),
    perluSemak: keyakinan === 'RENDAH' || isu !== '',
    catatan: [j.pecahan ? 'Pecahan: ' + j.pecahan : '', 'Keyakinan: ' + (keyakinan || '-'), isu ? 'Isu: ' + isu : '']
      .filter(String).join('\n')
  };
}

/** Tukar fail Drive kepada format kandungan OpenRouter (gambar atau PDF). */
function bahagianFail_(blob, label) {
  const jenis = blob.getContentType() || 'image/jpeg';
  const data = 'data:' + jenis + ';base64,' + Utilities.base64Encode(blob.getBytes());
  if (jenis.indexOf('image/') === 0) return { type: 'image_url', image_url: { url: data } };
  if (jenis === 'application/pdf') return { type: 'file', file: { filename: label + '.pdf', file_data: data } };
  if (jenis.indexOf('text/') === 0) return { type: 'text', text: blob.getDataAsString() };
  throw new RalatKekal_('Jenis fail tidak disokong: ' + jenis + ' (guna gambar, PDF atau Google Doc).');
}

/** Panggil OpenRouter (API serasi OpenAI). parts = senarai kandungan mesej. */
function panggilAI_(parts) {
  const key = PropertiesService.getScriptProperties().getProperty(NAMA_KEY);
  if (!key) throw new RalatKekal_('API Key OpenRouter belum dimasukkan (Script Properties: ' + NAMA_KEY + ').');
  const model = String(getTetapan_('MODEL_AI') || 'google/gemini-2.5-flash').trim();
  const body = {
    model: model,
    temperature: 0,
    max_tokens: 1500,
    messages: [
      { role: 'system', content: 'Anda pemeriksa kerja rumah. Balas dalam JSON yang sah sahaja, tanpa teks lain dan tanpa ```.' },
      { role: 'user', content: parts }
    ]
  };
  for (let i = 0; i < 3; i++) {
    const res = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + key.trim(), 'X-Title': 'Sistem Kerja Rumah' },
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
    const kod = res.getResponseCode();
    const teks = res.getContentText();
    if (kod === 200) {
      const j = JSON.parse(teks);
      if (j.error) throw new Error('Ralat OpenRouter: ' + JSON.stringify(j.error).slice(0, 300));
      const c = (j.choices || [])[0];
      let out = c && c.message ? c.message.content : '';
      if (Array.isArray(out)) out = out.map(x => x.text || '').join('');
      if (!out) throw new Error('AI tidak memberi jawapan (' + (c ? c.finish_reason : 'kosong') + ')');
      return String(out).replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    }
    if (kod === 429 || kod >= 500) { Utilities.sleep(5000 * (i + 1)); continue; }
    if (kod === 401) throw new RalatKekal_('API key OpenRouter tidak sah (401). Semak semula key anda.');
    if (kod === 402) throw new RalatKekal_('Kredit OpenRouter tidak mencukupi (402). Tambah kredit di openrouter.ai/credits.');
    if (kod === 400 || kod === 403 || kod === 404) {
      throw new RalatKekal_('Ralat API ' + kod + ' (semak nama MODEL_AI di tab TETAPAN): ' + teks.slice(0, 300));
    }
    throw new Error('Ralat API ' + kod + ': ' + teks.slice(0, 300));
  }
  throw new Error('AI sibuk (had penggunaan). Akan dicuba semula secara automatik.');
}

/** Trigger setiap 10 minit: semak hantaran yang tertangguh (contoh: AI sibuk). */
function prosesBarisMenunggu() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) return;
  const mula = Date.now();
  const kelasTerjejas = {};
  try {
    const sh = tab_(TAB.HANTAR);
    const v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) {
      if (Date.now() - mula > 4.5 * 60 * 1000) break;
      const r = v[i];
      if (r[C.SEMAKAN] !== ST.MENUNGGU) continue;
      // beri ruang 3 minit kepada semakan langsung semasa murid hantar
      if (r[C.MASA] instanceof Date && Date.now() - r[C.MASA].getTime() < 3 * 60 * 1000) continue;
      semakBaris_(String(r[C.ID]));
      kelasTerjejas[r[C.KELAS]] = true;
    }
  } finally {
    lock.releaseLock();
  }
  Object.keys(kelasTerjejas).forEach(k => { try { kemaskiniRekodKelas_(k); } catch (e) { console.warn(e); } });
}

function semakSemulaBarisDipilih() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  if (sh.getName() !== TAB.HANTAR) return ui.alert('Pilih baris dalam tab PENGHANTARAN dahulu.');
  const julat = sh.getActiveRange();
  const kelas = {};
  let n = 0;
  for (let b = julat.getRow(); b < julat.getRow() + julat.getNumRows(); b++) {
    if (b < 2) continue;
    const id = String(sh.getRange(b, C.ID + 1).getValue());
    if (!id) continue;
    sh.getRange(b, C.CUBAAN + 1).setValue(0);
    sh.getRange(b, C.SEMAKAN + 1).setValue(ST.MENUNGGU);
    semakBaris_(id);
    kelas[sh.getRange(b, C.KELAS + 1).getValue()] = true;
    n++;
  }
  Object.keys(kelas).forEach(k => kemaskiniRekodKelas_(k));
  ui.alert(n + ' hantaran telah disemak semula.');
}

/* ======================== REKOD KELAS ======================== */

function kemaskiniSemuaRekod() {
  senaraiKelas_().forEach(k => kemaskiniRekodKelas_(k));
}

function kemaskiniRekodKelas_(kelas) {
  kelas = norm_(kelas);
  const ss = SpreadsheetApp.getActive();
  const murid = muridIkutKelas_()[kelas] || [];
  const tugasan = bacaTugasan_().filter(t => t.kelas.indexOf(kelas) >= 0 && !/^CONTOH/i.test(t.tajuk));
  const sekarang = new Date();

  // hantaran terkini bagi setiap murid + tugasan
  const terkini = {};
  const v = tab_(TAB.HANTAR).getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    if (norm_(r[C.KELAS]) !== kelas) continue;
    const k = r[C.NAMA] + '|' + r[C.TUGAS];
    if (!terkini[k] || r[C.MASA] >= terkini[k][C.MASA]) terkini[k] = r;
  }

  const nama = PREFIX_REKOD + kelas;
  let sh = ss.getSheetByName(nama);
  if (!sh) sh = ss.insertSheet(nama);
  sh.clear(); sh.clearConditionalFormatRules();

  const W = { HIJAU: '#d9ead3', JINGGA: '#fce5cd', KUNING: '#fff2cc', MERAH: '#f4cccc', KELABU: '#efefef', PUTIH: '#ffffff' };
  const header = ['Bil', 'Nama Murid'].concat(
    tugasan.map(t => t.id + '\n' + t.tajuk + '\n(/' + t.penuh + ')' +
      (t.tarikhAkhir ? '\n' + Utilities.formatDate(t.tarikhAkhir, TZ, 'dd/MM') : '')),
    ['Bil Hantar', '% Hantar', 'Purata Markah']);

  const nilai = [], warna = [];
  murid.forEach((m, idx) => {
    const baris = [idx + 1, m], w = [W.PUTIH, W.PUTIH];
    let hantar = 0, wajib = 0, jumPeratus = 0, bilMarkah = 0;
    tugasan.forEach(t => {
      const r = terkini[m + '|' + t.id];
      const tamat = t.tarikhAkhir && sekarang > akhirHari_(t.tarikhAkhir);
      if (r) {
        hantar++; wajib++;
        const akhir = r[C.GURU] !== '' ? Number(r[C.GURU]) : (r[C.AI] !== '' ? Number(r[C.AI]) : null);
        if (akhir !== null && isFinite(akhir)) {
          baris.push(akhir);
          if (t.penuh > 0) { jumPeratus += akhir / t.penuh; bilMarkah++; }
        } else {
          baris.push(r[C.SEMAKAN] === ST.MENUNGGU ? 'MENUNGGU' : 'SEMAK');
        }
        if (r[C.SEMAKAN] === ST.SEMAK || r[C.SEMAKAN] === ST.RALAT) w.push(r[C.GURU] !== '' ? W.HIJAU : W.KUNING);
        else if (r[C.SEMAKAN] === ST.MENUNGGU) w.push(W.KELABU);
        else w.push(r[C.STATMASA] === 'LEWAT' ? W.JINGGA : W.HIJAU);
      } else if (tamat) {
        wajib++;
        baris.push('TIDAK HANTAR'); w.push(W.MERAH);
      } else {
        baris.push(''); w.push(W.PUTIH);
      }
    });
    baris.push(hantar + '/' + wajib, wajib ? hantar / wajib : '', bilMarkah ? jumPeratus / bilMarkah : '');
    w.push(W.PUTIH, W.PUTIH, W.PUTIH);
    nilai.push(baris); warna.push(w);
  });

  // Tajuk
  sh.getRange(1, 1).setValue('REKOD KERJA RUMAH: ' + kelas).setFontSize(14).setFontWeight('bold');
  sh.getRange(2, 1).setValue('Dikemaskini: ' + Utilities.formatDate(sekarang, TZ, 'dd/MM/yyyy HH:mm') +
    '   |   Hijau = siap  •  Jingga = lewat  •  Kuning = perlu semakan guru  •  Merah = tidak hantar  •  Kelabu = menunggu AI');
  sh.getRange(2, 1).setFontColor('#666666');

  const lebar = header.length;
  sh.getRange(4, 1, 1, lebar).setValues([header]).setFontWeight('bold').setWrap(true)
    .setBackground('#cfe2f3').setVerticalAlignment('middle').setHorizontalAlignment('center');
  if (nilai.length) {
    const d = sh.getRange(5, 1, nilai.length, lebar);
    d.setValues(nilai).setBackgrounds(warna).setHorizontalAlignment('center');
    sh.getRange(5, 2, nilai.length, 1).setHorizontalAlignment('left');
    sh.getRange(5, lebar - 1, nilai.length, 2).setNumberFormat('0%');

    // Baris ringkasan setiap tugasan
    const ringkas = ['', 'Bil hantar'];
    tugasan.forEach((t, j) => {
      const kol = nilai.map(r => r[2 + j]);
      const n = kol.filter(x => x !== '' && x !== 'TIDAK HANTAR').length;
      ringkas.push(n + '/' + nilai.length);
    });
    ringkas.push('', '', '');
    sh.getRange(5 + nilai.length, 1, 1, lebar).setValues([ringkas]).setFontWeight('bold').setBackground('#eeeeee')
      .setHorizontalAlignment('center');
  } else {
    sh.getRange(5, 1).setValue('Tiada murid untuk kelas ini. Isi nama di tab MURID.');
  }
  sh.setFrozenRows(4); sh.setFrozenColumns(2);
  sh.setColumnWidth(1, 40); sh.setColumnWidth(2, 260);
  for (let c = 3; c <= lebar; c++) sh.setColumnWidth(c, 105);
  sh.setRowHeight(4, 80);
  sh.setTabColor('#6aa84f');
}

/** Bila guru isi "Markah Guru", kemaskini rekod kelas berkenaan. */
function onEdit(e) {
  try {
    const sh = e.range.getSheet();
    if (sh.getName() !== TAB.HANTAR || e.range.getColumn() !== C.GURU + 1 || e.range.getRow() < 2) return;
    const kelas = sh.getRange(e.range.getRow(), C.KELAS + 1).getValue();
    if (kelas) kemaskiniRekodKelas_(kelas);
  } catch (err) { console.warn(err); }
}

/* ======================== PEMBANTU ======================== */

function RalatKekal_(mesej) { this.message = mesej; this.name = 'RalatKekal'; }
RalatKekal_.prototype = Object.create(Error.prototype);

function tab_(nama) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nama);
  if (!sh) throw new Error('Tab "' + nama + '" tiada. Jalankan menu 📚 Kerja Rumah → 1. Setup sistem.');
  return sh;
}

function tabAtauBuat_(nama) {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(nama) || ss.insertSheet(nama);
}

function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }

/** Elak teks bermula dengan = + - @ dianggap formula */
function selamat_(s) {
  s = String(s == null ? '' : s);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function getTetapan_(kunci) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB.TETAPAN);
  if (!sh) return null;
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]).trim() === kunci) return String(v[i][1]);
  return null;
}

function setTetapan_(kunci, nilai) {
  const sh = tab_(TAB.TETAPAN);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === kunci) { sh.getRange(i + 1, 2).setValue(nilai); return; }
  }
  sh.appendRow([kunci, nilai, '']);
}

function senaraiKelas_() {
  const t = getTetapan_('SENARAI_KELAS');
  const dariTetapan = (t ? t.split(',') : KELAS_LALAI).map(norm_).filter(String);
  const dariMurid = Object.keys(muridIkutKelas_());
  dariMurid.forEach(k => { if (dariTetapan.indexOf(k) < 0) dariTetapan.push(k); });
  return dariTetapan;
}

function muridIkutKelas_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB.MURID);
  const out = {};
  if (!sh) return out;
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    const k = norm_(v[i][0]), n = String(v[i][1]).replace(/\s+/g, ' ').trim();
    if (!k || !n) continue;
    (out[k] = out[k] || []).push(n);
  }
  return out;
}

function bacaTugasan_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB.TUGASAN);
  if (!sh) return [];
  const v = sh.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    const id = String(r[0]).trim();
    if (!id) continue;
    let tarikh = null;
    if (r[7] instanceof Date) tarikh = r[7];
    else if (String(r[7]).trim()) { const d = new Date(r[7]); if (!isNaN(d)) tarikh = d; }
    out.push({
      id: id,
      kelas: String(r[1]).split(',').map(norm_).filter(String),
      tajuk: String(r[2]).trim(),
      soalan: String(r[3]).trim(),
      skema: String(r[4]).trim(),
      failSkema: String(r[5]).trim(),
      penuh: Number(r[6]) || 0,
      tarikhAkhir: tarikh,
      status: norm_(r[8]) || 'BUKA'
    });
  }
  return out;
}

/** Jika tarikh akhir tiada masa (00:00), anggap hingga 23:59:59 hari itu. */
function akhirHari_(d) {
  const x = new Date(d.getTime());
  if (x.getHours() === 0 && x.getMinutes() === 0) x.setHours(23, 59, 59, 999);
  return x;
}

function kiraHantaran_(sh, kelas, nama, idT) {
  const v = sh.getDataRange().getValues();
  let n = 0;
  for (let i = 1; i < v.length; i++) {
    if (norm_(v[i][C.KELAS]) === kelas && v[i][C.NAMA] === nama && String(v[i][C.TUGAS]) === idT) n++;
  }
  return n;
}

function cariBaris_(sh, idH) {
  const f = sh.getRange(1, C.ID + 1, sh.getLastRow(), 1).createTextFinder(idH).matchEntireCell(true).findNext();
  return f ? f.getRow() : null;
}

function folderUtama_() {
  const id = getTetapan_('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id.trim()); } catch (e) { } }
  const f = DriveApp.createFolder('Kerja Rumah Murid - Gambar (Sistem)');
  setTetapan_('FOLDER_ID', f.getId());
  return f;
}

function subFolder_(induk, nama) {
  const it = induk.getFoldersByName(nama);
  return it.hasNext() ? it.next() : induk.createFolder(nama);
}

function folderTugasan_(kelas, t) {
  return subFolder_(subFolder_(folderUtama_(), kelas), t.id + ' - ' + t.tajuk.slice(0, 60));
}

function blobDariPautan_(pautan) {
  const m = String(pautan).match(/[-\w]{25,}/);
  if (!m) throw new RalatKekal_('Pautan fail skema tidak sah: ' + pautan);
  const f = DriveApp.getFileById(m[0]);
  const jenis = f.getMimeType();
  const blob = jenis.indexOf('application/vnd.google-apps') === 0 ? f.getAs(MimeType.PDF) : f.getBlob();
  if (blob.getBytes().length > 15 * 1024 * 1024) throw new RalatKekal_('Fail skema terlalu besar (maks 15MB).');
  return blob;
}

function hurai_(teks) {
  try { return JSON.parse(teks); } catch (e) { }
  const m = String(teks).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) { } }
  throw new Error('Jawapan AI tidak dapat dibaca: ' + String(teks).slice(0, 200));
}
