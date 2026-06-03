/**
 * PEER REVIEW — event_pools.js
 * 55 random event tanımı — GDD v3.0 §8 Random Event Sistemi.
 * Dünya (15) + Kurum (12) + Araştırma (15) + Kişisel (13) = 55 event.
 * Saf veri — hiçbir oyun state'ine doğrudan bağımlılık yok.
 */

'use strict';

// ─── DÜNYA OLAYLARI (15) ─────────────────────────────────────────────────────
// GDD v3.0 §8.2

export const WORLD_EVENTS = [
  {
    id:       'W01',
    label:    'Küresel Salgın İlan Edildi',
    description: 'Dünya Sağlık Örgütü yeni bir pandemi ilan etti. Tıp araştırmalarına acil fon akışı başlıyor, diğer alanlar bütçe kısıtıyla karşı karşıya.',
    condition: () => true,   // her zaman tetiklenebilir
    weight:   1,
    choices: [
      {
        id:    'pivot_medicine',
        label: 'Tıp Araştırmasına Yönel',
        description: 'Mevcut proje kapasitesini tıp alanına kaydır.',
        effect: { type: 'field_boost', field: 'medicine', mult: 3.0, weeks: 24 },
      },
      {
        id:    'stay_course',
        label: 'Mevcut Rotayı Koru',
        description: 'Etkilenmeden devam et.',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'W02',
    label:    'İklim Zirvesi Kararları',
    description: 'Uluslararası iklim zirvesi bağlayıcı kararlar aldı. Çevre araştırmalarına prestij ve fon akışı artıyor.',
    condition: (s) => s.time.year >= 5,
    weight:   1,
    choices: [
      {
        id:    'climate_collab',
        label: 'İklim İşbirliğine Katıl',
        description: '+25 prestij, iklim projesine 2x fon.',
        effect: { type: 'prestige_gain', amount: 25, fieldBoost: 'climate' },
      },
      {
        id:    'observe',
        label: 'Gözlemle',
        description: 'Fırsatı izle.',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'W03',
    label:    'Ekonomik Resesyon',
    description: 'Küresel ekonomik kriz derinleşiyor. Tüm araştırma fonları %30 azaldı.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'cut_costs',
        label: 'Maliyetleri Kıs',
        description: 'Araştırmacı saatlerini geçici azalt, bütçeyi koru.',
        effect: { type: 'cost_cut', pct: 0.20 },
      },
      {
        id:    'apply_emergency',
        label: 'Acil Fon Başvurusu Yap',
        description: 'Acil Bilim Fonu başvurusu aç.',
        effect: { type: 'open_grant', grantId: 'emergency_science' },
      },
    ],
  },
  {
    id:       'W04',
    label:    'Teknoloji Devrimi Haberi',
    description: 'Yeni bir teknolojik kırılım duyuruldu. Fizik ve kimya alanlarına özel hibe penceresi açıldı.',
    condition: (s) => s.time.year >= 3,
    weight:   1,
    choices: [
      {
        id:    'apply_tech_grant',
        label: 'Hibe Başvurusu Yap',
        description: 'Bağımsız Teknoloji Vakfı hibesine başvur.',
        effect: { type: 'open_grant', grantId: 'independent_tech' },
      },
      {
        id:    'pass',
        label: 'Geç',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'W05',
    label:    'Uluslararası Gerilim',
    description: 'Jeopolitik kriz tırmandı. Uluslararası işbirliği projeleri 8 hafta boyunca donduruldu.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'acknowledge',
        label: 'Tamam',
        description: 'İşbirliği projelerini geçici duraklat.',
        effect: { type: 'freeze_collab', weeks: 8 },
      },
    ],
  },
  {
    id:       'W06',
    label:    'Rakip Nobel Kazandı',
    description: 'Rakip bir kurum Nobel Ödülü kazandı. Prestijiniz -5 düşüyor ancak o alandaki fonlar artıyor.',
    condition: (s) => s.time.year >= 8,
    weight:   1,
    choices: [
      {
        id:    'respond',
        label: 'Çalışmaya Hızlan',
        description: 'Rakibin alanında araştırma bütçesini artır.',
        effect: { type: 'prestige_hit', amount: -5, fieldBoostRandom: true },
      },
      {
        id:    'ignore',
        label: 'Görmezden Gel',
        effect: { type: 'prestige_hit', amount: -5 },
      },
    ],
  },
  {
    id:       'W07',
    label:    'Yeni Araştırma Teknolojisi',
    description: 'Devrim niteliğinde yeni bir araştırma teknolojisi duyuruldu. Rastgele bir ekipmanınız %20 daha verimli hale geldi.',
    condition: (s) => s.lab.equipment.length > 0,
    weight:   1,
    choices: [
      {
        id:    'acknowledge',
        label: 'Harika!',
        effect: { type: 'equipment_boost', pct: 0.20 },
      },
    ],
  },
  {
    id:       'W08',
    label:    'Veri Gizliliği Yasası',
    description: 'Yeni veri gizliliği mevzuatı yürürlüğe girdi. Etik kontroller sıkılaştı, veri toplama fazları daha dikkatli yürütülmeli.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'comply',
        label: 'Uyum Sağla',
        description: 'Etik kontrolleri güçlendir, retraction riski azalır.',
        effect: { type: 'ethics_boost', amount: 10 },
      },
      {
        id:    'ignore',
        label: 'Görmezden Gel',
        description: 'Risk artabilir.',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'W09',
    label:    'Sağlık Krizi Haberi',
    description: 'Bölgesel sağlık krizi manşetlerde. Tıp alanına acil fon açıldı.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'apply',
        label: 'Acil Fon Başvurusu Yap',
        effect: { type: 'open_grant', grantId: 'emergency_science' },
      },
      {
        id:    'pass',
        label: 'Geç',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'W10',
    label:    'Barış Görüşmeleri',
    description: 'Büyük güçler arasında tarihi barış görüşmeleri başladı. Barış araştırması 2x prestij kazanıyor.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'acknowledge',
        label: 'Fırsatı Değerlendir',
        effect: { type: 'field_boost', field: 'peace', mult: 2.0, weeks: 12 },
      },
    ],
  },
  {
    id:       'W11',
    label:    'Uzay Keşfi',
    description: 'İnsanlığın ilk derin uzay keşfi duyuruldu! Fizik alanında heyecan dorukta, yeni araştırmacı başvuruları artıyor.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'recruit_wave',
        label: 'Yeni Araştırmacıları Değerlendir',
        description: 'İşe alma havuzuna 2 ekstra fizik araştırmacısı eklenir.',
        effect: { type: 'extra_candidates', field: 'physics', count: 2 },
      },
      {
        id:    'pass',
        label: 'Geç',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'W12',
    label:    'Nüfus Sağlığı Raporu',
    description: 'Küresel nüfus sağlığı raporu ciddi bulgular ortaya koydu. Tıp alanı fon artışı başladı.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'apply_national',
        label: 'Ulusal Fon Başvurusu Yap',
        effect: { type: 'open_grant', grantId: 'national_science' },
      },
      {
        id:    'pass',
        label: 'Geç',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'W13',
    label:    'Enerji Krizi',
    description: 'Küresel enerji krizi derinleşiyor. Kimya ve fizik alanlarına acil araştırma hibesi açıldı.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'apply',
        label: 'Acil Hibe Başvurusu Yap',
        effect: { type: 'open_grant', grantId: 'emergency_science' },
      },
      {
        id:    'pass',
        label: 'Geç',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'W14',
    label:    'Akademik Özgürlük Tartışması',
    description: 'Uluslararası akademik özgürlük tartışması medyada. Prestijli bir araştırmacı yeni lab arıyor.',
    condition: (s) => s.lab.level >= 2,
    weight:   1,
    choices: [
      {
        id:    'recruit',
        label: 'İletişime Geç',
        description: 'Senior araştırmacı adayı eklenir.',
        effect: { type: 'extra_candidates', careerStage: 'senior', count: 1 },
      },
      {
        id:    'pass',
        label: 'Geç',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'W15',
    label:    'Küresel Araştırma Zirvesi',
    description: 'Yılın en büyük akademik zirvesi kapılarını açtı. İşbirliği fırsatları %50 artıyor.',
    condition: (s) => s.time.year >= 5,
    weight:   1,
    choices: [
      {
        id:    'attend',
        label: 'Zirveye Katıl',
        description: 'İşbirliği proje şansı artır, +15 prestij.',
        effect: { type: 'prestige_gain', amount: 15, collabBoost: true },
      },
      {
        id:    'skip',
        label: 'Katılma',
        effect: { type: 'none' },
      },
    ],
  },
];

// ─── KURUM OLAYLARI (12) ─────────────────────────────────────────────────────
// GDD v3.0 §8.3

export const INSTITUTION_EVENTS = [
  {
    id:       'I01',
    label:    'Rektör Değişti',
    description: 'Üniversitede yönetim değişikliği. Yeni rektörün araştırma politikası bütçenizi etkileyebilir.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'positive',
        label: 'Desteğini Kazan',
        description: 'Bütçe %20 artabilir.',
        effect: { type: 'budget_random', pct: 0.20 },
      },
      {
        id:    'wait',
        label: 'Bekle ve Gör',
        effect: { type: 'budget_random', pct: -0.10 },
      },
    ],
  },
  {
    id:       'I02',
    label:    'Akreditasyon Denetimi',
    description: 'Üniversite akreditasyon komisyonu laboratuvarınızı denetleyecek. 2 hafta araştırma faaliyetleri yavaşlıyor.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'prepare',
        label: 'Hazırlan',
        description: '2 hafta ara, denetim başarıyla geçilir. Prestij +10.',
        effect: { type: 'pause_and_prestige', weeks: 2, prestige: 10 },
      },
      {
        id:    'continue',
        label: 'Devam Et',
        description: 'Denetim riski — başarısız olursa prestij -15.',
        effect: { type: 'audit_risk', successPrestige: 5, failPrestige: -15 },
      },
    ],
  },
  {
    id:       'I03',
    label:    'Ulusal Medyada Haber',
    description: 'Araştırmanız ulusal medyada geniş yer buldu! Prestij artıyor, fon başvuruları kolaylaşıyor.',
    condition: (s) => s.stats.totalPublications >= 2,
    weight:   1,
    choices: [
      {
        id:    'acknowledge',
        label: 'Teşekkür Et',
        effect: { type: 'prestige_gain', amount: 25 },
      },
    ],
  },
  {
    id:       'I04',
    label:    'Başka Kurumda Skandal',
    description: 'Rakip kurumda büyük araştırma skandalı patlak verdi. O alandaki fonlar size yönelecek.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'capitalize',
        label: 'Fırsatı Değerlendir',
        description: 'O alanda hibe başvurusu yap.',
        effect: { type: 'open_grant', grantId: 'national_science' },
      },
      {
        id:    'pass',
        label: 'Geç',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'I05',
    label:    'Yeni Bina Teklifi',
    description: 'Üniversite yönetimi yeni bir laboratuvar binası teklif ediyor. 4 hafta inşaat gürültüsü ama kapasitesi büyük artacak.',
    condition: (s) => s.lab.level < 5,
    weight:   1,
    choices: [
      {
        id:    'accept',
        label: 'Kabul Et',
        description: '4 hafta -%20 verim, ardından lab seviyesi +1.',
        effect: { type: 'lab_upgrade', disruption: 4 },
      },
      {
        id:    'decline',
        label: 'Reddet',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'I06',
    label:    'Bütçe Denetimi',
    description: 'Mali denetim başladı. Harcamalar sorgulanıyor, 2 hafta bazı ödemeler askıya alınabilir.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'cooperate',
        label: 'İşbirliği Yap',
        description: 'Şeffaf davran — kısa süreli aksama, sorun yok.',
        effect: { type: 'none' },
      },
      {
        id:    'resist',
        label: 'İtiraz Et',
        description: 'Prestij riski ama hız kaybı yok.',
        effect: { type: 'prestige_risk', loss: 10 },
      },
    ],
  },
  {
    id:       'I07',
    label:    'Üniversite Sıralama Artışı',
    description: 'Üniversiteniz uluslararası sıralamada büyük sıçrama yaptı. Prestij +15, yeni araştırmacı başvuruları geliyor.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'acknowledge',
        label: 'Harika!',
        effect: { type: 'prestige_gain', amount: 15, extraCandidate: true },
      },
    ],
  },
  {
    id:       'I08',
    label:    'Ekipman Bağışı',
    description: 'Bir hayırsever kurumdan ekipman bağışı geldi! Rastgele bir ekipman ücretsiz laboratuvarınıza ekleniyor.',
    condition: () => true,
    weight:   1,
    choices: [
      {
        id:    'accept',
        label: 'Kabul Et',
        effect: { type: 'free_equipment' },
      },
    ],
  },
  {
    id:       'I09',
    label:    'Yangın / Su Baskını',
    description: 'Laboratuvarda küçük çaplı yangın ya da su baskını meydana geldi. Bir ekipman hasar gördü.',
    condition: (s) => s.lab.equipment.length > 0,
    weight:   1,
    choices: [
      {
        id:    'repair_now',
        label: 'Hemen Onar',
        description: 'Ekipmanı acil onar — bütçeden %15 maliyet.',
        effect: { type: 'emergency_repair', costPct: 0.15 },
      },
      {
        id:    'wait',
        label: 'Sonra Onar',
        description: 'Hasar büyüyebilir.',
        effect: { type: 'equipment_damage' },
      },
    ],
  },
  {
    id:       'I10',
    label:    'Özel Bağışçı Ziyareti',
    description: 'Büyük bir hayırsever laboratuvarınızı ziyaret ediyor. Etkilenirse önemli koşullu bağış yapabilir.',
    condition: (s) => s.lab.prestige >= 100,
    weight:   1,
    choices: [
      {
        id:    'impress',
        label: 'En İyi Çalışmanı Göster',
        description: 'Prestij yeterliyse büyük bağış: +3000.',
        effect: { type: 'conditional_donation', minPrestige: 200, amount: 3000 },
      },
      {
        id:    'routine',
        label: 'Rutin Karşıla',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'I11',
    label:    'Rakip Kurum İşbirliği Teklifi',
    description: 'Bir rakip kurum ortak proje teklifi sunuyor. Maliyet paylaşımlı, ama kredi de paylaşılacak.',
    condition: (s) => s.projects.active.length < 4,
    weight:   1,
    choices: [
      {
        id:    'accept_collab',
        label: 'İşbirliği Projesine Başla',
        description: 'Yeni işbirliği projesi aktif projelere eklenir.',
        effect: { type: 'start_collab_project' },
      },
      {
        id:    'decline',
        label: 'Reddet',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'I12',
    label:    'Alumni Bağışı',
    description: 'Eski bir mezununuz küçük ama koşulsuz bağış yapıyor.',
    condition: () => true,
    weight:   2,   // daha sık gelir
    choices: [
      {
        id:    'accept',
        label: 'Teşekkür Et',
        effect: { type: 'budget_gain', amount: 500 },
      },
    ],
  },
];

// ─── ARAŞTIRMA OLAYLARI (15) ──────────────────────────────────────────────────
// GDD v3.0 §8.4

export const RESEARCH_EVENTS = [
  {
    id:       'R01',
    label:    'Beklenmedik Bulgu',
    description: 'Aktif projenizde çarpıcı beklenmedik bir bulgu ortaya çıktı! Kalite +30 ama 2 hafta ek süre gerekiyor.',
    condition: (s) => s.projects.active.length > 0,
    weight:   1,
    choices: [
      {
        id:    'pursue',
        label: 'Bulmacayı Takip Et',
        description: '+30 kalite, +2 hafta süre.',
        effect: { type: 'project_quality_boost', amount: 30, extraWeeks: 2 },
      },
      {
        id:    'continue',
        label: 'Planı Takip Et',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'R02',
    label:    'Veri Kaybı',
    description: 'Teknik arıza nedeniyle kritik veri kaybı yaşandı. Proje 3 hafta geriye gitmek zorunda.',
    condition: (s) => s.projects.active.some(p => p.phase === 'datacollect'),
    weight:   1,
    choices: [
      {
        id:    'recover',
        label: 'Veri Kurtarmaya Çalış',
        description: '%50 ihtimalle kurtarılır, aksi halde 3 hafta kayıp.',
        effect: { type: 'data_recovery_attempt', weeksLost: 3 },
      },
      {
        id:    'restart',
        label: 'Yeniden Başla',
        description: 'Veri toplama fazını sıfırla.',
        effect: { type: 'phase_restart', phase: 'datacollect' },
      },
    ],
  },
  {
    id:       'R03',
    label:    'Hakemden Sert Eleştiri',
    description: 'Gönderilen makalenize hakem son derece sert bir eleştiri yaptı. Kapsamlı revizyon zorunlu.',
    condition: (s) => s.projects.active.some(p => p.phase === 'peerreview' || p.phase === 'revision'),
    weight:   1,
    choices: [
      {
        id:    'revise',
        label: 'Kapsamlı Revizyona Gir',
        description: '+3 hafta, kalite +15.',
        effect: { type: 'forced_revision', weeks: 3, qualityBoost: 15 },
      },
      {
        id:    'appeal',
        label: 'İtiraz Et',
        description: '%40 başarı şansı, aksi halde +5 hafta.',
        effect: { type: 'appeal_review', successWeeks: 0, failWeeks: 5 },
      },
    ],
  },
  {
    id:       'R04',
    label:    'Citation Patlaması',
    description: 'Eski bir makaleniz sosyal medyada viral oldu! Bu hafta +40 citation.',
    condition: (s) => s.lab.publications.length > 0,
    weight:   1,
    choices: [
      {
        id:    'acknowledge',
        label: 'Harika!',
        effect: { type: 'citation_burst', amount: 40 },
      },
    ],
  },
  {
    id:       'R05',
    label:    'Etik Kurulu Sorgulaması',
    description: 'Etik kurulu aktif projenizin metodolojisini sorguluyor. 2 hafta durdurulabilir.',
    condition: (s) => s.projects.active.length > 0,
    weight:   1,
    choices: [
      {
        id:    'cooperate',
        label: 'Tam Şeffaflıkla Yanıtla',
        description: 'Proje 2 hafta durur ama temize çıkar.',
        effect: { type: 'project_pause', weeks: 2 },
      },
      {
        id:    'partial',
        label: 'Kısmi Bilgi Ver',
        description: 'Risk devam eder ama gecikme az.',
        effect: { type: 'ethics_risk' },
      },
    ],
  },
  {
    id:       'R06',
    label:    'Rakip Aynı Şeyi Buldu',
    description: 'Rakip bir kurum sizinle neredeyse aynı bulguyu açıkladı! Kim önce yayımlarsa kazanır.',
    condition: (s) => s.projects.active.some(p => p.phase === 'writing' || p.phase === 'peerreview'),
    weight:   1,
    choices: [
      {
        id:    'rush',
        label: 'Yayını Hızlandır',
        description: 'Daha düşük dergiye gönder, daha hızlı yayımla.',
        effect: { type: 'rush_publication' },
      },
      {
        id:    'quality',
        label: 'Kaliteyi Koru',
        description: 'Yüksek kaliteli dergiyi bekle, rakip önce çıkabilir.',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'R07',
    label:    'Ekipman Arızası',
    description: 'Kritik bir ekipman arıza yaptı. Veri toplama fazı 2 hafta duruyor.',
    condition: (s) => s.lab.equipment.length > 0 &&
                      s.projects.active.some(p => p.phase === 'datacollect'),
    weight:   1,
    choices: [
      {
        id:    'emergency_repair',
        label: 'Acil Onar',
        description: 'Ek maliyet ile hemen onar.',
        effect: { type: 'emergency_repair', costPct: 0.10 },
      },
      {
        id:    'wait',
        label: 'Tamir Bekle',
        description: '2 hafta proje durur.',
        effect: { type: 'project_pause', weeks: 2 },
      },
    ],
  },
  {
    id:       'R08',
    label:    'Dergi Özel Sayı Daveti',
    description: 'Prestijli bir derginin özel sayısına davet edildiniz! Makaleniz alınırsa IF bonusu kazanırsınız.',
    condition: (s) => s.projects.active.some(p =>
      p.phase === 'writing' || p.phase === 'peerreview'
    ),
    weight:   1,
    choices: [
      {
        id:    'accept_invite',
        label: 'Daveti Kabul Et',
        description: 'IF +10 bonus, ama zaman baskısı var (+2 hafta deadline).',
        effect: { type: 'special_issue_invite', ifBonus: 10 },
      },
      {
        id:    'decline',
        label: 'Reddet',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'R09',
    label:    'Yanlış Veri Tespit Edildi',
    description: 'İç denetimde analiz hatası bulundu. Revizyon zorunlu, prestij riski var.',
    condition: (s) => s.projects.active.length > 0,
    weight:   1,
    choices: [
      {
        id:    'correct',
        label: 'Düzelt ve Devam Et',
        description: 'Şeffaf düzeltme — prestij -5 ama güven artar.',
        effect: { type: 'prestige_hit', amount: -5, qualityReset: true },
      },
      {
        id:    'cover',
        label: 'Örtbas Et',
        description: 'Kısa vadede kurtulur, etik risk yükselir.',
        effect: { type: 'ethics_risk', severity: 'high' },
      },
    ],
  },
  {
    id:       'R10',
    label:    'Yeni Yöntem Keşfedildi',
    description: 'Literatürde devrim yaratan yeni bir metodoloji yayımlandı. Projeniz bu yöntemi benimseyebilir.',
    condition: (s) => s.projects.active.length > 0,
    weight:   1,
    choices: [
      {
        id:    'adopt',
        label: 'Yeni Yöntemi Benimse',
        description: '+2 hafta geçiş, ardından ilerleme %20 hızlanır.',
        effect: { type: 'method_upgrade', delay: 2, speedBoost: 0.20 },
      },
      {
        id:    'skip',
        label: 'Mevcut Yöntemi Koru',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'R11',
    label:    'Medya İlgisi',
    description: 'Araştırmanız gazetecilerin radarına girdi. Manşet haberi citation artışı getirebilir.',
    condition: (s) => s.lab.publications.length > 0,
    weight:   1,
    choices: [
      {
        id:    'engage',
        label: 'Röportaj Ver',
        description: '+20 citation, +10 prestij.',
        effect: { type: 'media_boost', citations: 20, prestige: 10 },
      },
      {
        id:    'decline_media',
        label: 'Geri Çevir',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'R12',
    label:    'Proje Fonu Kesilmesi',
    description: 'Aktif hibenizden biri beklenmedik biçimde iptal edildi. Alternatif finansman bulunmalı.',
    condition: (s) => s.lab.grants.length > 0,
    weight:   1,
    choices: [
      {
        id:    'emergency_apply',
        label: 'Acil Hibe Başvurusu Yap',
        effect: { type: 'grant_cancelled_and_apply' },
      },
      {
        id:    'cut_projects',
        label: 'Proje Bütçesini Kıs',
        effect: { type: 'cost_cut', pct: 0.25 },
      },
    ],
  },
  {
    id:       'R13',
    label:    'Başka Alanda Sürpriz Bağlantı',
    description: 'Araştırmanız beklenmedik bir alanda da yayın fırsatı ortaya çıkardı.',
    condition: (s) => s.projects.active.length > 0,
    weight:   1,
    choices: [
      {
        id:    'write_secondary',
        label: 'İkincil Makale Yaz',
        description: '+3 hafta ek çalışma, yeni alan yayını.',
        effect: { type: 'secondary_publication', weeks: 3 },
      },
      {
        id:    'focus',
        label: 'Ana Projeye Odaklan',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'R14',
    label:    'İntihal İddiası',
    description: 'Bir araştırmacı makalenizde intihal iddiasıyla karşılaştı. Savunma süreci başladı.',
    condition: (s) => s.lab.publications.length > 0,
    weight:   1,
    choices: [
      {
        id:    'defend',
        label: 'Güçlü Savunma Yap',
        description: '%70 beraat şansı. Beraat: +5 prestij. İspat: -25 prestij.',
        effect: { type: 'plagiarism_defense', successPct: 0.70 },
      },
      {
        id:    'settle',
        label: 'Uzlaşmaya Git',
        description: 'Prestij -10, süreç kapanır.',
        effect: { type: 'prestige_hit', amount: -10 },
      },
    ],
  },
  {
    id:       'R15',
    label:    'Tekrar Deneyi Talebi',
    description: 'Başka bir lab bulgularınızı tekrarlamak istiyor. Başarı itibarınızı pekiştirir.',
    condition: (s) => s.lab.publications.length > 0,
    weight:   1,
    choices: [
      {
        id:    'support',
        label: 'Destekle',
        description: 'Tekrar başarılı olursa +20 prestij.',
        effect: { type: 'replication_attempt', successPrestige: 20, failPrestige: -5 },
      },
      {
        id:    'decline_replication',
        label: 'Reddet',
        effect: { type: 'none' },
      },
    ],
  },
];

// ─── KİŞİSEL OLAYLAR (13) ────────────────────────────────────────────────────
// GDD v3.0 §8.5

export const PERSONAL_EVENTS = [
  {
    id:       'P01',
    label:    'Araştırmacı Evlendi',
    description: '{{name}} evlendi — tebrikler! 2 hafta balayı izni istiyor.',
    condition: (s) => s.researchers.length > 0,
    weight:   1,
    researcherTarget: true,
    choices: [
      {
        id:    'grant_leave',
        label: '2 Hafta İzin Ver',
        description: 'Moral +15, ekip morali +5.',
        effect: { type: 'leave', weeks: 2, moraleBoost: 15, teamMoraleBoost: 5 },
      },
      {
        id:    'deny',
        label: 'İzin Verme',
        description: 'Moral -20.',
        effect: { type: 'morale_hit', amount: -20 },
      },
    ],
  },
  {
    id:       'P02',
    label:    'Araştırmacı Hasta',
    description: '{{name}} ciddi hastalandı. 4-8 hafta izin gerekiyor.',
    condition: (s) => s.researchers.length > 0,
    weight:   1,
    researcherTarget: true,
    choices: [
      {
        id:    'acknowledge',
        label: 'Geçmiş Olsun',
        effect: { type: 'leave', weeks: 6, moraleBoost: 0 },
      },
    ],
  },
  {
    id:       'P03',
    label:    'Konferans Daveti',
    description: '{{name}}, uluslararası konferansa konuşmacı olarak davet edildi.',
    condition: (s) => s.researchers.length > 0,
    weight:   1,
    researcherTarget: true,
    choices: [
      {
        id:    'send',
        label: 'Gönder',
        description: '2 hafta yok, RP +25.',
        effect: { type: 'conference', weeks: 2, rpGain: 25 },
      },
      {
        id:    'decline_conf',
        label: 'Gönderme',
        description: 'Fırsat kaçar.',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'P04',
    label:    'Doktora Öğrencisi Talebi',
    description: 'Yetenekli bir doktora öğrencisi laboratuvarınıza katılmak istiyor.',
    condition: (s) => {
      const cap = [0,3,5,8,12,20][s.lab.level] ?? 3;
      return s.researchers.length < cap;
    },
    weight:   1,
    choices: [
      {
        id:    'accept',
        label: 'Kabul Et',
        description: 'Junior araştırmacı olarak ekibe katılır.',
        effect: { type: 'hire_junior' },
      },
      {
        id:    'decline',
        label: 'Reddet',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'P05',
    label:    'Ödül Töreni',
    description: '{{name}} prestijli bir akademik ödül aldı! Tüm ekip morali +10.',
    condition: (s) => s.researchers.length > 0,
    weight:   1,
    researcherTarget: true,
    choices: [
      {
        id:    'celebrate',
        label: 'Kutla!',
        effect: { type: 'team_morale_boost', amount: 10 },
      },
    ],
  },
  {
    id:       'P06',
    label:    'Tükenmişlik',
    description: '{{name}} ciddi tükenmişlik belirtileri gösteriyor. Acil müdahale gerekiyor.',
    condition: (s) => s.researchers.some(r => r.morale < 30 && !r.isBurnout),
    weight:   2,
    researcherTarget: 'lowMorale',
    choices: [
      {
        id:    'support',
        label: 'Psikolojik Destek Sağla',
        description: 'Moral +20, 1 hafta yavaşlama.',
        effect: { type: 'burnout_support', moraleBoost: 20 },
      },
      {
        id:    'ignore',
        label: 'Görmezden Gel',
        description: 'Burnout riski yükselir.',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'P07',
    label:    'Aile Krizi',
    description: '{{name}} ciddi bir aile kriziyle karşı karşıya. 2 hafta verim %50 düşüyor.',
    condition: (s) => s.researchers.length > 0,
    weight:   1,
    researcherTarget: true,
    choices: [
      {
        id:    'support',
        label: 'Destek Ol',
        description: 'Moral +10, verim kaybı azalır.',
        effect: { type: 'family_support', moraleBoost: 10, weeks: 2 },
      },
      {
        id:    'ignore',
        label: 'Görmezden Gel',
        description: 'Verim kaybı ve moral düşüşü.',
        effect: { type: 'morale_hit', amount: -15, productionHit: 0.5, weeks: 2 },
      },
    ],
  },
  {
    id:       'P08',
    label:    'Rakip Kurum Teklifi',
    description: '{{name}}, rakip bir kurumdan 2x maaş teklifi aldı.',
    condition: (s) => s.researchers.length > 0,
    weight:   1,
    researcherTarget: true,
    choices: [
      {
        id:    'match',
        label: 'Maaşı Eşitle',
        description: 'Araştırmacı kalır, bütçe yüklenir.',
        effect: { type: 'salary_match', mult: 2.0 },
      },
      {
        id:    'counter',
        label: 'Karşı Teklif Yap',
        description: '1.3x zam — kabul edebilir.',
        effect: { type: 'salary_counter', mult: 1.3 },
      },
      {
        id:    'let_go',
        label: 'Gitmesine İzin Ver',
        effect: { type: 'researcher_leaves' },
      },
    ],
  },
  {
    id:       'P09',
    label:    'Kitap Yazma Teklifi',
    description: '{{name}}, saygın bir yayınevi tarafından akademik kitap yazmaya davet edildi.',
    condition: (s) => s.researchers.some(r => r.RP >= 60),
    weight:   1,
    researcherTarget: 'highRP',
    choices: [
      {
        id:    'allow',
        label: 'İzin Ver',
        description: '12 hafta araştırma yok, RP +40.',
        effect: { type: 'book_writing', weeks: 12, rpGain: 40 },
      },
      {
        id:    'decline',
        label: 'Reddet',
        description: 'Fırsatı kaçırır, moral -5.',
        effect: { type: 'morale_hit', amount: -5 },
      },
    ],
  },
  {
    id:       'P10',
    label:    'Ders Verme Talebi',
    description: '{{name}}, fakülteden ders verme talebi aldı.',
    condition: (s) => s.researchers.length > 0,
    weight:   1,
    researcherTarget: true,
    choices: [
      {
        id:    'allow',
        label: 'İzin Ver',
        description: '8 hafta %50 verim, RP +15.',
        effect: { type: 'teaching', weeks: 8, productionPct: 0.5, rpGain: 15 },
      },
      {
        id:    'decline',
        label: 'Reddet',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'P11',
    label:    'Sabbatical Talebi',
    description: '{{name}}, akademik sabbatical için 12 hafta izin talep ediyor. Döndüğünde güçlenmiş gelecek.',
    condition: (s) => s.researchers.some(r => r.careerStage === 'senior'),
    weight:   1,
    researcherTarget: 'senior',
    choices: [
      {
        id:    'grant',
        label: 'İzin Ver',
        description: '12 hafta yok, döndüğünde +10 tüm statlar.',
        effect: { type: 'sabbatical', weeks: 12, statBoost: 10 },
      },
      {
        id:    'deny',
        label: 'Reddet',
        description: 'Moral -15, sadakat -10.',
        effect: { type: 'morale_hit', amount: -15, loyaltyHit: 10 },
      },
    ],
  },
  {
    id:       'P12',
    label:    'Mentör İlişkisi Talebi',
    description: 'Junior araştırmacı {{name}}, bir senior araştırmacıdan mentörlük istiyor.',
    condition: (s) =>
      s.researchers.some(r => r.careerStage === 'junior') &&
      s.researchers.some(r => r.careerStage === 'senior' || r.personality === 'MNT'),
    weight:   1,
    choices: [
      {
        id:    'arrange',
        label: 'Mentörlüğü Düzenle',
        description: 'Junior araştırmacı hızlı gelişir.',
        effect: { type: 'mentorship', xpMultBoost: 1.5, weeks: 12 },
      },
      {
        id:    'decline',
        label: 'Reddet',
        effect: { type: 'none' },
      },
    ],
  },
  {
    id:       'P13',
    label:    'Emeklilik Sinyali',
    description: '{{name}} Emeritus statüsüne geçmek istediğini belirtti.',
    condition: (s) => s.researchers.some(r => r.careerStage === 'emeritus'),
    weight:   1,
    researcherTarget: 'emeritus',
    choices: [
      {
        id:    'approve',
        label: 'Onur Statüsü Ver',
        description: 'Araştırmacı danışman olarak kalır.',
        effect: { type: 'emeritus_transition' },
      },
      {
        id:    'offer_raise',
        label: 'Kalması İçin Zam Teklif Et',
        description: 'Maaş %50 artır, tam zamanlı kalmaya ikna et.',
        effect: { type: 'retention_offer', mult: 1.5 },
      },
    ],
  },
];

// ─── EVENT HAVUZLARI ──────────────────────────────────────────────────────────

export const EVENT_POOLS = {
  world:       WORLD_EVENTS,
  institution: INSTITUTION_EVENTS,
  research:    RESEARCH_EVENTS,
  personal:    PERSONAL_EVENTS,
};

// ─── YARDIMCILAR ─────────────────────────────────────────────────────────────

/**
 * Belirli bir kategorinin koşulu sağlayan event'lerini döner.
 *
 * @param {string} category  — 'world' | 'institution' | 'research' | 'personal'
 * @param {Object} state
 * @returns {Object[]}
 */
export function getEligibleEvents(category, state) {
  const pool = EVENT_POOLS[category] ?? [];
  return pool.filter(e => {
    try { return e.condition(state); }
    catch { return false; }
  });
}

/**
 * Tüm kategorilerde toplam kaç event var?
 * @returns {number}
 */
export function getTotalEventCount() {
  return Object.values(EVENT_POOLS).reduce((s, pool) => s + pool.length, 0);
}
