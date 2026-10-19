import { AppStoreData } from './types';

export const STANDALONE_DEFAULT_STORE: AppStoreData = {
  profiles: ['Oktober', 'Belum Terkategori'],
  contactGroups: ['Jamaah Umum', 'Pengurus BDI', 'Jamaah Reguler', 'Majelis Taklim', 'Remaja Masjid'],
  hadiths: [
    {
      id: 'hd-seed-1',
      type: 'hadis',
      profileName: 'Oktober',
      sourceBook: 'HR. Bukhari',
      sourceBookName: 'Shahih Al-Bukhari (Kitab Permulaan Wahyu)',
      hadithNumber: '1',
      hadithDegree: 'Shahih (Muttafaqun \'Alaih)',
      hadithLength: 'singkat',
      title: 'Segala Amal Tergantung pada Niatnya',
      arabicText: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
      translationText:
        'Sesungguhnya setiap amalan tergantung pada niatnya. Dan sesungguhnya setiap orang akan mendapatkan sesuai dengan apa yang ia niatkan.',
      asbabulWurud:
        "Diriwayatkan dari Amirul Mukminin Umar bin Khattab radhiyallahu 'anhu di atas mimbar Masjid Nabawi saat menjelaskan kemurnian niat hijrah karena Allah dan Rasul-Nya.",
      shortSummary:
        'Setiap amal ibadah dinilai berdasarkan keikhlasan niat di dalam hati karena Allah.',
      lessonText:
        "Ibadah dan amal shalih tidak bernilai pahala kecuali disertai niat yang ikhlas karena Allah Ta'ala semata.",
      categoryTopic: 'Ikhlas & Niat',
      sequenceOrder: 1,
      isSent: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'hd-seed-2',
      type: 'hadis',
      profileName: 'Oktober',
      sourceBook: 'HR. Muslim',
      sourceBookName: 'Shahih Muslim (Kitab Al-Birr wa Ash-Shilah)',
      hadithNumber: '2564',
      hadithDegree: 'Shahih',
      hadithLength: 'singkat',
      title: 'Allah Melihat Hati dan Amal Hamba-Nya',
      arabicText:
        'إِنَّ اللَّهَ لاَ يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ',
      translationText:
        'Sesungguhnya Allah tidak melihat kepada rupa kalian dan harta kalian, akan tetapi Allah melihat kepada hati kalian dan amal perbuatan kalian.',
      asbabulWurud:
        'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini disampaikan Rasulullah ﷺ sebagai tuntunan umum bagi kaum muslimin agar menjaga kebersihan hati.',
      shortSummary:
        'Kemuliaan seorang hamba di sisi Allah diukur dari ketakwaan hati dan amal shalihnya.',
      lessonText:
        'Fokus utama seorang mukmin adalah membersihkan hati dari penyakit riya dan memperbaiki kualitas amal.',
      categoryTopic: 'Tazkiyatun Nafs',
      sequenceOrder: 2,
      isSent: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'hd-seed-3',
      type: 'hadis',
      profileName: 'Belum Terkategori',
      sourceBook: 'HR. Tirmidzi',
      sourceBookName: 'Jami\' At-Tirmidzi (Kitab Al-Birr wa Ash-Shilah)',
      hadithNumber: '1956',
      hadithDegree: 'Hasan Shahih',
      hadithLength: 'singkat',
      title: 'Senyumanmu kepada Saudaramu adalah Sedekah',
      arabicText: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ',
      translationText:
        'Senyummu di hadapan saudaramu (sesama muslim) adalah bernilai sedekah bagimu.',
      asbabulWurud:
        'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini merupakan penjelasan Rasulullah ﷺ mengenai luasnya pintu-pintu kebaikan dan sedekah.',
      shortSummary:
        'Menebar wajah ramah dan senyuman tulus kepada sesama muslim tercatat sebagai pahala sedekah.',
      lessonText:
        'Berbuat kebaikan dan sedekah tidak harus selalu dengan harta, tetapi juga dengan akhlak mulia dan keramahan.',
      categoryTopic: 'Akhlak Mulia',
      sequenceOrder: 3,
      isSent: false,
      createdAt: new Date().toISOString(),
    },
  ],
  templates: [
    {
      id: 'tpl-lengkap-default',
      name: 'Format Hadis Lengkap (Detail + Asbabul Wurud)',
      category: 'lengkap',
      isDefault: true,
      content: `📖 *BDI DAILY QURAN & HADIS*
📅 {tanggal} | 📂 Profil: _{profil}_
Assalamu'alaikum *{nama_kontak}*,

*{judul}*
_({perawi} No. {nomor_hadis})_

{arab}

*Terjemah:*
"{terjemah}"

*Asbabul Wurud / Sebab Hadis:*
{asbabul_wurud}

💡 *Hikmah & Pelajaran Shahih:*
{hikmah}

_Semoga menjadi ilmu yang bermanfaat. Barakallahu fiikum._`,
    },
    {
      id: 'tpl-singkat-default',
      name: 'Format Hadis Singkat (Intisari Harian)',
      category: 'singkat',
      isDefault: true,
      content: `🌿 *MUTIARA HADIS BDI HARI INI*
📅 {tanggal}

Assalamu'alaikum *{nama_kontak}*,
*{judul}* ({perawi} No. {nomor_hadis})

📌 *Intisari:*
"{ringkasan}"

💡 *Pelajaran:* {hikmah}`,
    },
    {
      id: 'tpl-pengumuman',
      name: 'Format Pengumuman / Kajian BDI',
      category: 'pengumuman',
      isDefault: false,
      content: `📢 *INFORMASI BDI DAILY QURAN & HADIS*
📅 {tanggal}

Kepada Yth. *{nama_kontak}*,
{ringkasan}

_Admin BDI Daily_`,
    },
  ],
  templateVariables: [
    { id: 'var-judul', key: '{judul}', label: 'Judul Hadis/Ayat', defaultValue: '', isSystem: true },
    { id: 'var-arab', key: '{arab}', label: 'Teks Arab', defaultValue: '', isSystem: true },
    { id: 'var-terjemah', key: '{terjemah}', label: 'Terjemah Resmi (Kemenag/Kitab)', defaultValue: '', isSystem: true },
    { id: 'var-asbab', key: '{asbabul_wurud}', label: 'Asbabul Wurud (Sebab Hadis)', defaultValue: '', isSystem: true },
    { id: 'var-ringkasan', key: '{ringkasan}', label: 'Ringkasan Singkat', defaultValue: '', isSystem: true },
    { id: 'var-perawi', key: '{perawi}', label: 'Perawi Hadis', defaultValue: '', isSystem: true },
    { id: 'var-kitab', key: '{kitab}', label: 'Sumber Kitab Hadis/Tafsir', defaultValue: '', isSystem: true },
    { id: 'var-no', key: '{nomor_hadis}', label: 'Nomor Hadis (dari Kitab Sumber)', defaultValue: '', isSystem: true },
    { id: 'var-derajat', key: '{derajat_hadis}', label: 'Derajat Hadis', defaultValue: 'Shahih', isSystem: true },
    { id: 'var-hikmah', key: '{hikmah}', label: 'Hikmah & Pelajaran Shahih', defaultValue: '', isSystem: true },
    { id: 'var-profil', key: '{profil}', label: 'Nama Profil Database', defaultValue: '', isSystem: true },
    { id: 'var-nama', key: '{nama_kontak}', label: 'Nama Penerima', defaultValue: 'Sahabat BDI', isSystem: true },
    { id: 'var-tanggal', key: '{tanggal}', label: 'Tanggal Hari Ini', defaultValue: '', isSystem: true },
    {
      id: 'var-footer',
      key: '{footer_bdi}',
      label: 'Footer / Tanda Tangan BDI',
      defaultValue: 'BDI Daily Quran & Hadis — Tebar Ilmu Shahih Setiap Hari',
      isSystem: false,
    },
  ],
  contacts: [
    {
      id: 'ct-seed-1',
      name: 'Ustadz Ahmad Fauzi',
      phone: '6281234567801',
      preference: 'detail',
      groupTag: 'Pengurus BDI',
      isActive: true,
      notes: 'Penerima kajian lengkap',
    },
    {
      id: 'ct-seed-2',
      name: 'Bapak H. Hendra Wijaya',
      phone: '6281234567802',
      preference: 'singkat',
      groupTag: 'Jamaah Reguler',
      isActive: true,
      notes: 'Penerima intisari pagi',
    },
  ],
  projects: [
    {
      id: 'proj-default-1',
      name: 'BDI Projek Oktober Pagi',
      status: 'stopped',
      sendTime: '06:00',
      timezone: 'WITA',
      scheduleFrequency: 'daily',
      scheduleDays: [0, 1, 2, 3, 4, 5, 6],
      targetMode: 'all',
      targetGroups: [],
      targetContactIds: [],
      durationMode: 'database_count',
      durationValue: 1,
      startDate: new Date().toISOString().slice(0, 10),
      currentDatabaseIndex: 0,
      selectedProfiles: ['Oktober'],
      selectionOrder: 'sequential',
      minDelaySeconds: 12,
      maxDelaySeconds: 35,
      repeatWhenExhausted: true,
      lastTriggeredDate: '',
      totalSentCount: 0,
      createdAt: new Date().toISOString(),
    },
  ],
  projectHistory: [],
  schedule: {
    isEnabled: false,
    sendTime: '06:00',
    durationMode: 'database_count',
    durationValue: 1,
    startDate: new Date().toISOString().slice(0, 10),
    currentDatabaseIndex: 0,
    selectedProfiles: ['Oktober'],
    selectionOrder: 'sequential',
    minDelaySeconds: 12,
    maxDelaySeconds: 35,
    repeatWhenExhausted: true,
    lastTriggeredDate: '',
  },
  gatewaySettings: {
    adminPhone: '6281200000000',
    activeMode: 'baileys',
    webhookUrl: '',
    webhookApiKey: '',
    webhookMethod: 'POST',
    customHeaders: '',
    simulateIfOffline: false,
  },
  externalSync: {
    githubRepo: '',
    githubBranch: 'main',
    githubFilePath: 'backup/bdi-daily-hadis.json',
    githubToken: '',
    gsheetWebhookUrl: '',
    autoSyncCloud: true,
  },
  generationHistory: [],
  deliveryLogs: [],
};

export function loadStandaloneStore(): AppStoreData {
  try {
    const raw = localStorage.getItem('bdi_local_backup_snapshot');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.hadiths)) {
        return {
          ...STANDALONE_DEFAULT_STORE,
          ...parsed,
          profiles:
            Array.isArray(parsed.profiles) && parsed.profiles.length > 0
              ? parsed.profiles
              : STANDALONE_DEFAULT_STORE.profiles,
          templateVariables:
            Array.isArray(parsed.templateVariables) && parsed.templateVariables.length > 0
              ? parsed.templateVariables
              : STANDALONE_DEFAULT_STORE.templateVariables,
        };
      }
    }
  } catch {
    // ignore
  }
  return STANDALONE_DEFAULT_STORE;
}

export function saveStandaloneStore(store: AppStoreData): void {
  try {
    const nowText = new Date().toLocaleString('id-ID');
    localStorage.setItem('bdi_local_backup_snapshot', JSON.stringify(store));
    localStorage.setItem('bdi_local_backup_time', nowText);
  } catch {
    // ignore
  }
}
