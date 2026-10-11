# BDI Daily Quran & Hadis

Aplikasi PWA Android ultra-ringan (dioptimalkan khusus untuk perangkat dengan RAM terbatas seperti Vivo Y71) untuk menyusun database Hadis Shahih & Al-Quran berbantuan AI gratis, mengelola daftar kontak jamaah berdasarkan kategori format pesan, serta mengirim pesan dakwah harian maupun pengumuman manual secara otomatis melalui koneksi WhatsApp Headless (Baileys & Webhook API) dengan jeda waktu acak (*random interval*) anti-blokir.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Berikut adalah rangkuman keputusan arsitektur dan fitur berdasarkan jawaban Anda pada tahap klarifikasi sebelumnya:

- **Koneksi WhatsApp Headless Gratis**: Menggunakan mesin **Baileys** langsung di dalam server aplikasi (mendukung tautan nomor WhatsApp Admin melalui **Scan QR Code** maupun **8-Digit Pairing Code** langsung dari HP tanpa perlu 2 perangkat) ditambah dukungan **Custom Webhook / API Pihak Ketiga** sebagai opsi integrasi tambahan.
- **Pembuat Database Berbantuan AI**: Fokus utama pada **Hadis Shahih** (Bukhari, Muslim, Abu Dawud, Tirmidzi, Nasa'i, Ibnu Majah, Ahmad) yang dapat difilter berdasarkan tema/kriteria dan dilengkapi ringkasan serta intisari hikmah menggunakan **Gemini AI**, dengan struktur tabel yang sudah siap untuk ekspansi **Ayat Al-Quran** ke depannya.
- **Backup & Restore Data**: Menggunakan **Firebase Firestore** untuk sinkronisasi & pencadangan cloud satu klik serta fitur **Ekspor/Impor File JSON Lokal** ke penyimpanan HP untuk keamanan ganda.
- **Optimasi Perangkat Vivo Y71 (Mode Ringan + PWA)**: Antarmuka dibangun tanpa animasi berat, tanpa efek blur berlapis, dan hemat memori (RAM-friendly), serta dilengkapi **Web App Manifest & Tombol Install PWA** agar dapat diinstal layaknya aplikasi Android asli di layar utama Vivo Y71.

---

## 1. Overview & Core Concept

- **Apa yang Dilakukan Aplikasi Ini**: Menjadi pusat kendali siaran dakwah harian ("BDI Daily Quran & Hadis") yang mengotomatiskan pencarian materi hadis shahih, pemformatan teks singkat maupun detail, penjadwalan pengiriman berjangka (mengikuti jumlah database, bulanan, atau tahunan), hingga pelaporan status pengiriman per kontak.
- **Target Pengguna & Perangkat**: Admin dakwah BDI yang mengoperasikan aplikasi melalui smartphone Android (termasuk perangkat spesifikasi ringan seperti Vivo Y71 dengan layar HD+ dan RAM 2GB/3GB) maupun browser desktop.
- **Nilai Utama**:
  1. **Bebas Biaya Langganan API**: Koneksi langsung ke nomor WA Admin secara headless atau melalui webhook mandiri.
  2. **Keamanan Nomor WA (Anti-Ban)**: Algoritma jeda acak (*random delay interval* antara batas minimum dan maksimum detik yang ditentukan) untuk meniru perilaku pengiriman manusia.
  3. **Penyusunan Materi Cepat dengan AI**: Membuat puluhan data hadis shahih lengkap dengan teks Arab, terjemahan Indonesia, perawi, derajat hadis, dan ringkasan singkat secara otomatis sesuai topik yang diinginkan.

---

## 2. User Experience & Visual Design

### A. Alur Penggunaan Utama (Key User Flows)
1. **Koneksi WA Admin & Konfigurasi API**: Admin membuka tab *WA & API*, memasukkan nomor WA Admin, lalu memilih metode koneksi *Baileys Headless* (dengan menekan tombol *Tampilkan QR* atau *Minta Pairing Code*) atau memasukkan URL endpoint *Webhook API Eksternal*.
2. **Pembuatan & Kurasi Database Hadis (AI + Free API)**: Admin membuka tab *Database*, memasukkan kriteria pencarian (misal: *"Hadis Shahih Bukhari tentang keutamaan sedekah dan akhlak mulia, 5 hadis"*). Server mengambil referensi hadis shahih dan menggunakan Gemini AI untuk menyusun paket data lengkap (Judul, Teks Arab, Terjemah Lengkap, Ringkasan Singkat, Perawi, Nomor Hadis, Hikmah). Admin dapat melakukan *Preview*, mengedit teks, menghapus item yang kurang sesuai, atau menambah hadis/ayat secara manual sebelum menyimpannya ke database utama.
3. **Pengaturan Editor Format Kirim**: Admin membuka tab *Format Kirim*, menyusun template untuk **Format Lengkap (Detail)** dan **Format Singkat** menggunakan tombol sisip variabel cepat (`{judul}`, `{arab}`, `{terjemah}`, `{ringkasan}`, `{perawi}`, `{nomor_hadis}`, `{hikmah}`, `{nama_kontak}`, `{tanggal}`). Template dapat disimpan (*Save*), dimuat (*Load*), dan ditetapkan sebagai format aktif.
4. **Manajemen Kontak Berbasis Kategori**: Admin mengelola daftar penerima di tab *Kontak* (tambah manual, impor CSV/JSON, filter grup), di mana setiap kontak memiliki kategori **Penerima Hadis Singkat** atau **Penerima Hadis Detail**.
5. **Penjadwalan Otomatis & Kirim Manual**:
   - Pada mode *Jadwal Otomatis*, admin mengatur jam pengiriman harian, mode durasi (*Mengikuti Jumlah Database*, *Kurun Waktu Bulanan*, atau *Kurun Waktu Tahunan*), serta rentang jeda acak (misal: acak antara `15` hingga `45` detik antar pesan).
   - Pada mode *Kirim Manual*, admin menulis pengumuman atau pesan khusus, memilih target kontak (Semua, Kategori Singkat, Kategori Detail, atau pilih manual), dan mengirimkannya dengan proteksi jeda acak yang sama.
6. **Laporan & Backup Cloud**: Admin memantau antrean pengiriman secara langsung di tab *Laporan* (Berhasil, Gagal, Menunggu, beserta tombol *Kirim Ulang* untuk pesan gagal) dan mencadangkan seluruh data ke *Firebase Cloud* atau mengunduh file `.json` ke HP.

### B. Identitas Visual & Tema (Vivo Y71 Ultra-Light Mode)
- **Aesthetic Direction**: *Clean Islamic Utilitarian UI* — mengutamakan keterbacaan teks Arab dan Indonesia yang tajam, kontras tinggi di bawah cahaya luar ruangan, tanpa beban *gpu-blur* atau animasi transisi yang menguras RAM.
- **Color Palette & Mood**:
  - **60% Dominant Canvas**: Putih bersih (`#F8FAFC` / `slate-50`) dengan permukaan kartu putih (`#FFFFFF`) dan garis batas tipis (`1px solid #E2E8F0`) untuk meminimalkan pemakaian memori grafis.
  - **30% Structural Surfaces & Typography**: Teks utama arang gelap (`#0F172A` / `slate-900`) dan teks sekunder (`#475569` / `slate-600`).
  - **10% Accent Budget**: Hijau Zamrud BDI (`#047857` / `emerald-700`) untuk tombol aksi utama dan status aktif, dipadukan dengan indikator semantik jelas disertai label teks: Hijau (`#15803D` - Terkirim/Terhubung), Kuning Amber (`#B45309` - Menunggu/Antrean), dan Merah (`#B91C1C` - Gagal/Terputus).
- **Typography & Hierarchy**:
  - *Heading & UI*: `Plus Jakarta Sans` (tegas, modern, dan sangat mudah dibaca pada layar resolusi HD+ 720p seperti Vivo Y71).
  - *Arabic Script*: Font naskh standar sistem yang ringan (`Amiri` / `Traditional Arabic` / `sans-serif` dengan ukuran `18px–20px` dan `line-height: 1.9` agar harakat terlihat jelas).
  - *Numeric & Timestamps*: `JetBrains Mono` / `tabular-nums` untuk penghitung waktu mundur, jeda detik acak, nomor telepon, dan statistik laporan.
- **Tata Letak & Ergonomi Layar Sentuh**:
  - Seluruh tombol interaktif memiliki ukuran sentuh minimal `44x44px` agar nyaman dioperasikan satu tangan.
  - Navigasi bawah (*Bottom Navigation Bar*) pada tampilan mobile dengan 5 menu utama, dan otomatis meluas menjadi *Sidebar Navigation* + *Multi-Column Workspace* pada layar desktop.

---

## 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Arsitektur Pengiriman Pesan di Background Server + Anti-Ban Randomizer**
  - *Pendekatan Terpilih*: Mesin penjadwal (*Scheduler*) dan antrean pengiriman (*Message Queue*) berjalan di sisi server Node.js/Express, bukan hanya di tab browser. Setiap pesan dalam antrean diberikan waktu tunggu acak $\Delta t \in [\text{minDelay}, \text{maxDelay}]$ detik menggunakan distribusi acak merata sebelum dikirim ke setiap kontak.
  - *Alasan*: Jika pengguna menutup browser di Vivo Y71 untuk menghemat baterai, server tetap dapat mengeksekusi jadwal pengiriman dan mencatat log laporan tanpa terputus, sekaligus mencegah deteksi spam otomatis dari pihak WhatsApp.
- **Keputusan 2: Penyimpanan Hibrida (Server Local Store + Firebase Firestore Cloud Backup + File JSON)**
  - *Pendekatan Terpilih*: Data operasional harian disimpan secara cepat di penyimpanan persisten server & cache lokal agar penjadwal otomatis dapat membacanya setiap menit tanpa menguras kuota baca harian, sedangkan tombol **Backup & Restore Cloud** menyinkronkan seluruh koleksi data ke **Firebase Firestore** milik pengguna dan menyediakan unduhan file `.json`.
  - *Alasan*: Menjamin kecepatan instan di perangkat lama, hemat kuota internet, namun tetap aman di Cloud jika pengguna berganti perangkat.
- **Keputusan 3: Dual-Mode WhatsApp Engine (Baileys Built-in + Custom Webhook API)**
  - *Pendekatan Terpilih*: Menyediakan koneksi Baileys langsung (dengan QR & Pairing Code Nomor WA Admin) serta opsi pengalihan ke Webhook HTTP POST standar (`{ phone, message, apiKey }`) atau Mode Simulasi Uji Coba.
  - *Alasan*: Memberikan fleksibilitas penuh sesuai poin fitur ke-7 (Integrasi API Pihak Ketiga) dan poin ke-8 (Nomor WA Admin Headless) tanpa terkunci pada satu penyedia berbayar.

---

## 4. Technical Architecture & Data Strategy

### A. Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   BDI DAILY QURAN & HADIS (PWA ANDROID UI)                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │ 1. Database  │ │ 2. Format &  │ │ 3. Jadwal &  │ │ 4. Laporan, Backup │ │
│  │ Hadis & AI   │ │ Kontak WA    │ │ Kirim Manual │ │ Cloud & WA Admin   │ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └─────────┬──────────┘ │
└─────────┼────────────────┼────────────────┼───────────────────┼────────────┘
          │                │                │                   │
          ▼                ▼                ▼                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      EXPRESS BACKEND & SCHEDULER ENGINE                    │
│                                                                            │
│  ┌─────────────────────────┐    ┌────────────────────────────────────────┐ │
│  │  AI & Hadith Generator  │    │  Auto-Scheduler & Random Delay Queue   │ │
│  │  - Free Hadith API      │    │  - Cron Check (Per Menit)              │ │
│  │  - Gemini 3.8 Flash     │    │  - Durasi: Jml DB / Bulanan / Tahunan  │ │
│  │    (Ringkasan & Hikmah) │    │  - Random Interval [Min..Max Detik]    │ │
│  └─────────────────────────┘    └───────────────────┬────────────────────┘ │
│                                                     │                      │
│                                                     ▼                      │
│                                 ┌────────────────────────────────────────┐ │
│                                 │     WhatsApp Delivery Router           │ │
│                                 │  1. Baileys Headless (QR/Pairing Code) │ │
│                                 │  2. Custom Webhook API (HTTP POST)     │ │
│                                 └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┬──────────────────────┘
                                                      │
                                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE & CLOUD BACKUP LAYER                        │
│  [ Local Server JSON Store ]  ◄──Sync──►  [ Firebase Firestore Cloud ]     │
│                               ◄──File──►  [ Local Phone .JSON Export ]     │
└────────────────────────────────────────────────────────────────────────────┘
```

### B. Data Model & Entities

1. **`HadithItem` (Database Materi)**:
   - `id`, `type` (`'hadis'` | `'quran'`), `sourceBook` (misal: *HR. Bukhari*), `hadithNumber`, `title`, `arabicText`, `translationText` (untuk format detail), `shortSummary` (ringkasan padat hasil kurasi AI untuk penerima hadis singkat), `lessonText` (hikmah/faedah), `categoryTopic`, `sequenceOrder`, `isSent`, `createdAt`.
2. **`MessageTemplate` (Editor Format Kirim)**:
   - `id`, `name`, `category` (`'lengkap'` | `'singkat'` | `'pengumuman'`), `content` (teks template dengan variabel `{judul}`, `{arab}`, `{terjemah}`, `{ringkasan}`, `{perawi}`, `{nomor_hadis}`, `{hikmah}`, `{nama_kontak}`, `{tanggal}`), `isDefault`.
3. **`ContactItem` (Daftar Kontak)**:
   - `id`, `name`, `phone` (dinormalisasi otomatis ke format `628...`), `preference` (`'singkap'` | `'detail'`), `groupTag`, `isActive`, `notes`.
4. **`ScheduleConfig` (Konfigurasi Jadwal Otomatis)**:
   - `isEnabled`, `sendTime` (format `HH:mm`), `durationMode` (`'database_count'` | `'months'` | `'years'`), `durationValue` (angka bulan/tahun), `currentDatabaseIndex`, `minDelaySeconds` (default `15`), `maxDelaySeconds` (default `45`), `repeatWhenExhausted`.
5. **`DeliveryLog` (Laporan Pengiriman)**:
   - `id`, `batchId`, `contactId`, `contactName`, `contactPhone`, `contactPreference`, `hadithId`, `hadithTitle`, `messageType` (`'scheduled'` | `'manual'`), `renderedMessage`, `status` (`'queued'` | `'sending'` | `'sent'` | `'failed'`), `randomDelayAppliedSec`, `gatewayUsed` (`'baileys'` | `'webhook'`), `errorMessage`, `timestamp`.
6. **`GatewaySettings` (Koneksi WA Admin & Integrasi API)**:
   - `adminPhone`, `activeMode` (`'baileys'` | `'webhook'`), `connectionStatus` (`'disconnected'` | `'connecting'` | `'qr_ready'` | `'connected'`), `webhookUrl`, `webhookApiKey`, `webhookMethod`, `customHeaders`.

### C. Interactive Component & State Mapping

- **Tab 1: Database & AI Builder**:
  - Form generator AI dengan pilihan Kitab Hadis Shahih, input topik/kriteria, dan jumlah hadis yang ingin dibuat.
  - Tabel/Daftar Preview hasil generasi AI di mana pengguna bisa mengedit teks ringkasan/terjemahan, menghapus baris tertentu, atau menekan *Simpan ke Database Utama*.
  - Editor CRUD untuk melihat seluruh isi database yang sudah tersimpan, mencari hadis, mengedit, menghapus, atau menambah item baru secara manual.
- **Tab 2: Editor Format Kirim**:
  - Editor teks interaktif dengan chip variabel yang bisa diklik untuk menyisipkan placeholder ke posisi kursor.
  - Panel *Live Preview* berdampingan yang menampilkan hasil akhir pesan menggunakan sampel Hadis #1 dan nama kontak contoh, baik untuk versi **Lengkap (Detail)** maupun **Singkat**.
  - Manajemen preset template: simpan template baru, muat template tersimpan, dan tandai sebagai default untuk kategori *Singkat* atau *Detail*.
- **Tab 3: Kontak Jamaah**:
  - Filter instan berdasarkan kategori (*Semua*, *Penerima Singkat*, *Penerima Detail*), pencarian nama/nomor, tambah/edit kontak, impor massal (tempel daftar nama & nomor WA), serta pengubahan kategori cepat.
- **Tab 4: Kirim & Penjadwalan (Otomatis + Manual)**:
  - Sub-panel **Jadwal Otomatis**: Toggle aktif/nonaktif, pengatur waktu kirim harian, pemilih durasi (*Ikuti Jumlah Database*, *Bulanan*, *Tahunan*), pengatur *Random Interval* (Min Detik & Max Detik), serta tombol *Uji Jalan Jadwal Sekarang*.
  - Sub-panel **Kirim Pesan Manual**: Input pesan pengumuman/dakwah insidental (mendukung variabel `{nama_kontak}` dan `{tanggal}`), filter target penerima, estimasi total waktu pengiriman berdasarkan jeda acak, dan tombol *Mulai Kirim Antrean*.
- **Tab 5: Laporan, WA Admin & Cloud Backup**:
  - **Panel Nomor WA Admin & Integrasi API**: Pengaturan nomor WA Admin, koneksi headless Baileys (tampilan QR Code / Pairing Code 8 digit, tombol putuskan tautan), serta form konfigurasi Webhook API pihak ketiga beserta tombol *Tes Kirim Pesan ke Nomor Admin*.
  - **Panel Laporan Pengiriman**: Statistik ringkas (Total Antrean, Terkirim, Gagal, Menunggu), visualisasi antrean aktif lengkap dengan hitung mundur jeda acak per kontak, filter status laporan, dan tombol *Kirim Ulang (Retry)* untuk pesan yang gagal.
  - **Panel Backup & Restore**: Login Google satu klik untuk **Backup ke Cloud (Firebase Firestore)** & **Restore dari Cloud**, didampingi tombol **Ekspor File JSON** & **Impor File JSON** lokal.
