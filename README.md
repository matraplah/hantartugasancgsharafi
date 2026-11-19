# Panduan Sistem Kerja Rumah + Semakan AI

**Google Sheet anda:** https://docs.google.com/spreadsheets/d/1eGaLR4hx9KhOHgBp7_MD5qcUgoT5eqecds_1Py_MuY4/edit

Fail kod:
- `Kod.gs`: kod utama
- `Borang.html`: borang upload untuk murid

---

## BAHAGIAN A: PEMASANGAN (sekali sahaja, ±20 minit)

### Langkah 1: Masukkan kod
1. Buka Google Sheet di atas (log masuk akaun DELIMa).
2. Klik menu **Extensions → Apps Script**.
3. Tukar nama projek (kiri atas, "Untitled project") kepada **Sistem Kerja Rumah**.
4. Dalam fail `Code.gs`, **padam semua** isi asal. Kemudian **salin dan tampal** semua isi `Kod.gs`.
5. Klik **+** (sebelah "Files") → **HTML** → namakan **`Borang`** (tanpa .html, huruf B besar).
   Padam isi asal, kemudian tampal semua isi `Borang.html`.
6. Klik 💾 **Save** (Ctrl+S).

### Langkah 2: Jalankan setup
1. Kembali ke tab Google Sheet dan **refresh** halaman.
2. Menu baharu **📚 Kerja Rumah** akan muncul (tunggu 5–10 saat).
3. Klik **📚 Kerja Rumah → 1. Setup sistem (kali pertama)**.
4. Google akan minta kebenaran:
   **Continue → pilih akaun anda → Advanced → Go to Sistem Kerja Rumah (unsafe) → Allow**.
   (Mesej "unsafe" itu normal kerana skrip ini anda sendiri yang buat.)
5. Klik menu Setup sekali lagi jika ia berhenti selepas pemberian kebenaran.
6. Tab berikut akan wujud: TETAPAN, MURID, TUGASAN, PENGHANTARAN, dan REKOD untuk setiap kelas.

### Langkah 3: Dapatkan API Key Gemini (percuma)
1. Buka **https://aistudio.google.com/apikey**.
   - Jika akaun DELIMa disekat, guna **Gmail peribadi** untuk langkah ini sahaja.
2. Klik **Create API key** dan salin kunci itu.
3. Dalam Sheet: **📚 Kerja Rumah → 2. Masukkan API Key Gemini** → tampal → OK.
4. **📚 Kerja Rumah → 3. Uji sambungan AI**. Mesej "✅ AI berfungsi" sepatutnya keluar.

### Langkah 4: Isi tab TETAPAN
- `NAMA_GURU`: contoh "Cikgu (nama anda) – Fizik & Sains".
- `TUNJUK_MARKAH_KEPADA_MURID`: **YA** (murid nampak markah serta-merta) atau **TIDAK**.

### Langkah 5: Isi nama murid (tab MURID)
| Kelas | Nama Murid |
|---|---|
| FIZIK 4 SAINS | AHMAD BIN ALI |
| SAINS 3 DAISY | SITI NUR AISYAH |

Tip: salin senarai nama dari APDM/IDME/Excel dan tampal ke lajur B. Pilih kelas di lajur A menggunakan dropdown.

### Langkah 6: Deploy borang murid (Web App)
1. Dalam Apps Script, klik **Deploy → New deployment**.
2. Klik ⚙️ (Select type) → **Web app**.
3. Isikan:
   - Description: `v1`
   - **Execute as: Me**
   - **Who has access**: pilih salah satu:
     - **Anyone within moe-dl.edu.my** (disyorkan). Murid mesti log masuk DELIMa, dan e-mel mereka direkod, jadi murid sukar menghantar atas nama orang lain.
     - **Anyone**. Murid tak perlu log masuk (lebih mudah), tetapi sesiapa yang ada pautan boleh menghantar.
4. Klik **Deploy** dan salin **Web app URL**.
5. Dalam Sheet: **📚 Kerja Rumah → Tunjuk pautan & QR untuk murid**. Kongsi pautan atau QR di Google Classroom, WhatsApp kelas, atau cetak dan tampal dalam kelas.

> ⚠️ **PENTING:** Jika anda ubah kod selepas ini, pergi ke **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. Jika tidak, murid masih guna versi lama. Pautan tidak berubah.

---

## BAHAGIAN B: PENGGUNAAN HARIAN

### Beri kerja rumah (±3 minit setiap tugasan)
Tambah satu baris dalam tab **TUGASAN**:

| Lajur | Contoh |
|---|---|
| ID Tugasan | `F4-T05` (mesti unik) |
| Kelas | `SAINS 3 ALAMANDA, SAINS 3 DAISY, SAINS 3 JASMINE` (satu tugasan boleh untuk beberapa kelas) |
| Tajuk | Haba – Latihan 3.2 |
| Soalan / Arahan | Jawab soalan 1–4 m/s 45 buku teks |
| Skema Jawapan | (lihat tip di bawah) |
| Pautan Fail Skema | Pilihan: pautan Drive ke PDF/gambar/Google Doc skema |
| Markah Penuh | 10 |
| Tarikh Akhir | 25/11/2026 |
| Status | **BUKA** (murid boleh hantar) / **TUTUP** |

Murid buka pautan, pilih **kelas → nama → tugasan**, ambil gambar buku, dan tekan **Hantar**. AI akan menyemak dalam 20–60 saat.

### Apa yang automatik
- ✅ Gambar disimpan dalam Drive: `Kerja Rumah Murid - Gambar (Sistem) / KELAS / TUGASAN`.
- ✅ Markah dan komen AI masuk ke tab **PENGHANTARAN**.
- ✅ Status **TEPAT MASA / LEWAT** dikesan sendiri.
- ✅ Tab **REKOD <KELAS>** dikemaskini: hijau (siap), jingga (lewat), kuning (perlu semakan guru), merah (**TIDAK HANTAR** selepas tarikh akhir).
- ✅ Jika AI sibuk, sistem cuba semula setiap 10 minit.
- ✅ Rekod disegarkan setiap pagi jam 6.

### Tugas guru (±10 minit seminggu)
1. Buka tab **PENGHANTARAN** dan tapis lajur *Status Semakan* = **PERLU SEMAK GURU** (kuning).
   Klik pautan gambar untuk lihat kerja murid.
2. Jika tidak setuju dengan markah AI, taip markah baharu di lajur **Markah Guru**. Rekod dikemaskini serta-merta.
3. Semak rawak 2–3 hantaran "SIAP (AI)" setiap minggu untuk pastikan AI konsisten.
4. Buka tab **REKOD** untuk lihat siapa yang tidak hantar.

### Tip menulis skema supaya AI tepat
- Pecahkan markah setiap soalan: `S1 (3m): formula [1m], gantian [1m], jawapan + unit [1m]`.
- Nyatakan peraturan: "Tolak 1m jika tiada unit", "Terima jawapan setara", "Mesti ada jalan kerja".
- Untuk soalan terbuka (KBAT), senaraikan **isi-isi utama** yang diterima.
- Boleh juga tangkap gambar skema bertulis tangan, upload ke Drive, dan tampal pautannya di lajur *Pautan Fail Skema*.
  (Pastikan fail itu dalam Drive anda sendiri.)

### Pesanan kepada murid
- Ambil gambar **tegak, terang, tidak kabur**, satu muka surat setiap gambar.
- Tulis **nombor soalan** dengan jelas.
- Boleh hantar semula jika silap. Sistem mengambil **hantaran terkini**.

---

## BAHAGIAN C: MASALAH BIASA

| Masalah | Penyelesaian |
|---|---|
| Menu 📚 tak muncul | Refresh Sheet, tunggu 10 saat |
| "Ralat API 400/403" | API key salah. Ulang Langkah 3 |
| "Ralat API 404" | Nama model lama. Tukar `MODEL_AI` di TETAPAN kepada model Gemini terkini (contoh `gemini-2.5-flash`) |
| Banyak status MENUNGGU | Had percuma Gemini (lebih kurang 10 semakan seminit). Sistem akan proses sendiri setiap 10 minit, atau klik menu *Proses semakan yang tertangguh* |
| Murid tak nampak tugasan | Status mesti **BUKA** dan nama kelas mesti sama dengan tab MURID |
| Murid tak nampak nama | Nama belum diisi di tab MURID untuk kelas itu |
| Ubah kod tapi tiada kesan | Deploy → Manage deployments → Edit → **New version** |
| Mahu semak semula baris | Pilih baris di PENGHANTARAN → menu *Semak semula baris dipilih* |

### Privasi
- Nama murid **tidak** dihantar kepada AI. Hanya gambar kerja, soalan dan skema yang dihantar.
- API Gemini **percuma**: Google boleh menggunakan data untuk menambah baik produk mereka. Jika sekolah mahu lebih ketat,
  aktifkan bil (berbayar, kos sangat rendah) di AI Studio. Data akaun berbayar tidak digunakan untuk latihan.
- Gambar disimpan dalam Drive anda sahaja.

### Tahun baru / kelas baru
Tukar `SENARAI_KELAS` di TETAPAN, kemas kini tab MURID, kemudian jalankan menu *Kemaskini semua tab REKOD*.
Atau buat salinan Sheet (File → Make a copy). Kod ikut disalin, tetapi anda perlu deploy semula.
