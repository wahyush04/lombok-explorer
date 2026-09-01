import {
  PrismaClient,
  LombokRegion,
  DifficultyLevel,
  TravelStyle,
  BudgetLevel,
  TransportationMode,
  UserRole,
  ExpenseCategory,
  ChecklistCategory,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const dbUrl = process.env.DATABASE_URL?.replace('host.docker.internal', 'localhost') || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
});


// =========================================================================
// CLOUDINARY CENTRALIZED MEDIA ASSETS (Auto-optimized for mobile & web delivery)
// =========================================================================
const CLOUDINARY_MEDIA = {
  sasak_culture: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267655/lombok-explorer/examples/istockphoto-525625699-1024x1024.jpg',
    publicId: 'lombok-explorer/examples/istockphoto-525625699-1024x1024',
  },
  pantai_kuta: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267657/lombok-explorer/examples/pexels-ari-setiawan-2156420701-38061830.jpg',
    publicId: 'lombok-explorer/examples/pexels-ari-setiawan-2156420701-38061830',
  },
  bukit_merese: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267659/lombok-explorer/examples/pexels-bagas-putra-2162789112-38490382.jpg',
    publicId: 'lombok-explorer/examples/pexels-bagas-putra-2162789112-38490382',
  },
  gili_trawangan: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267661/lombok-explorer/examples/pexels-ilham-zovanka-2158121497-37550278.jpg',
    publicId: 'lombok-explorer/examples/pexels-ilham-zovanka-2158121497-37550278',
  },
  snorkeling_penyu: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267664/lombok-explorer/examples/pexels-ilham-zovanka-2158121497-37550288.jpg',
    publicId: 'lombok-explorer/examples/pexels-ilham-zovanka-2158121497-37550288',
  },
  gunung_rinjani: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267667/lombok-explorer/examples/pexels-patuur-35604706.jpg',
    publicId: 'lombok-explorer/examples/pexels-patuur-35604706',
  },
  air_terjun: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267669/lombok-explorer/examples/pexels-rama-dhan-862484-6683876.jpg',
    publicId: 'lombok-explorer/examples/pexels-rama-dhan-862484-6683876',
  },
  kuliner_sasak: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267671/lombok-explorer/examples/pexels-roman-odintsov-4870657.jpg',
    publicId: 'lombok-explorer/examples/pexels-roman-odintsov-4870657',
  },
  desa_sukarara: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267673/lombok-explorer/examples/pexels-shabran-niami-1789590-37059960.jpg',
    publicId: 'lombok-explorer/examples/pexels-shabran-niami-1789590-37059960',
  },
  surfing_ombak: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267676/lombok-explorer/examples/pexels-tryputroutomo-13338242.jpg',
    publicId: 'lombok-explorer/examples/pexels-tryputroutomo-13338242',
  },
  sunset_senggigi: {
    url: 'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267679/lombok-explorer/examples/pexels-vincent-ma-janssen-2823154.jpg',
    publicId: 'lombok-explorer/examples/pexels-vincent-ma-janssen-2823154',
  },
};

function getMediaForCategory(slug: string) {
  switch (slug) {
    case 'beach': return CLOUDINARY_MEDIA.pantai_kuta;
    case 'waterfall': return CLOUDINARY_MEDIA.air_terjun;
    case 'mountain': return CLOUDINARY_MEDIA.gunung_rinjani;
    case 'hill': return CLOUDINARY_MEDIA.bukit_merese;
    case 'gili': return CLOUDINARY_MEDIA.gili_trawangan;
    case 'culture': return CLOUDINARY_MEDIA.sasak_culture;
    case 'village': return CLOUDINARY_MEDIA.desa_sukarara;
    case 'culinary': return CLOUDINARY_MEDIA.kuliner_sasak;
    case 'surfing': return CLOUDINARY_MEDIA.surfing_ombak;
    case 'snorkeling': return CLOUDINARY_MEDIA.snorkeling_penyu;
    case 'diving': return CLOUDINARY_MEDIA.snorkeling_penyu;
    case 'sunset': return CLOUDINARY_MEDIA.sunset_senggigi;
    default: return CLOUDINARY_MEDIA.bukit_merese;
  }
}

function getMediaForDestination(catId: string, destId: string) {
  const lower = destId.toLowerCase();
  if (lower.includes('rinjani') || lower.includes('pergasingan') || lower.includes('sembalun')) return CLOUDINARY_MEDIA.gunung_rinjani;
  if (lower.includes('waterfall') || lower.includes('kelep') || lower.includes('sendang') || lower.includes('benang') || lower.includes('sakti') || lower.includes('pupus')) return CLOUDINARY_MEDIA.air_terjun;
  if (lower.includes('shark') || lower.includes('turtle') || lower.includes('diving') || lower.includes('snorkeling') || lower.includes('meno')) return CLOUDINARY_MEDIA.snorkeling_penyu;
  if (lower.includes('gili')) return CLOUDINARY_MEDIA.gili_trawangan;
  if (lower.includes('merese') || lower.includes('malimbu') || lower.includes('seger') || lower.includes('hill')) return CLOUDINARY_MEDIA.bukit_merese;
  if (lower.includes('sade') || lower.includes('sukarara') || lower.includes('ende') || lower.includes('banyumulek') || lower.includes('bayan')) return CLOUDINARY_MEDIA.desa_sukarara;
  if (lower.includes('surf') || lower.includes('mawi') || lower.includes('desert') || lower.includes('selong')) return CLOUDINARY_MEDIA.surfing_ombak;
  if (lower.includes('nipah') || lower.includes('culinary') || lower.includes('taliwang')) return CLOUDINARY_MEDIA.kuliner_sasak;
  if (lower.includes('sunset') || lower.includes('senggigi')) return CLOUDINARY_MEDIA.sunset_senggigi;
  if (lower.includes('kuta') || lower.includes('aan') || lower.includes('mawun') || lower.includes('pink') || lower.includes('tangsi')) return CLOUDINARY_MEDIA.pantai_kuta;
  return getMediaForCategory(catId.replace('cat_', ''));
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('🌱 Starting comprehensive Lombok Explorer database seeding (Phase 4)...');

  // =========================================================================
  // 1. CLEAN EXISTING DATA (Idempotent cleanup in reverse dependency order)
  // =========================================================================
  await prisma.postReport.deleteMany({});
  await prisma.postBookmark.deleteMany({});
  await prisma.postComment.deleteMany({});
  await prisma.postLike.deleteMany({});
  await prisma.postMedia.deleteMany({});
  await prisma.postLocation.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.checklistItem.deleteMany({});
  await prisma.checklist.deleteMany({});
  await prisma.travelJournal.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.templateActivity.deleteMany({});
  await prisma.templateDay.deleteMany({});
  await prisma.itineraryTemplate.deleteMany({});
  await prisma.recommendationDestination.deleteMany({});
  await prisma.recommendation.deleteMany({});
  await prisma.itineraryItem.deleteMany({});
  await prisma.itineraryDay.deleteMany({});
  await prisma.itinerary.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.favorite.deleteMany({});
  await prisma.destinationImage.deleteMany({});
  await prisma.destination.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.restaurant.deleteMany({});
  await prisma.accommodation.deleteMany({});
  await prisma.weatherCache.deleteMany({});
  await prisma.user.deleteMany({});

  // =========================================================================
  // 2. SEED USERS & DEVELOPMENT ADMIN ACCOUNT
  // =========================================================================
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const demoUser = await prisma.user.create({
    data: {
      id: 'usr_demo_lombok',
      email: 'traveler@lombokexplorer.com',
      username: 'bima_arya',
      password: passwordHash,
      name: 'Bima Arya Pratama',
      avatarUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      avatarPublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      role: UserRole.USER,
      travelStyle: TravelStyle.BEACH_RELAXATION,
      preferredRegion: LombokRegion.LOMBOK_SELATAN,
      isEmailVerified: true,
    },
  });

  // Base Admin Account (For test suite and baseline integration)
  const baseAdmin = await prisma.user.create({
    data: {
      id: 'usr_admin_lombok',
      email: 'admin@lombokexplorer.com',
      username: 'super_admin',
      password: passwordHash,
      name: 'Super Admin Lombok Explorer',
      avatarUrl: CLOUDINARY_MEDIA.bukit_merese.url,
      avatarPublicId: CLOUDINARY_MEDIA.bukit_merese.publicId,
      role: UserRole.ADMIN,
      isEmailVerified: true,
    },
  });

  // Dynamic Development Admin Account from Environment Variables
  const devAdminEmail = process.env.ADMIN_EMAIL || 'wahyush04.colab@example.com';
  const devAdminRawPassword = process.env.ADMIN_PASSWORD || 'lombokExplorer@2026';
  const devAdminName = process.env.ADMIN_NAME || 'Development Administrator';

  if (devAdminEmail !== 'admin@lombokexplorer.com') {
    const devAdminHash = await bcrypt.hash(devAdminRawPassword, 12);
    await prisma.user.create({
      data: {
        id: 'usr_dev_admin_env',
        email: devAdminEmail.toLowerCase().trim(),
        username: 'dev_admin',
        password: devAdminHash,
        name: devAdminName,
        avatarUrl: CLOUDINARY_MEDIA.sunset_senggigi.url,
        avatarPublicId: CLOUDINARY_MEDIA.sunset_senggigi.publicId,
        role: UserRole.ADMIN,
        isEmailVerified: true,
      },
    });
  }

  // Security Warning Banner
  console.log('----------------------------------------------------------------');
  console.log('⚠️  [SECURITY WARNING]: DEVELOPMENT ADMIN ACCOUNT SEEDED!');
  console.log(`   Email   : ${devAdminEmail}`);
  console.log(`   Role    : ADMIN`);
  console.log(`   Status  : ACTIVE`);
  console.log('   WARNING : This credential is strictly intended for local development & QA testing.');
  console.log('   WARNING : DO NOT hardcode or use default development credentials in production!');
  console.log('----------------------------------------------------------------');

  const localGuideUser = await prisma.user.create({
    data: {
      id: 'usr_guide_sasak',
      email: 'guide.rinjani@lombokexplorer.com',
      username: 'hendra_rinjani',
      password: passwordHash,
      name: 'Lalu Hendra Rinjani',
      avatarUrl: CLOUDINARY_MEDIA.gunung_rinjani.url,
      avatarPublicId: CLOUDINARY_MEDIA.gunung_rinjani.publicId,
      role: UserRole.USER,
      travelStyle: TravelStyle.NATURE_ADVENTURE,
      preferredRegion: LombokRegion.LOMBOK_UTARA,
      isEmailVerified: true,
    },
  });

  // =========================================================================
  // 3. SEED 13 CATEGORIES
  // =========================================================================
  const categoriesData = [
    {
      id: 'cat_beach',
      slug: 'beach',
      name: 'Pantai & Pesisir',
      description: 'Eksplorasi pantai pasir putih, teluk toska tersembunyi, dan pasir merica khas Lombok.',
      iconName: 'beach_access',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_waterfall',
      slug: 'waterfall',
      name: 'Air Terjun Alami',
      description: 'Kesejukan air terjun alami dan tirai air abadi di kaki Gunung Rinjani dan hutan tropis.',
      iconName: 'water_drop',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_mountain',
      slug: 'mountain',
      name: 'Gunung & Puncak',
      description: 'Pendakian megah puncak Rinjani, Danau Segara Anak, dan petualangan vulkanik geopark dunia.',
      iconName: 'terrain',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_hill',
      slug: 'hill',
      name: 'Bukit & Savana',
      description: 'Perbukitan savana hijau eksotis dengan pemandangan bentang laut dan lembah pertanian.',
      iconName: 'landscape',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_gili',
      slug: 'gili',
      name: 'Wisata Kepulauan Gili',
      description: 'Trio Gili dan gili-gili perawan di Sekotong yang tenang tanpa kendaraan bermotor.',
      iconName: 'sailing',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_culture',
      slug: 'culture',
      name: 'Budaya & Adat Sasak',
      description: 'Warisan leluhur suku Sasak, masjid kuno, tradisi Bau Nyale, dan kearifan lokal NTB.',
      iconName: 'museum',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_village',
      slug: 'village',
      name: 'Desa Wisata & Kerajinan',
      description: 'Desa tenun songket ikat tradisional Sukarara, kerajinan gerabah Banyumulek, dan kriya lokal.',
      iconName: 'cottage',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_culinary',
      slug: 'culinary',
      name: 'Kuliner Tradisional',
      description: 'Sajian pedas aromatik khas Sasak: Ayam Taliwang, Plecing Kangkung, Sate Bulayak, dan Nasi Balap.',
      iconName: 'restaurant',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_surfing',
      slug: 'surfing',
      name: 'Spot Selancar Ombak',
      description: 'Spot surfing kelas dunia di pesisir selatan Lombok dari pemula hingga ombak reef break profesional.',
      iconName: 'surfing',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_snorkeling',
      slug: 'snorkeling',
      name: 'Snorkeling & Bawah Laut',
      description: 'Berenang bersama penyu liar, patung bawah laut Nest Gili Meno, dan terumbu karang warna-warni.',
      iconName: 'scuba_diving',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_diving',
      slug: 'diving',
      name: 'Spot Menyelam / Scuba Diving',
      description: 'Pusat selam sertifikasi PADI, shark point, manta point, dan wall diving karang laut dalam.',
      iconName: 'pool',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_sunset',
      slug: 'sunset',
      name: 'Spot Sunset & Golden Hour',
      description: 'Titik terbaik menikmati matahari terbenam magis berlatar Samudra Hindia dan siluet Gunung Agung Bali.',
      iconName: 'wb_twilight',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
    {
      id: 'cat_adventure',
      slug: 'adventure',
      name: 'Petualangan Alam & Caving',
      description: 'Eksplorasi gua kelelawar alami, susur tebing karang laut, dan offroad lereng pegunungan.',
      iconName: 'explore',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
    },
  ];

  for (const cat of categoriesData) {
    const media = getMediaForCategory(cat.slug);
    await prisma.category.create({
      data: {
        ...cat,
        coverImageUrl: media.url,
        coverImagePublicId: media.publicId,
      },
    });
  }

  // =========================================================================
  // 4. SEED 35+ CURATED LOMBOK DESTINATIONS
  // =========================================================================
  const destinationsData = [
    // 1. Pantai Tanjung Aan
    {
      id: 'dest_tanjung_aan',
      slug: 'pantai-tanjung-aan',
      name: 'Pantai Tanjung Aan',
      shortDescription: 'Pantai berpasir putih merica dengan teluk toska tenang memukau di Kawasan Mandalika.',
      description:
        'Pantai Tanjung Aan adalah ikon pesisir selatan Lombok Tengah dengan keunikan formasi pasir bulat seperti butiran merica. Dikelilingi Bukit Merese, teluk terlindung ini memiliki ombak yang tenang, sangat ideal untuk berenang, bermain stand-up paddle, atau bersantai menikmati kelapa muda.',
      categoryId: 'cat_beach',
      region: LombokRegion.LOMBOK_SELATAN,
      locationName: 'Pujut, Lombok Tengah',
      address: 'Sengkol, Kec. Pujut, Kabupaten Lombok Tengah, NTB',
      latitude: -8.9083,
      longitude: 116.3218,
      rating: 4.8,
      reviewCount: 1420,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '06:00 - 18:30 WITA',
      estimatedDurationMinutes: 120,
      bestVisitingTime: 'Pagi hari (08:00) atau menjelang Sunset (16:30)',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Pasir Merica', 'Sunset Spot', 'Berenang', 'Mandalika', 'Fotografi']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Area Parkir', 'Warung Kelapa Muda', 'Toilet & Bilas', 'Sewa Gazebo', 'Spot Foto Ayunan']),
      tips: JSON.stringify(['Kombinasikan dengan pendakian Bukit Merese di sebelahnya saat menjelang matahari terbenam.']),
      isFeatured: true,
    },
    // 2. Bukit Merese
    {
      id: 'dest_bukit_merese',
      slug: 'bukit-merese',
      name: 'Bukit Merese',
      shortDescription: 'Bukit savana pesisir selatan dengan panorama matahari terbenam paling spektakuler.',
      description:
        'Bukit Merese membentang memagari Tanjung Aan dengan padang savana berbukit-bukit dan tebing karang dramatis. Titik puncak bukit menyuguhkan pemandangan 360 derajat Samudra Hindia dan teluk toska.',
      categoryId: 'cat_hill',
      region: LombokRegion.LOMBOK_SELATAN,
      locationName: 'Pujut, Lombok Tengah',
      address: 'Jl. Kuta Lombok, Sengkol, Pujut, Lombok Tengah, NTB',
      latitude: -8.9138,
      longitude: 116.3275,
      rating: 4.9,
      reviewCount: 2150,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '24 Jam (Terbaik 05:30 - 18:30 WITA)',
      estimatedDurationMinutes: 90,
      bestVisitingTime: 'Sore hari menjelang Golden Hour (16:30 - 18:15 WITA)',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Sunset Spot', 'Savana Pesisir', 'Panorama 360', 'Fotografi', 'Romantis']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Area Parkir', 'Warung Minuman', 'Jasa Fotografer Lokal']),
      tips: JSON.stringify(['Gunakan alas kaki nyaman untuk mendaki bukit sekitar 10 menit dari parkiran.']),
      isFeatured: true,
    },
    // 3. Gunung Rinjani & Danau Segara Anak
    {
      id: 'dest_gunung_rinjani',
      slug: 'gunung-rinjani',
      name: 'Gunung Rinjani & Danau Segara Anak',
      shortDescription: 'Gunung berapi tertinggi kedua di Indonesia dengan kawah Danau Segara Anak yang magis.',
      description:
        'Taman Nasional Gunung Rinjani (3.726 mdpl) adalah situs UNESCO Global Geopark dengan Danau Segara Anak berwarna biru toska, mata air panas alami Aik Kalak, dan pemandangan sunrise di atas awan yang luar biasa.',
      categoryId: 'cat_mountain',
      region: LombokRegion.LOMBOK_UTARA,
      locationName: 'Sembalun / Senaru, Lombok Utara & Timur',
      address: 'Taman Nasional Gunung Rinjani, NTB',
      latitude: -8.4167,
      longitude: 116.4583,
      rating: 4.9,
      reviewCount: 3890,
      entranceFee: 150000,
      currency: 'IDR',
      openingHours: '07:00 - 16:00 WITA (Registrasi e-Rinjani)',
      estimatedDurationMinutes: 2880, // 2-4 days
      bestVisitingTime: 'Bulan April hingga November (Musim Kemarau)',
      difficulty: DifficultyLevel.EXTREME,
      tags: JSON.stringify(['Trekking Ekstrem', 'UNESCO Geopark', 'Segara Anak', 'Sunrise Puncak', 'Pemandian Air Panas']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Pos Pemeriksaan e-Rinjani', 'Jasa Porter & Guide Bersertifikat', 'Shelter Evakuasi', 'Toilet Pos']),
      tips: JSON.stringify(['Wajib memesan tiket melalui aplikasi e-Rinjani dan didampingi guide resmi.']),
      isFeatured: true,
    },
    // 4. Air Terjun Tiu Kelep
    {
      id: 'dest_tiu_kelep',
      slug: 'air-terjun-tiu-kelep',
      name: 'Air Terjun Tiu Kelep',
      shortDescription: 'Air terjun megah di kaki Gunung Rinjani dengan tirai air alami dan kabut sejuk.',
      description:
        'Terletak di dalam hutan lebat Senaru, Air Terjun Tiu Kelep memiliki ketinggian 42 meter dengan debit air deras yang membentuk kabut sejuk abadi. Perjalanan trekking melintasi jembatan saluran air dan sungai memberikan sensasi petualangan tropis.',
      categoryId: 'cat_waterfall',
      region: LombokRegion.LOMBOK_UTARA,
      locationName: 'Senaru, Bayan, Lombok Utara',
      address: 'Desa Senaru, Kec. Bayan, Kabupaten Lombok Utara, NTB',
      latitude: -8.3005,
      longitude: 116.4116,
      rating: 4.8,
      reviewCount: 1650,
      entranceFee: 20000,
      currency: 'IDR',
      openingHours: '07:00 - 17:00 WITA',
      estimatedDurationMinutes: 180,
      bestVisitingTime: 'Pagi hari (08:00 - 11:00 WITA)',
      difficulty: DifficultyLevel.MODERATE,
      tags: JSON.stringify(['Jungle Trekking', 'Tirai Air', 'Segar', 'Geopark Rinjani']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Guide Lokal', 'Sewa Sandal Trekking', 'Warung Makan', 'Toilet & Mushola']),
      tips: JSON.stringify(['Gunakan dry bag dan pakaian yang siap basah karena percikan air sangat deras.']),
      isFeatured: true,
    },
    // 5. Air Terjun Sendang Gile
    {
      id: 'dest_sendang_gile',
      slug: 'air-terjun-sendang-gile',
      name: 'Air Terjun Sendang Gile',
      shortDescription: 'Air terjun bertingkat dua yang mudah diakses di pintu gerbang pendakian Senaru.',
      description:
        'Air Terjun Sendang Gile adalah air terjun tingkat pertama sebelum menuju Tiu Kelep. Berjarak hanya 15 menit menuruni anak tangga beton dari pintu masuk Senaru, tempat ini sangat ramah keluarga dengan kolam alami yang jernih.',
      categoryId: 'cat_waterfall',
      region: LombokRegion.LOMBOK_UTARA,
      locationName: 'Senaru, Bayan, Lombok Utara',
      address: 'Desa Senaru, Kec. Bayan, Lombok Utara, NTB',
      latitude: -8.298,
      longitude: 116.408,
      rating: 4.7,
      reviewCount: 920,
      entranceFee: 20000,
      currency: 'IDR',
      openingHours: '07:00 - 17:00 WITA',
      estimatedDurationMinutes: 90,
      bestVisitingTime: 'Pagi hingga siang hari',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Akses Mudah', 'Ramah Keluarga', 'Segar', 'Senaru']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Tangga Beton', 'Warung Kopi & Makanan Ringan', 'Gazebo Istirahat', 'Toilet']),
      tips: JSON.stringify(['Tiket masuk Sendang Gile sudah terusan untuk menuju Tiu Kelep.']),
      isFeatured: false,
    },
    // 6. Gili Trawangan
    {
      id: 'dest_gili_trawangan',
      slug: 'gili-trawangan',
      name: 'Gili Trawangan',
      shortDescription: 'Pulau tropis bebas polusi kendaraan dengan pesona bawah laut, terumbu karang, dan penyu.',
      description:
        'Gili Trawangan adalah pulau terbesar di trio kepulauan Gili Lombok. Bebas kendaraan bermotor (hanya sepeda dan andong cidomo), pulau ini memadukan snorkeling terumbu karang jernih, penyu liar, kafe tepi pantai, dan pemandangan sunset berlatar Gunung Agung.',
      categoryId: 'cat_gili',
      region: LombokRegion.GILI_ISLANDS,
      locationName: 'Gili Indah, Pemenang, Lombok Utara',
      address: 'Desa Gili Indah, Kec. Pemenang, Lombok Utara, NTB',
      latitude: -8.3534,
      longitude: 116.0375,
      rating: 4.8,
      reviewCount: 4200,
      entranceFee: 0,
      currency: 'IDR',
      openingHours: '24 Jam',
      estimatedDurationMinutes: 360,
      bestVisitingTime: 'Sepanjang hari (Snorkeling pagi 09:00, Sunset 17:30)',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Snorkeling Penyu', 'Bebas Polusi', 'Sunset Bar', 'Sewa Sepeda', 'Night Market']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Sewa Sepeda & Cidomo', 'Pusat Diving PADI', 'Restoran & Beach Club', 'Klinik 24 Jam', 'ATM']),
      tips: JSON.stringify(['Sewa sepeda untuk mengelilingi pulau santai dalam waktu 1.5 jam.']),
      isFeatured: true,
    },
    // 7. Gili Meno
    {
      id: 'dest_gili_meno',
      slug: 'gili-meno',
      name: 'Gili Meno & Patung Bawah Laut Nest',
      shortDescription: 'Pulau paling tenang dan romantis dengan spot patung bawah laut karya Jason deCaires Taylor.',
      description:
        'Gili Meno adalah pulau terkecil di antara trio Gili yang terkenal dengan atmosfer hening dan damai. Spot ikoniknya adalah instalasi patung melingkar "Nest" di kedalaman 4 meter serta suaka konservasi penyu hijau.',
      categoryId: 'cat_snorkeling',
      region: LombokRegion.GILI_ISLANDS,
      locationName: 'Gili Indah, Pemenang, Lombok Utara',
      address: 'Desa Gili Indah, Kec. Pemenang, Lombok Utara, NTB',
      latitude: -8.349,
      longitude: 116.0565,
      rating: 4.8,
      reviewCount: 1850,
      entranceFee: 0,
      currency: 'IDR',
      openingHours: '24 Jam',
      estimatedDurationMinutes: 240,
      bestVisitingTime: 'Pagi hari (08:30 - 11:30) saat arus laut tenang',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Patung Bawah Laut Nest', 'Penangkaran Penyu', 'Romantis', 'Snorkeling Kristal', 'Honeymoon']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Pusat Konservasi Penyu', 'Warung Tepi Pantai', 'Sewa Masker Snorkeling', 'Penginapan Eco-Resort']),
      tips: JSON.stringify(['Datanglah lebih pagi ke patung bawah laut sebelum rombongan boat tour tiba.']),
      isFeatured: true,
    },
    // 8. Gili Air
    {
      id: 'dest_gili_air',
      slug: 'gili-air',
      name: 'Gili Air',
      shortDescription: 'Perpaduan harmoni suasana santai pulau tropis, kafe yoga, dan terumbu karang hidup.',
      description:
        'Gili Air menawarkan perpaduan sempurna antara ketenangan Gili Meno dan fasilitas Gili Trawangan. Pulau ini sangat digemari traveler yang mencari suasana bohemian, pusat yoga, kafe vegan, dan spot snorkeling ikan badut.',
      categoryId: 'cat_gili',
      region: LombokRegion.GILI_ISLANDS,
      locationName: 'Gili Indah, Pemenang, Lombok Utara',
      address: 'Desa Gili Indah, Pemenang, Lombok Utara, NTB',
      latitude: -8.3582,
      longitude: 116.0827,
      rating: 4.7,
      reviewCount: 2100,
      entranceFee: 0,
      currency: 'IDR',
      openingHours: '24 Jam',
      estimatedDurationMinutes: 240,
      bestVisitingTime: 'Pagi dan sore hari',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Yoga Spot', 'Ikan Badut', 'Santai', 'Kafe Tepi Pantai', 'Snorkeling']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Studio Yoga', 'Pusat Selam', 'Kafe Vegan & Seafood', 'Sewa Sepeda']),
      tips: JSON.stringify(['Nikmati sunrise di sisi timur dan berjalan santai ke sisi barat untuk sunset di hari yang sama.']),
      isFeatured: false,
    },
    // 9. Desa Adat Sade
    {
      id: 'dest_desa_sade',
      slug: 'desa-adat-sade',
      name: 'Desa Adat Sade',
      shortDescription: 'Perkampungan tradisional suku Sasak yang mempertahankan arsitektur dan adat turun temurun.',
      description:
        'Desa Sade adalah cagar budaya hidup suku Sasak Lombok dengan rumah berdinding anyaman bambu, atap alang-alang, lantai tanah yang dipel dengan kotoran kerbau secara berkala, dan tradisi menenun songket.',
      categoryId: 'cat_culture',
      region: LombokRegion.LOMBOK_TENGAH,
      locationName: 'Rembitan, Pujut, Lombok Tengah',
      address: 'Rembitan, Pujut, Kabupaten Lombok Tengah, NTB',
      latitude: -8.8394,
      longitude: 116.2917,
      rating: 4.6,
      reviewCount: 1140,
      entranceFee: 15000,
      currency: 'IDR',
      openingHours: '08:00 - 18:30 WITA',
      estimatedDurationMinutes: 90,
      bestVisitingTime: 'Siang menjelang sore (14:00 - 16:30)',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Budaya Sasak', 'Tenun Songket', 'Rumah Adat Bale Tani', 'Edukasi Budaya']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Pemandu Adat Sade', 'Pusat Kain Tenun Asli', 'Toilet', 'Area Parkir']),
      tips: JSON.stringify(['Gunakan pemandu lokal warga desa untuk mendengarkan kisah filosofi arsitektur Bale Sasak.']),
      isFeatured: true,
    },
    // 10. Desa Tenun Sukarara
    {
      id: 'dest_desa_sukarara',
      slug: 'desa-tenun-sukarara',
      name: 'Desa Tenun Sukarara',
      shortDescription: 'Sentra kerajinan tenun ikat dan songket Lombok dengan kesempatan belajar menenun langsung.',
      description:
        'Desa Sukarara adalah sentra kain tenun songket khas Lombok di mana setiap wanita desa diwajibkan pandai menenun sebelum menikah. Wisatawan dapat mencoba menenun menggunakan alat tradisional dan berfoto mengenakan pakaian adat Sasak gratis.',
      categoryId: 'cat_village',
      region: LombokRegion.LOMBOK_TENGAH,
      locationName: 'Jonggat, Lombok Tengah',
      address: 'Sukarara, Kec. Jonggat, Kabupaten Lombok Tengah, NTB',
      latitude: -8.6948,
      longitude: 116.2167,
      rating: 4.7,
      reviewCount: 780,
      entranceFee: 0,
      currency: 'IDR',
      openingHours: '08:00 - 18:00 WITA',
      estimatedDurationMinutes: 75,
      bestVisitingTime: 'Pagi atau siang hari (09:00 - 15:00)',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Tenun Songket', 'Pakaian Adat Sasak', 'Kerajinan Tangan', 'Spot Foto Budaya']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Penyewaan Baju Adat Gratis (Donasi)', 'Showroom Kain Tenun', 'Area Parkir Luas']),
      tips: JSON.stringify(['Jangan lewatkan kesempatan berfoto mengenakan busana adat lengkap Sasak di depan lumbung padi.']),
      isFeatured: false,
    },
    // 11. Pantai Selong Belanak
    {
      id: 'dest_selong_belanak',
      slug: 'pantai-selong-belanak',
      name: 'Pantai Selong Belanak',
      shortDescription: 'Pantai pasir putih landai bulan sabit yang menjadi surga belajar surfing pemula.',
      description:
        'Pantai Selong Belanak memiliki garis pantai melengkung seperti bulan sabit dengan dasar pasir lembut tanpa karang. Ombaknya yang bergulung lembut menjadikannya lokasi nomor satu di Lombok untuk kursus surfing pemula.',
      categoryId: 'cat_surfing',
      region: LombokRegion.LOMBOK_SELATAN,
      locationName: 'Praya Barat, Lombok Tengah',
      address: 'Desa Selong Belanak, Kec. Praya Barat, Lombok Tengah, NTB',
      latitude: -8.868,
      longitude: 116.1625,
      rating: 4.8,
      reviewCount: 1980,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '06:00 - 18:30 WITA',
      estimatedDurationMinutes: 180,
      bestVisitingTime: 'Pagi hari (08:00 - 11:00) untuk surfing atau Sore hari untuk sunset kerbau melintas',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Surfing Pemula', 'Pasir Halus', 'Sunset Kerbau', 'Berenang', 'Mandalika']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Sekolah Surfing & Sewa Papan', 'Warung Makan & Ikan Bakar', 'Toilet & Kamar Bilas', 'Sewa Sunbed']),
      tips: JSON.stringify(['Saksikan parade kawanan kerbau peternak yang melintasi pesisir pantai setiap sore sekitar pukul 17:00.']),
      isFeatured: true,
    },
    // 12. Pantai Mawun
    {
      id: 'dest_pantai_mawun',
      slug: 'pantai-mawun',
      name: 'Pantai Mawun',
      shortDescription: 'Teluk tapal kuda tersembunyi dengan gradasi air biru toska diapit dua bukit hijau.',
      description:
        'Pantai Mawun memiliki bentuk teluk tapal kuda yang menakjubkan diapit bukit hijau di sisi timur dan barat. Pasir putihnya bersih dengan air laut toska jernih berkilau di bawah sinar matahari tropis.',
      categoryId: 'cat_beach',
      region: LombokRegion.LOMBOK_SELATAN,
      locationName: 'Pujut, Lombok Tengah',
      address: 'Desa Tumpak, Kec. Pujut, Lombok Tengah, NTB',
      latitude: -8.8972,
      longitude: 116.2306,
      rating: 4.7,
      reviewCount: 1350,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '07:00 - 18:00 WITA',
      estimatedDurationMinutes: 120,
      bestVisitingTime: 'Pagi menjelang siang (09:00 - 12:00)',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Teluk Tapal Kuda', 'Air Toska', 'Santai', 'Fotografi']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Gazebo Santai', 'Warung Kelapa Muda', 'Toilet', 'Area Parkir']),
      tips: JSON.stringify(['Arus di bagian tengah teluk cukup kuat, disarankan berenang di area tepi yang tenang.']),
      isFeatured: false,
    },
    // 13. Pantai Mawi
    {
      id: 'dest_pantai_mawi',
      slug: 'pantai-mawi',
      name: 'Pantai Mawi',
      shortDescription: 'Spot selancar ombak kelas dunia bagi para pro surfer dengan pemandangan tebing karang.',
      description:
        'Pantai Mawi adalah surga selancar ombak kiri (left-hander reef break) paling terkenal di Lombok Selatan. Dikelilingi perbukitan karang terjal, pantai ini menarik peselancar profesional mancanegara.',
      categoryId: 'cat_surfing',
      region: LombokRegion.LOMBOK_SELATAN,
      locationName: 'Praya Barat, Lombok Tengah',
      address: 'Desa Selong Belanak, Kec. Praya Barat, Lombok Tengah, NTB',
      latitude: -8.8744,
      longitude: 116.1486,
      rating: 4.7,
      reviewCount: 650,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '06:00 - 18:30 WITA',
      estimatedDurationMinutes: 150,
      bestVisitingTime: 'Musim kemarau (Mei - Oktober) saat gelombang pasang ombak konsisten',
      difficulty: DifficultyLevel.CHALLENGING,
      tags: JSON.stringify(['Pro Surfing', 'Reef Break', 'Ombak Kelas Dunia', 'Pemandangan Tebing']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Warung Surfer', 'Area Parkir Motor & Mobil', 'Spot Nonton Ombak']),
      tips: JSON.stringify(['Akses jalan berbatu, disarankan menggunakan motor trail atau mobil berpenggerak kuat.']),
      isFeatured: false,
    },
    // 14. Bukit Pergasingan
    {
      id: 'dest_bukit_pergasingan',
      slug: 'bukit-pergasingan',
      name: 'Bukit Pergasingan Sembalun',
      shortDescription: 'Bukit pendakian 1.700 mdpl dengan panorama kotak-kotak sawah Sembalun dan megahnya Rinjani.',
      description:
        'Bukit Pergasingan di Sembalun menawarkan jalur pendakian sekitar 2-3 jam menuju puncak berketinggian 1.700 mdpl. Dari puncak, traveler disuguhi permadani petak sawah warna-warni Sembalun dan dinding kawah Rinjani.',
      categoryId: 'cat_hill',
      region: LombokRegion.LOMBOK_TIMUR,
      locationName: 'Sembalun, Lombok Timur',
      address: 'Desa Sembalun Lawang, Kec. Sembalun, Lombok Timur, NTB',
      latitude: -8.3589,
      longitude: 116.5381,
      rating: 4.9,
      reviewCount: 1540,
      entranceFee: 25000,
      currency: 'IDR',
      openingHours: '24 Jam (Camping Ground)',
      estimatedDurationMinutes: 360,
      bestVisitingTime: 'Subuh (04:30) untuk Sunrise atau Camping semalam',
      difficulty: DifficultyLevel.MODERATE,
      tags: JSON.stringify(['Sunrise Sembalun', 'Petak Sawah', 'Camping Ground', 'Fotografi Lanskap']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Pos Registrasi Pendakian', 'Penyewaan Alat Camping', 'Guide Lokal', 'Parkir Aman']),
      tips: JSON.stringify(['Suhu udara di puncak bisa mencapai 10-15°C pada malam hari, siapkan jaket tebal windproof.']),
      isFeatured: true,
    },
    // 15. Bukit Selong
    {
      id: 'dest_bukit_selong',
      slug: 'bukit-selong',
      name: 'Bukit Selong Sembalun',
      shortDescription: 'Spot gardu pandang mudah diakses menghadap hamparan sawah Desa Beleq Sembalun.',
      description:
        'Bukit Selong adalah gardu pandang favorit yang sangat mudah diakses hanya dengan berjalan kaki 10 menit dari Desa Adat Beleq Sembalun. Menyuguhkan panorama simetri sawah lereng pegunungan yang sangat fotogenik.',
      categoryId: 'cat_hill',
      region: LombokRegion.LOMBOK_TIMUR,
      locationName: 'Sembalun, Lombok Timur',
      address: 'Desa Sembalun Lawang, Kec. Sembalun, Lombok Timur, NTB',
      latitude: -8.362,
      longitude: 116.529,
      rating: 4.7,
      reviewCount: 1120,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '06:00 - 18:00 WITA',
      estimatedDurationMinutes: 60,
      bestVisitingTime: 'Pagi hari (06:30 - 08:30) saat kabut tipis menyelimuti lembah',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Gardu Pandang', 'Fotogenik', 'Lembah Sembalun', 'Ramah Keluarga']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Spot Foto Kayu Bintang', 'Warung Kopi Sembalun', 'Toilet', 'Area Parkir']),
      tips: JSON.stringify(['Singgahlah ke situs rumah adat kuno Desa Beleq di kaki bukit sebelum naik.']),
      isFeatured: false,
    },
    // 16. Pantai Pink (Pantai Tangsi)
    {
      id: 'dest_pantai_pink',
      slug: 'pantai-pink-tangsi',
      name: 'Pantai Pink (Pantai Tangsi)',
      shortDescription: 'Pantai pasir berwarna merah muda alami dari serpihan terumbu karang foraminifera merah.',
      description:
        'Pantai Tangsi atau Pantai Pink Lombok Timur adalah salah satu dari sedikit pantai berpasir merah muda di dunia. Warna pink terlihat semakin menyala saat pasir basah terkena sapuan ombak jernih dan sinar matahari.',
      categoryId: 'cat_beach',
      region: LombokRegion.LOMBOK_TIMUR,
      locationName: 'Jerowaru, Lombok Timur',
      address: 'Desa Sekaroh, Kec. Jerowaru, Kabupaten Lombok Timur, NTB',
      latitude: -8.9056,
      longitude: 116.5683,
      rating: 4.7,
      reviewCount: 1680,
      entranceFee: 25000,
      currency: 'IDR',
      openingHours: '07:00 - 17:30 WITA',
      estimatedDurationMinutes: 180,
      bestVisitingTime: 'Pukul 08:00 - 11:30 atau 14:00 - 16:30 saat pantulan sinar matahari optimal',
      difficulty: DifficultyLevel.MODERATE,
      tags: JSON.stringify(['Pasir Pink', 'Snorkeling', 'Tebing Karang', 'Eksotis', 'Lombok Timur']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Perahu Sewa Snorkeling ke Gili Petelu', 'Warung Seafood Ikan Bakar', 'Toilet', 'Gazebo']),
      tips: JSON.stringify(['Sewa perahu lokal untuk snorkeling ke Gili Petelu dan melihat spot pasir timbul di dekatnya.']),
      isFeatured: true,
    },
    // 17. Tanjung Ringgit
    {
      id: 'dest_tanjung_ringgit',
      slug: 'tanjung-ringgit',
      name: 'Tanjung Ringgit & Tebing Samudra',
      shortDescription: 'Ujung tenggara pulau Lombok dengan tebing karang tegak lurus dan peninggalan meriam Jepang.',
      description:
        'Tanjung Ringgit menyajikan pemandangan tebing putih tegak lurus menghadap Samudra Hindia luas dan Selat Alas dengan latar siluet Pulau Sumbawa. Terdapat juga situs sejarah gua dan meriam peninggalan perang dunia ke-2.',
      categoryId: 'cat_adventure',
      region: LombokRegion.LOMBOK_TIMUR,
      locationName: 'Jerowaru, Lombok Timur',
      address: 'Desa Pamotan, Kec. Jerowaru, Lombok Timur, NTB',
      latitude: -8.8639,
      longitude: 116.6028,
      rating: 4.6,
      reviewCount: 540,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '06:00 - 18:00 WITA',
      estimatedDurationMinutes: 120,
      bestVisitingTime: 'Pagi hari untuk sunrise atau Sore hari untuk pemandangan dramatis',
      difficulty: DifficultyLevel.MODERATE,
      tags: JSON.stringify(['Tebing Karang', 'Peninggalan Jepang', 'Lanskap Liar', 'Fotografi Drone']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Area Parkir Alam', 'Spot Pemandangan']),
      tips: JSON.stringify(['Tetap berhati-hati dan jangan berdiri terlalu dekat di bibir tebing karena tidak ada pagar pembatas.']),
      isFeatured: false,
    },
    // 18. Pantai Senggigi
    {
      id: 'dest_pantai_senggigi',
      slug: 'pantai-senggigi',
      name: 'Pantai Senggigi & Pesisir Barat',
      shortDescription: 'Kawasan resort legendaris dengan deretan teluk, kafe tepi pantai, dan pemandangan sunset Agung.',
      description:
        'Pantai Senggigi adalah pusat pariwisata klasik Lombok di pesisir barat. Membentang berkilo-kilometer dengan garis pantai tenang, deretan restoran tepi pantai, hotel resort, dan pemandangan sunset siluet Gunung Agung Bali.',
      categoryId: 'cat_sunset',
      region: LombokRegion.LOMBOK_BARAT,
      locationName: 'Batu Layar, Lombok Barat',
      address: 'Jl. Raya Senggigi, Batu Layar, Kabupaten Lombok Barat, NTB',
      latitude: -8.4967,
      longitude: 116.0467,
      rating: 4.6,
      reviewCount: 2890,
      entranceFee: 5000,
      currency: 'IDR',
      openingHours: '24 Jam',
      estimatedDurationMinutes: 180,
      bestVisitingTime: 'Sore hari (16:30 - 19:00 WITA) untuk menikmati sunset',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Sunset Ikonik', 'Kafe Tepi Pantai', 'Resort', 'Senggigi', 'Kuliner Malam']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Restoran & Bar', 'Pusat Belanja Seni', 'Dermaga Fastboat ke Bali', 'Toilet & Area Parkir Luas']),
      tips: JSON.stringify(['Duduklah di kafe tepi pantai sambil menikmati jagung bakar pedas manis dan kelapa muda saat senja.']),
      isFeatured: true,
    },
    // 19. Bukit Malimbu
    {
      id: 'dest_bukit_malimbu',
      slug: 'bukit-malimbu',
      name: 'Bukit Malimbu',
      shortDescription: 'Spot jalan pesisir ikonik dengan pemandangan deretan pohon kelapa dan gugusan 3 Gili.',
      description:
        'Bukit Malimbu dan Malimbu 2 adalah titik peristirahatan di tepi jalan berliku Senggigi-Pemenang. Menyajikan panorama teluk melengkung yang dihiasi ribuan pohon kelapa, laut biru bergradasi, dan pulau Gili di kejauhan.',
      categoryId: 'cat_sunset',
      region: LombokRegion.LOMBOK_BARAT,
      locationName: 'Pemenang, Lombok Barat/Utara',
      address: 'Jl. Raya Malimbu, Pemenang, NTB',
      latitude: -8.4358,
      longitude: 116.0369,
      rating: 4.8,
      reviewCount: 1980,
      entranceFee: 0,
      currency: 'IDR',
      openingHours: '24 Jam',
      estimatedDurationMinutes: 45,
      bestVisitingTime: 'Sore hari (16:45 - 18:15 WITA)',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Sunset Point', 'Spot Foto Pohon Kelapa', 'View 3 Gili', 'Gratis']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Area Parkir Tepi Jalan', 'Penjual Kelapa Muda & Jagung Bakar', 'Spot Foto']),
      tips: JSON.stringify(['Waspadai monyet liar yang sesekali melompat ke tepi jalan untuk mencari makanan.']),
      isFeatured: false,
    },
    // 20. Air Terjun Benang Kelambu & Benang Stokel
    {
      id: 'dest_benang_kelambu',
      slug: 'air-terjun-benang-kelambu',
      name: 'Air Terjun Benang Kelambu & Benang Stokel',
      shortDescription: 'Air terjun unik yang keluar langsung dari rimbun celah dedaunan tebing seperti kelambu alami.',
      description:
        'Terletak di Geopark Rinjani Lombok Tengah, Air Terjun Benang Kelambu memiliki fenomena unik di mana aliran air keluar langsung dari mata air di balik rimbunnya tanaman pakis dan semak tebing, menyerupai tirai kelambu alami.',
      categoryId: 'cat_waterfall',
      region: LombokRegion.LOMBOK_TENGAH,
      locationName: 'Batukliang Utara, Lombok Tengah',
      address: 'Desa Aik Berik, Kec. Batukliang Utara, Lombok Tengah, NTB',
      latitude: -8.5306,
      longitude: 116.3361,
      rating: 4.7,
      reviewCount: 1250,
      entranceFee: 20000,
      currency: 'IDR',
      openingHours: '07:30 - 17:30 WITA',
      estimatedDurationMinutes: 150,
      bestVisitingTime: 'Pagi hingga siang hari',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Tirai Daun', 'Air Pegunungan', 'Kolam Renang Alami', 'Geopark Rinjani']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Ojek Wisata Lokal', 'Kamar Ganti & Toilet', 'Warung Makan', 'Pemandu Lokal']),
      tips: JSON.stringify(['Jika tidak ingin berjalan 15 menit melalui hutan, Anda bisa menyewa ojek lokal dari loket pintu masuk.']),
      isFeatured: true,
    },
    // 21. Gili Nanggu (Sekotong)
    {
      id: 'dest_gili_nanggu',
      slug: 'gili-nanggu',
      name: 'Gili Nanggu Sekotong',
      shortDescription: 'Pulau perawan di Sekotong dengan akuarium laut alami di mana ikan langsung mengerubungi perenang.',
      description:
        'Gili Nanggu di kawasan Sekotong Lombok Barat adalah pulau surga bawah laut yang sangat tenang. Ribuan ikan hias karang warna-warni akan langsung mengerubungi Anda begitu memasuki air setinggi pinggang.',
      categoryId: 'cat_snorkeling',
      region: LombokRegion.LOMBOK_BARAT,
      locationName: 'Sekotong, Lombok Barat',
      address: 'Kecamatan Sekotong, Kabupaten Lombok Barat, NTB',
      latitude: -8.7236,
      longitude: 116.0125,
      rating: 4.9,
      reviewCount: 1320,
      entranceFee: 15000,
      currency: 'IDR',
      openingHours: '07:00 - 17:00 WITA',
      estimatedDurationMinutes: 240,
      bestVisitingTime: 'Pagi hari (08:30 - 12:00)',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Akuarium Alami', 'Snorkeling Tenang', 'Pulau Perawan', 'Sekotong']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Penyewaan Perahu Boat', 'Sewa Alat Snorkeling', 'Kantin Tepi Pantai', 'Bungalow']),
      tips: JSON.stringify(['Bawalah roti tawar atau biskuit kering untuk memberi makan ikan saat snorkeling di perairan dangkal.']),
      isFeatured: true,
    },
    // 22. Gili Kedis & Gili Sudak
    {
      id: 'dest_gili_kedis',
      slug: 'gili-kedis-sudak',
      name: 'Gili Kedis & Gili Sudak',
      shortDescription: 'Gili mungil berbentuk hati berpasir putih bersih di tengah laut biru Sekotong.',
      description:
        'Gili Kedis adalah pulau tak berpenghuni berukuran mungil berbentuk hati yang dapat dikelilingi hanya dalam 5 menit jalan kaki. Dipadukan dengan Gili Sudak yang terkenal dengan santap siang kuliner ikan bakar di tepi pantai.',
      categoryId: 'cat_gili',
      region: LombokRegion.LOMBOK_BARAT,
      locationName: 'Sekotong, Lombok Barat',
      address: 'Kecamatan Sekotong, Kabupaten Lombok Barat, NTB',
      latitude: -8.7303,
      longitude: 116.0333,
      rating: 4.8,
      reviewCount: 960,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '07:00 - 17:00 WITA',
      estimatedDurationMinutes: 180,
      bestVisitingTime: 'Siang hari saat pulau pasir muncul sempurna',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Pulau Bentuk Hati', 'Pasir Timbul', 'Ikan Bakar Sudak', 'Fotografi Drone']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Warung Ikan Bakar di Gili Sudak', 'Sewa Perahu Island Hopping']),
      tips: JSON.stringify(['Bawa kamera drone untuk menangkap bentuk pulau hati Gili Kedis dari udara secara sempurna.']),
      isFeatured: false,
    },
    // 23. Desa Gerabah Banyumulek
    {
      id: 'dest_desa_banyumulek',
      slug: 'desa-gerabah-banyumulek',
      name: 'Desa Gerabah Banyumulek',
      shortDescription: 'Pusat kerajinan tanah liat dan gerabah tradisional Lombok dengan teknik kuno khas Sasak.',
      description:
        'Desa Banyumulek terkenal sebagai pusat produksi tembikar dan gerabah tanah liat ekspor Lombok. Salah satu produk ikoniknya adalah Kendi Maling (kendi unik yang diisi air dari lubang bagian bawahnya).',
      categoryId: 'cat_village',
      region: LombokRegion.LOMBOK_BARAT,
      locationName: 'Kediri, Lombok Barat',
      address: 'Banyumulek, Kec. Kediri, Kabupaten Lombok Barat, NTB',
      latitude: -8.6347,
      longitude: 116.1158,
      rating: 4.5,
      reviewCount: 520,
      entranceFee: 0,
      currency: 'IDR',
      openingHours: '08:00 - 17:30 WITA',
      estimatedDurationMinutes: 60,
      bestVisitingTime: 'Pagi atau siang hari',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Gerabah Tanah Liat', 'Kendi Maling', 'Edukasi Kriya', 'Oleh-oleh Seni']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Workshop Membuat Gerabah', 'Galeri Showroom Gerabah', 'Area Parkir']),
      tips: JSON.stringify(['Coba praktik membuat asbak atau cangkir tanah liat langsung di atas roda putar tradisional.']),
      isFeatured: false,
    },
    // 24. Pura Batu Bolong
    {
      id: 'dest_pura_batu_bolong',
      slug: 'pura-batu-bolong',
      name: 'Pura Batu Bolong Senggigi',
      shortDescription: 'Pura tepi tebing karang berlubang menghadap Selat Lombok dengan siluet sunset magis.',
      description:
        'Pura Batu Bolong berdiri megah di atas formasi batu karang hitam yang berlubang menjorok ke laut di pesisir Senggigi. Tempat ibadah umat Hindu yang tenang ini menyajikan panorama sunset paling sakral di Lombok.',
      categoryId: 'cat_culture',
      region: LombokRegion.LOMBOK_BARAT,
      locationName: 'Batu Layar, Lombok Barat',
      address: 'Jl. Raya Senggigi, Batu Layar, Lombok Barat, NTB',
      latitude: -8.5136,
      longitude: 116.0647,
      rating: 4.6,
      reviewCount: 1180,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '07:00 - 19:00 WITA',
      estimatedDurationMinutes: 45,
      bestVisitingTime: 'Sore hari (17:00 - 18:30 WITA)',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Pura Tebing Karang', 'Sunset Magis', 'Wisata Religi & Budaya', 'Senggigi']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Peminjaman Selendang Kuning', 'Area Parkir', 'Penjual Bunga & Dupa']),
      tips: JSON.stringify(['Pengunjung diwajibkan memakai kain selendang kuning yang disediakan di loket masuk sebagai bentuk penghormatan.']),
      isFeatured: false,
    },
    // 25. Taman Narmada
    {
      id: 'dest_taman_narmada',
      slug: 'taman-narmada',
      name: 'Taman Air Narmada (Air Awet Muda)',
      shortDescription: 'Taman istana air bersejarah peninggalan Raja Mataram Karangasem dengan mata air awet muda.',
      description:
        'Dibangun pada tahun 1727 oleh Raja Anak Agung Ngurah Karangasem, Taman Narmada adalah miniatur Gunung Rinjani dan Danau Segara Anak. Di dalamnya terdapat Bale Petirtaan dengan mata air murni yang dipercaya membuat awet muda.',
      categoryId: 'cat_culture',
      region: LombokRegion.LOMBOK_BARAT,
      locationName: 'Narmada, Lombok Barat',
      address: 'Lembuak, Kec. Narmada, Kabupaten Lombok Barat, NTB',
      latitude: -8.5992,
      longitude: 116.2089,
      rating: 4.5,
      reviewCount: 940,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '08:00 - 17:30 WITA',
      estimatedDurationMinutes: 90,
      bestVisitingTime: 'Pagi hari (08:30 - 11:00)',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Istana Air Kerajaan', 'Mata Air Awet Muda', 'Cagar Budaya', 'Kolam Pemandian']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Kolam Renang Umum', 'Flying Fox & Danau Dayung', 'Warung Sate Bulayak Narmada', 'Toilet']),
      tips: JSON.stringify(['Cicipi kuliner legendaris Sate Bulayak bumbu khas Sasak yang banyak dijual di luar gerbang taman.']),
      isFeatured: false,
    },
    // 26. Hutan Monyet Baun Pusuk
    {
      id: 'dest_baun_pusuk',
      slug: 'hutan-monyet-baun-pusuk',
      name: 'Hutan Monyet Baun Pusuk',
      shortDescription: 'Hutan lindung di puncak lintasan pegunungan dengan ratusan kera abu-abu ramah di tepi jalan.',
      description:
        'Baun Pusuk adalah jalur pegunungan hijau yang menghubungkan Lombok Barat dan Lombok Utara. Di titik tertingginya, ratusan kera ekor panjang liar yang ramah berkumpul di sepanjang tepi jalan menunggu diberi kacang.',
      categoryId: 'cat_adventure',
      region: LombokRegion.LOMBOK_UTARA,
      locationName: 'Pemenang, Lombok Utara',
      address: 'Jalan Raya Pusuk, Pemenang, Lombok Utara, NTB',
      latitude: -8.455,
      longitude: 116.0883,
      rating: 4.5,
      reviewCount: 880,
      entranceFee: 0,
      currency: 'IDR',
      openingHours: '24 Jam',
      estimatedDurationMinutes: 45,
      bestVisitingTime: 'Pagi atau sore hari saat cuaca sejuk',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Kera Ekor Panjang', 'Hutan Lindung', 'Jalur Pegunungan', 'Wisata Keluarga']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Warung Kopi & Kelapa Muda', 'Penjual Kacang Makanan Monyet', 'Area Parkir Tepi Jalan']),
      tips: JSON.stringify(['Simpan barang bawaan kecil seperti kacamata dan topi di dalam tas agar tidak diambil oleh kera usil.']),
      isFeatured: false,
    },
    // 27. Shark Point Gili Trawangan
    {
      id: 'dest_shark_point_gili',
      slug: 'shark-point-gili-trawangan',
      name: 'Shark Point & Turtle Point Diving',
      shortDescription: 'Spot selam nomor satu di Gili untuk menjumpai hiu karang, penyu sisik, dan ikan pari manta.',
      description:
        'Shark Point di sisi barat laut Gili Trawangan adalah destinasi scuba diving paling populer. Topografi terumbu karang berundak mulai kedalaman 10 hingga 30 meter menjadi habitat hiu karang sirip putih dan penyu hijau besar.',
      categoryId: 'cat_diving',
      region: LombokRegion.GILI_ISLANDS,
      locationName: 'Gili Trawangan, Lombok Utara',
      address: 'Gili Trawangan, Lombok Utara, NTB',
      latitude: -8.343,
      longitude: 116.028,
      rating: 4.9,
      reviewCount: 1420,
      entranceFee: 450000,
      currency: 'IDR',
      openingHours: '08:00 - 16:00 WITA (Jadwal Dive Boat)',
      estimatedDurationMinutes: 120,
      bestVisitingTime: 'Pagi hari saat visibility air mencapai 25-30 meter',
      difficulty: DifficultyLevel.CHALLENGING,
      tags: JSON.stringify(['Scuba Diving', 'Hiu Karang', 'Penyu Sisik', 'PADI Dive Center', 'Kedalaman 30m']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Penyewaan Alat Scuba Lengkap', 'Pemandu Divemaster PADI', 'Boat Khusus Diving', 'Kamar Bilas']),
      tips: JSON.stringify(['Wajib memiliki sertifikat minimal Open Water Diver untuk menyelam di Shark Point.']),
      isFeatured: true,
    },
    // 28. Gua Bangkang (Prabu)
    {
      id: 'dest_gua_bangkang',
      slug: 'gua-bangkang-prabu',
      name: 'Gua Bangkang (Gua Gale-Gale)',
      shortDescription: 'Gua kelelawar alami dengan pendaran cahaya surga (ray of light) dramatis menembus atap gua.',
      description:
        'Gua Bangkang terletak di perbukitan Desa Prabu dekat Kuta Mandalika. Daya tarik utamanya adalah berkas sinar matahari ("cahaya surga") yang menembus lubang atap gua di tengah kepulan asap dupa dan ribuan kelelawar.',
      categoryId: 'cat_adventure',
      region: LombokRegion.LOMBOK_SELATAN,
      locationName: 'Pujut, Lombok Tengah',
      address: 'Desa Prabu, Kec. Pujut, Lombok Tengah, NTB',
      latitude: -8.8917,
      longitude: 116.275,
      rating: 4.5,
      reviewCount: 620,
      entranceFee: 15000,
      currency: 'IDR',
      openingHours: '08:00 - 17:30 WITA',
      estimatedDurationMinutes: 60,
      bestVisitingTime: 'Siang hari (12:00 - 14:00) saat sinar matahari tegak lurus menembus celah atap gua',
      difficulty: DifficultyLevel.MODERATE,
      tags: JSON.stringify(['Ray of Light', 'Gua Kelelawar', 'Fotografi Artistik', 'Mandalika']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Sewa Senter & Helm Pengaman', 'Pemandu Lokal', 'Area Parkir']),
      tips: JSON.stringify(['Gunakan masker penutup hidung karena aroma guano (kotoran kelelawar) cukup menyengat.']),
      isFeatured: false,
    },
    // 29. Pantai Kuta Lombok & Mandalika
    {
      id: 'dest_pantai_kuta_lombok',
      slug: 'pantai-kuta-mandalika',
      name: 'Pantai Kuta Mandalika & Bazaar',
      shortDescription: 'Pusat keramaian Mandalika dengan pedestrian modern tepi pantai dan sirkuit internasional MotoGP.',
      description:
        'Pantai Kuta Mandalika adalah jantung kawasan ekonomi khusus pariwisata Lombok Selatan. Dilengkapi promenade pedestrian luas, spot tulisan ikonik Mandalika, pusat kuliner kafe modern, dan berdekatan dengan Sirkuit Internasional Pertamina Mandalika.',
      categoryId: 'cat_beach',
      region: LombokRegion.LOMBOK_SELATAN,
      locationName: 'Kuta, Pujut, Lombok Tengah',
      address: 'Kuta, Pujut, Kabupaten Lombok Tengah, NTB',
      latitude: -8.8933,
      longitude: 116.2806,
      rating: 4.7,
      reviewCount: 3400,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '24 Jam',
      estimatedDurationMinutes: 120,
      bestVisitingTime: 'Sore hingga malam hari untuk kuliner dan suasana santai',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Sirkuit Mandalika', 'Pusat Wisata', 'Bazaar Kuliner', 'Promenade', 'Keluarga']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Bazaar Mandalika', 'Toilet Bersih & Mushola', 'Penyewaan Sepeda Listrik', 'ATM & Minimarket']),
      tips: JSON.stringify(['Sewa skuter atau sepeda listrik untuk menyusuri promenade tepi pantai di sore hari.']),
      isFeatured: true,
    },
    // 30. Pantai Gerupuk & Teluk Bumbang
    {
      id: 'dest_pantai_gerupuk',
      slug: 'pantai-gerupuk',
      name: 'Pantai Gerupuk & Surfing Hub',
      shortDescription: 'Desa nelayan dan pusat selancar dengan beragam pilihan ombak perahu di Teluk Bumbang.',
      description:
        'Gerupuk adalah desa nelayan di ujung timur Mandalika yang menjadi hub utama para surfer. Memiliki 5 titik spot ombak berbeda (Inside, Outside, Don-Don, Kid’s Point) yang diakses menggunakan perahu nelayan kayu.',
      categoryId: 'cat_surfing',
      region: LombokRegion.LOMBOK_SELATAN,
      locationName: 'Pujut, Lombok Tengah',
      address: 'Desa Gerupuk, Sengkol, Kec. Pujut, Lombok Tengah, NTB',
      latitude: -8.9189,
      longitude: 116.3408,
      rating: 4.7,
      reviewCount: 890,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '06:00 - 18:30 WITA',
      estimatedDurationMinutes: 180,
      bestVisitingTime: 'Pagi hari (06:30 - 10:30) saat ombak offshore',
      difficulty: DifficultyLevel.MODERATE,
      tags: JSON.stringify(['Surfing Boat Trip', 'Desa Nelayan', 'Budidaya Rumput Laut', 'Ombak Beragam']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Sewa Perahu Surfing', 'Surfing Camp & Homestay', 'Kafe Tepi Teluk', 'Perbaikan Papan Selancar']),
      tips: JSON.stringify(['Sewa perahu bersama peselancar lain untuk membagi biaya sewa boat surfing.']),
      isFeatured: false,
    },
    // 31. Air Terjun Mangku Sakti
    {
      id: 'dest_mangku_sakti',
      slug: 'air-terjun-mangku-sakti',
      name: 'Air Terjun Mangku Sakti Sembalun',
      shortDescription: 'Air terjun belerang berwarna putih toska mengalir di antara celah ngarai bebatuan artistik.',
      description:
        'Air Terjun Mangku Sakti di Sajang Sembalun memiliki keunikan air belerang berwarna hijau toska susu yang bersumber langsung dari kawah Gunung Rinjani, mengalir meliuk di antara ngarai tebing bebatuan marmer putih alami.',
      categoryId: 'cat_waterfall',
      region: LombokRegion.LOMBOK_TIMUR,
      locationName: 'Sajang, Sembalun, Lombok Timur',
      address: 'Desa Sajang, Kec. Sembalun, Lombok Timur, NTB',
      latitude: -8.3125,
      longitude: 116.5167,
      rating: 4.8,
      reviewCount: 740,
      entranceFee: 20000,
      currency: 'IDR',
      openingHours: '07:30 - 17:00 WITA',
      estimatedDurationMinutes: 180,
      bestVisitingTime: 'Pagi hari saat cuaca cerah',
      difficulty: DifficultyLevel.MODERATE,
      tags: JSON.stringify(['Air Belerang Toska', 'Ngarai Bebatuan Alami', 'Petualangan Sembalun', 'Geowisata']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Ojek Motor Trail Menuju Lokasi', 'Pemandu Lokal Sajang', 'Warung Makanan Ringan']),
      tips: JSON.stringify(['Air belerang alami ini sangat baik dan berkhasiat untuk kesehatan kulit.']),
      isFeatured: true,
    },
    // 32. Pantai Seger & Monumen Putri Mandalika
    {
      id: 'dest_pantai_seger',
      slug: 'pantai-seger-mandalika',
      name: 'Pantai Seger & Bukit Seger',
      shortDescription: 'Pusat festival legenda Putri Mandalika (Bau Nyale) dengan pemandangan langsung sirkuit balap.',
      description:
        'Pantai Seger adalah pantai legendaris tempat diselenggarakannya Festival Bau Nyale tahunan. Di tepi pantainya berdiri monumen patung Putri Mandalika, dan Bukit Seger di atasnya menyuguhkan sudut pandang terbaik ke lintasan Sirkuit Mandalika.',
      categoryId: 'cat_culture',
      region: LombokRegion.LOMBOK_SELATAN,
      locationName: 'Kuta, Pujut, Lombok Tengah',
      address: 'Kuta, Kec. Pujut, Kabupaten Lombok Tengah, NTB',
      latitude: -8.9014,
      longitude: 116.3028,
      rating: 4.7,
      reviewCount: 1640,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '06:00 - 18:30 WITA',
      estimatedDurationMinutes: 90,
      bestVisitingTime: 'Sore hari (16:30 - 18:15) untuk sunset dan melihat sirkuit balap',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Legenda Bau Nyale', 'View Sirkuit MotoGP', 'Patung Putri Mandalika', 'Sunset Spot']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Jembatan Bambu Ikonik', 'Area Parkir', 'Warung Kelapa Muda', 'Spot Foto Bukit']),
      tips: JSON.stringify(['Naiklah ke Bukit Seger untuk melihat tikungan sirkuit balap MotoGP dan laut lepas dalam satu frame foto.']),
      isFeatured: true,
    },
    // 33. Lembah Sembalun & Kebun Strawberry
    {
      id: 'dest_kebun_strawberry_sembalun',
      slug: 'lembah-sembalun-strawberry',
      name: 'Lembah Sembalun & Agrowisata Strawberry',
      shortDescription: 'Kawasan agrowisata sejuk pegunungan Sembalun dengan pengalaman petik buah strawberry segar.',
      description:
        'Lembah Sembalun terletak di ketinggian 1.100 mdpl dengan hawa sejuk pegunungan. Traveler dapat menikmati agrowisata memetik langsung buah strawberry segar dari kebun petani lokal sambil memandangi tebing perbukitan megah.',
      categoryId: 'cat_village',
      region: LombokRegion.LOMBOK_TIMUR,
      locationName: 'Sembalun, Lombok Timur',
      address: 'Desa Sembalun Bumbung, Kec. Sembalun, Lombok Timur, NTB',
      latitude: -8.375,
      longitude: 116.5333,
      rating: 4.7,
      reviewCount: 1450,
      entranceFee: 15000,
      currency: 'IDR',
      openingHours: '08:00 - 17:00 WITA',
      estimatedDurationMinutes: 90,
      bestVisitingTime: 'Pagi hari (08:30 - 11:30) saat buah strawberry segar siap dipetik',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Petik Strawberry', 'Agrowisata Sejuk', 'Lembah Sembalun', 'Keluarga']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Keranjang & Gunting Petik', 'Kafe Jus Strawberry Segar', 'Area Parkir', 'Toilet']),
      tips: JSON.stringify(['Pilihlah buah strawberry berwarna merah pekat untuk rasa manis segar optimal.']),
      isFeatured: false,
    },
    // 34. Pantai Nipah
    {
      id: 'dest_pantai_nipah',
      slug: 'pantai-nipah',
      name: 'Pantai Nipah & Kuliner Ikan Bakar',
      shortDescription: 'Pantai berpasir putih teduh dengan deretan warung kuliner ikan bakar segar bumbu plecing.',
      description:
        'Pantai Nipah terletak di sepanjang jalan raya pesisir Senggigi-Pemenang. Terkenal dengan air laut tenang yang aman untuk anak-anak berenang dan warung kuliner ikan bakar segar tepi pantai berharga sangat terjangkau.',
      categoryId: 'cat_culinary',
      region: LombokRegion.LOMBOK_UTARA,
      locationName: 'Pemenang, Lombok Utara',
      address: 'Desa Malaka, Kec. Pemenang, Kabupaten Lombok Utara, NTB',
      latitude: -8.4125,
      longitude: 116.0397,
      rating: 4.7,
      reviewCount: 1820,
      entranceFee: 5000,
      currency: 'IDR',
      openingHours: '08:00 - 19:00 WITA',
      estimatedDurationMinutes: 120,
      bestVisitingTime: 'Siang hari saat waktu makan siang (11:30 - 14:30) atau Sore hari',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Ikan Bakar Segar', 'Sambal Plecing', 'Berenang Tenang', 'Keluarga', 'Pohon Kelapa']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Deretan Warung Ikan Bakar', 'Penyewaan Ban & Kano', 'Toilet & Kamar Bilas', 'Area Parkir Teduh']),
      tips: JSON.stringify(['Pesanlah paket ikan bakar kakap merah atau baronang lengkap dengan plecing kangkung dan sambal terasi bakar.']),
      isFeatured: true,
    },
    // 35. Desa Adat Ende
    {
      id: 'dest_desa_ende',
      slug: 'desa-adat-ende',
      name: 'Desa Adat Ende',
      shortDescription: 'Perkampungan asli suku Sasak yang asri dan tenang dengan tradisi tarian perang peresean.',
      description:
        'Desa Adat Ende terletak tidak jauh dari Bandara Internasional Lombok. Menawarkan pengalaman budaya Sasak yang lebih tenang dan mendalam, di mana pengunjung dapat menyaksikan atraksi pertarungan perisai tradisional "Peresean".',
      categoryId: 'cat_culture',
      region: LombokRegion.LOMBOK_TENGAH,
      locationName: 'Pujut, Lombok Tengah',
      address: 'Desa Sengkol, Kec. Pujut, Kabupaten Lombok Tengah, NTB',
      latitude: -8.825,
      longitude: 116.2875,
      rating: 4.6,
      reviewCount: 680,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '08:00 - 18:00 WITA',
      estimatedDurationMinutes: 75,
      bestVisitingTime: 'Pagi atau sore hari',
      difficulty: DifficultyLevel.EASY,
      tags: JSON.stringify(['Tradisi Peresean', 'Rumah Tradisional Sasak', 'Budaya Lombok', 'Dekat Bandara']),
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      facilities: JSON.stringify(['Pemandu Budaya Lokal', 'Pusat Suvenir Tradisional', 'Toilet', 'Area Parkir']),
      tips: JSON.stringify(['Sangat pas dikunjungi sebagai destinasi pertama setelah mendarat di bandara Lombok.']),
      isFeatured: false,
    },
  ];

  for (const dest of destinationsData) {
    const primaryMedia = getMediaForDestination(dest.categoryId, dest.id);
    const secondaryMedia =
      dest.categoryId === 'cat_beach'
        ? CLOUDINARY_MEDIA.sunset_senggigi
        : dest.categoryId === 'cat_mountain'
        ? CLOUDINARY_MEDIA.air_terjun
        : dest.categoryId === 'cat_waterfall'
        ? CLOUDINARY_MEDIA.gunung_rinjani
        : CLOUDINARY_MEDIA.pantai_kuta;

    await prisma.destination.create({
      data: {
        ...dest,
        coverImageUrl: primaryMedia.url,
        coverImagePublicId: primaryMedia.publicId,
        images: {
          create: [
            {
              imageUrl: primaryMedia.url,
              imagePublicId: primaryMedia.publicId,
              caption: `${dest.name} - Panorama Utama`,
              orderIndex: 0,
              isPrimary: true,
            },
            {
              imageUrl: secondaryMedia.url,
              imagePublicId: secondaryMedia.publicId,
              caption: `${dest.name} - Suasana Sekitar`,
              orderIndex: 1,
              isPrimary: false,
            },
          ],
        },
      },
    });
  }

  // =========================================================================
  // 5. SEED 8 RESTAURANTS
  // =========================================================================
  const restaurantsData = [
    {
      id: 'rest_ayam_taliwang_h_ipip',
      name: 'Ayam Taliwang H. Ipip Mataram',
      slug: 'ayam-taliwang-h-ipip',
      description:
        'Kuliner legendaris khas Sasak Lombok dengan sajian ayam kampung muda bakar pedas manis aromatik dan plecing kangkung segar.',
      cuisineType: 'Khas Sasak / Tradisional',
      specialtyDish: 'Ayam Taliwang Bakar & Plecing Kangkung',
      priceRange: 'Rp 35.000 - Rp 85.000 / orang',
      minPrice: 35000,
      maxPrice: 85000,
      rating: 4.8,
      reviewCount: 1420,
      address: 'Jl. Majapahit No. 45, Mataram, NTB',
      region: LombokRegion.LOMBOK_BARAT,
      latitude: -8.5833,
      longitude: 116.1167,
      openingHours: '10:00 - 22:00 WITA',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800']),
      isHalalCertified: true,
    },
    {
      id: 'rest_sate_bulayak_suranadi',
      name: 'Sate Bulayak Suranadi',
      slug: 'sate-bulayak-suranadi',
      description:
        'Sate daging sapi empuk berbumbu rempah kacang kelapa khas Sasak yang disajikan bersama lontong lilit daun aren (bulayak).',
      cuisineType: 'Sate Tradisional Sasak',
      specialtyDish: 'Sate Daging Sapi Bulayak & Urat',
      priceRange: 'Rp 25.000 - Rp 45.000 / porsi',
      minPrice: 25000,
      maxPrice: 45000,
      rating: 4.7,
      reviewCount: 890,
      address: 'Kawasan Wisata Hutan Suranadi, Narmada, Lombok Barat, NTB',
      region: LombokRegion.LOMBOK_BARAT,
      latitude: -8.5633,
      longitude: 116.2378,
      openingHours: '09:00 - 18:00 WITA',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800']),
      isHalalCertified: true,
    },
    {
      id: 'rest_nasi_balap_puyung',
      name: 'Nasi Balap Puyung Inaq Esun',
      slug: 'nasi-balap-puyung-inaq-esun',
      description:
        'Kuliner ikonik Lombok Tengah dengan sajian nasi hangat, ayam suwir pedas mercon, kedelai goreng renyah, dan tumis buncis.',
      cuisineType: 'Khas Lombok Tengah',
      specialtyDish: 'Nasi Balap Puyung Komplit Super Pedas',
      priceRange: 'Rp 20.000 - Rp 35.000 / porsi',
      minPrice: 20000,
      maxPrice: 35000,
      rating: 4.8,
      reviewCount: 2150,
      address: 'Desa Puyung, Jonggat, Kabupaten Lombok Tengah, NTB',
      region: LombokRegion.LOMBOK_TENGAH,
      latitude: -8.7011,
      longitude: 116.2417,
      openingHours: '08:00 - 21:00 WITA',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=800']),
      isHalalCertified: true,
    },
    {
      id: 'rest_warung_menega_senggigi',
      name: 'Warung Menega Ikan Bakar Senggigi',
      slug: 'warung-menega-senggigi',
      description:
        'Restoran seafood tepi pantai Senggigi yang menyajikan aneka tangkapan laut segar dibakar di atas arang batok kelapa saat sunset.',
      cuisineType: 'Seafood Tepi Pantai',
      specialtyDish: 'Ikan Baronang Bakar Madu & Kepiting Saus Padang',
      priceRange: 'Rp 65.000 - Rp 150.000 / orang',
      minPrice: 65000,
      maxPrice: 150000,
      rating: 4.7,
      reviewCount: 1670,
      address: 'Jl. Raya Senggigi No. 65, Batu Layar, Lombok Barat, NTB',
      region: LombokRegion.LOMBOK_BARAT,
      latitude: -8.4983,
      longitude: 116.0456,
      openingHours: '11:00 - 23:00 WITA',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=800']),
      isHalalCertified: true,
    },
    {
      id: 'rest_ashtari_kuta_mandalika',
      name: 'Ashtari Lounge & Kitchen Mandalika',
      slug: 'ashtari-lounge-mandalika',
      description:
        'Restoran dan cafe di puncak bukit Prabu dengan panorama 180 derajat menghadap seluruh garis pantai teluk Kuta Mandalika.',
      cuisineType: 'Western / Healthy & Indonesian Fusion',
      specialtyDish: 'Smoothie Bowl Tropis & Gourmet Pizza',
      priceRange: 'Rp 60.000 - Rp 140.000 / orang',
      minPrice: 60000,
      maxPrice: 140000,
      rating: 4.8,
      reviewCount: 1890,
      address: 'Jl. Mawun, Desa Prabu, Kuta Mandalika, Lombok Tengah, NTB',
      region: LombokRegion.LOMBOK_SELATAN,
      latitude: -8.8978,
      longitude: 116.2736,
      openingHours: '08:00 - 22:00 WITA',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800']),
      isHalalCertified: false,
    },
    {
      id: 'rest_scallywags_gili_trawangan',
      name: 'Scallywags Organic Seafood Bar & Grill Gili',
      slug: 'scallywags-gili-trawangan',
      description:
        'Restoran barbekyu seafood organik tepi pantai Gili Trawangan di mana Anda dapat memilih langsung ikan, lobster, dan cumi segar.',
      cuisineType: 'Seafood Grill & BBQ Internasional',
      specialtyDish: 'Grilled Lobster & Fresh Mahi-mahi Fillet',
      priceRange: 'Rp 95.000 - Rp 250.000 / orang',
      minPrice: 95000,
      maxPrice: 250000,
      rating: 4.8,
      reviewCount: 1980,
      address: 'South Beach, Gili Trawangan, Lombok Utara, NTB',
      region: LombokRegion.GILI_ISLANDS,
      latitude: -8.3556,
      longitude: 116.0389,
      openingHours: '07:30 - 23:30 WITA',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800']),
      isHalalCertified: false,
    },
    {
      id: 'rest_warung_sasak_senaru',
      name: 'Warung Sasak Rinjani Senaru',
      slug: 'warung-sasak-rinjani-senaru',
      description:
        'Kuliner lokal penghangat tubuh di kaki Gunung Rinjani dengan sajian sup bebalung iga sapi rempah dan kopi Sembalun.',
      cuisineType: 'Tradisional Sasak Pegunungan',
      specialtyDish: 'Sup Bebalung Sapi Rempah & Kopi Arabika Sembalun',
      priceRange: 'Rp 30.000 - Rp 65.000 / porsi',
      minPrice: 30000,
      maxPrice: 65000,
      rating: 4.7,
      reviewCount: 640,
      address: 'Jalan Pariwisata Senaru, Bayan, Lombok Utara, NTB',
      region: LombokRegion.LOMBOK_UTARA,
      latitude: -8.2995,
      longitude: 116.4065,
      openingHours: '07:00 - 21:00 WITA',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=800']),
      isHalalCertified: true,
    },
    {
      id: 'rest_el_bazar_kuta',
      name: 'El Bazar Cafe & Restaurant Mandalika',
      slug: 'el-bazar-kuta-mandalika',
      description:
        'Restoran bertema Mediterania dan Maroko di pusat Kuta Mandalika dengan sajian tagine, mezze platter, dan kopi otentik.',
      cuisineType: 'Mediterranean & Middle Eastern',
      specialtyDish: 'Lamb Tagine with Couscous & Hummus Platter',
      priceRange: 'Rp 65.000 - Rp 160.000 / orang',
      minPrice: 65000,
      maxPrice: 160000,
      rating: 4.7,
      reviewCount: 1120,
      address: 'Jl. Raya Kuta No. 5, Kuta, Lombok Tengah, NTB',
      region: LombokRegion.LOMBOK_SELATAN,
      latitude: -8.8922,
      longitude: 116.2795,
      openingHours: '07:30 - 23:00 WITA',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800']),
      isHalalCertified: false,
    },
  ];

  for (const rest of restaurantsData) {
    await prisma.restaurant.create({
      data: {
        ...rest,
        coverImageUrl: CLOUDINARY_MEDIA.kuliner_sasak.url,
        coverImagePublicId: CLOUDINARY_MEDIA.kuliner_sasak.publicId,
        images: JSON.stringify([CLOUDINARY_MEDIA.kuliner_sasak.url, CLOUDINARY_MEDIA.sunset_senggigi.url]),
      },
    });
  }

  // =========================================================================
  // 6. SEED 7 ACCOMMODATIONS
  // =========================================================================
  const accommodationsData = [
    {
      id: 'acc_pullman_mandalika',
      name: 'Pullman Lombok Merujani Mandalika Beach Resort',
      slug: 'pullman-lombok-mandalika',
      type: 'Resort Bintang 5',
      description:
        'Resort tepi pantai bintang 5 premium di jantung Mandalika dengan pemandangan langsung Samudra Hindia, kolam renang infinity, dan spa mewah.',
      rating: 4.8,
      reviewCount: 520,
      pricePerNight: 1850000,
      currency: 'IDR',
      address: 'ITDC Area, Kuta Mandalika, Pujut, Lombok Tengah, NTB',
      region: LombokRegion.LOMBOK_SELATAN,
      latitude: -8.895,
      longitude: 116.29,
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800']),
      amenities: JSON.stringify(['Private Beach', 'Infinity Pool', 'Spa & Wellness', 'Free WiFi', 'Breakfast Included', 'Fitness Center']),
    },
    {
      id: 'acc_katamaran_resort_senggigi',
      name: 'Katamaran Hotel & Resort Senggigi',
      slug: 'katamaran-resort-senggigi',
      type: 'Resort Tepi Pantai Bintang 5',
      description:
        'Resort mewah dengan kolam renang kaca berdinding transparan di tepi pantai Mangsit Senggigi dengan pemandangan sunset terbaik ke Gunung Agung.',
      rating: 4.9,
      reviewCount: 840,
      pricePerNight: 1650000,
      currency: 'IDR',
      address: 'Jl. Raya Senggigi, Mangsit, Senggigi, Lombok Barat, NTB',
      region: LombokRegion.LOMBOK_BARAT,
      latitude: -8.4725,
      longitude: 116.0365,
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800']),
      amenities: JSON.stringify(['Glass Infinity Pool', 'Beachfront Restaurant', 'Sunset Bar', 'Spa Alami', 'Free High-Speed WiFi']),
    },
    {
      id: 'acc_jeeva_beloam_camp',
      name: 'Jeeva Beloam Beach Camp',
      slug: 'jeeva-beloam-beach-camp',
      type: 'Eco Luxury Glamping & Camp',
      description:
        'Resort eco-luxury terpencil di teluk privat Tanjung Ringgit Lombok Timur dengan pondok kayu beratap alang-alang dan pantai pribadi berpasir putih.',
      rating: 4.9,
      reviewCount: 310,
      pricePerNight: 2400000,
      currency: 'IDR',
      address: 'Jl. Pantai Beloam, Tanjung Ringgit, Jerowaru, Lombok Timur, NTB',
      region: LombokRegion.LOMBOK_TIMUR,
      latitude: -8.8756,
      longitude: 116.5895,
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800']),
      amenities: JSON.stringify(['Private Cove Beach', 'All-Inclusive Dining', 'Snorkeling Gear', 'Sea Kayaking', 'Eco-Friendly Solarpower']),
    },
    {
      id: 'acc_rinjani_lodge_senaru',
      name: 'Rinjani Lodge Senaru',
      slug: 'rinjani-lodge-senaru',
      type: 'Boutique Mountain Lodge',
      description:
        'Lodge butik di lereng perbukitan Senaru dengan kolam renang infinity berpemandangan spektakuler menghadap lembah hutan dan puncak Rinjani.',
      rating: 4.8,
      reviewCount: 620,
      pricePerNight: 950000,
      currency: 'IDR',
      address: 'Jalan Pariwisata Senaru, Bayan, Lombok Utara, NTB',
      region: LombokRegion.LOMBOK_UTARA,
      latitude: -8.3025,
      longitude: 116.4095,
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800']),
      amenities: JSON.stringify(['Mountain View Infinity Pool', 'Restoran Kopi Rinjani', 'Dekat Pintu Masuk Air Terjun', 'WiFi']),
    },
    {
      id: 'acc_villa_ombak_gili',
      name: 'Hotel Villa Ombak Gili Trawangan',
      slug: 'hotel-villa-ombak-gili-trawangan',
      type: 'Resort Tradisional Sasak',
      description:
        'Resort internasional pertama di Gili Trawangan dengan arsitektur rumah lumbung Sasak tradisional yang elegan tepat di tepi pantai pasir putih.',
      rating: 4.7,
      reviewCount: 1450,
      pricePerNight: 1200000,
      currency: 'IDR',
      address: 'Gili Trawangan, Pemenang, Lombok Utara, NTB',
      region: LombokRegion.GILI_ISLANDS,
      latitude: -8.3565,
      longitude: 116.0415,
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800']),
      amenities: JSON.stringify(['Large Saltwater Pool', 'Beachfront Dining', 'PADI Dive Centre', 'Spa Treatment', 'Island Tour Service']),
    },
    {
      id: 'acc_novotel_lombok',
      name: 'Novotel Lombok Resort & Villas',
      slug: 'novotel-lombok-resort-villas',
      type: 'Resort Keluarga Tradisional',
      description:
        'Resort tepi pantai Pantai Seger Mandalika dengan atap jerami khas suku Sasak, taman tropis rimbun, dan pantai privat berombak tenang.',
      rating: 4.7,
      reviewCount: 980,
      pricePerNight: 1350000,
      currency: 'IDR',
      address: 'Pantai Putri Nyale, Pujut, Lombok Tengah, NTB',
      region: LombokRegion.LOMBOK_SELATAN,
      latitude: -8.9002,
      longitude: 116.2995,
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800']),
      amenities: JSON.stringify(['3 Outdoor Pools', 'Private Beach Access', 'Kids Club & Activities', 'Daily Buffet Breakfast', 'Water Sports']),
    },
    {
      id: 'acc_sembalun_kita_cottage',
      name: 'Sembalun Kita Cottage & Mountain Glamping',
      slug: 'sembalun-kita-cottage',
      type: 'Cottage & Glamping Pegunungan',
      description:
        'Penginapan cottage kayu hangat di tengah perkebunan strawberry Sembalun dengan pemandangan langsung ke megahnya Bukit Pergasingan.',
      rating: 4.8,
      reviewCount: 410,
      pricePerNight: 450000,
      currency: 'IDR',
      address: 'Jl. Pariwisata Sembalun Bumbung, Lombok Timur, NTB',
      region: LombokRegion.LOMBOK_TIMUR,
      latitude: -8.3725,
      longitude: 116.5312,
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      images: JSON.stringify(['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800']),
      amenities: JSON.stringify(['Water Heater Kamar Mandi', 'Teras Pemandangan Gunung', 'Sarapan Khas Sembalun', 'Api Unggun Malam Hari']),
    },
  ];

  for (const acc of accommodationsData) {
    await prisma.accommodation.create({
      data: {
        ...acc,
        coverImageUrl: CLOUDINARY_MEDIA.sunset_senggigi.url,
        coverImagePublicId: CLOUDINARY_MEDIA.sunset_senggigi.publicId,
        images: JSON.stringify([CLOUDINARY_MEDIA.sunset_senggigi.url, CLOUDINARY_MEDIA.pantai_kuta.url]),
      },
    });
  }

  // =========================================================================
  // 7. SEED SAMPLE REVIEWS
  // =========================================================================
  const reviewsData = [
    {
      userId: demoUser.id,
      destinationId: 'dest_tanjung_aan',
      rating: 5.0,
      content:
        'Pemandangan luar biasa indah! Pasirnya benar-benar seperti butiran merica dan airnya sangat jernih. Wajib sewa kelapa muda di pinggir pantai.',
      photos: JSON.stringify([CLOUDINARY_MEDIA.pantai_kuta.url]),
    },
    {
      userId: localGuideUser.id,
      destinationId: 'dest_bukit_merese',
      rating: 5.0,
      content:
        'Sebagai guide lokal, saya selalu membawa tamu ke Bukit Merese untuk menikmati sunset. Tidak pernah gagal membuat mereka terpesona!',
      photos: JSON.stringify([CLOUDINARY_MEDIA.pantai_kuta.url]),
    },
    {
      userId: demoUser.id,
      destinationId: 'dest_tiu_kelep',
      rating: 5.0,
      content:
        'Trekking menuju Tiu Kelep sangat seru melintasi jembatan air. Saat tiba di depan air terjun, angin dan kabut airnya sangat menyegarkan!',
      photos: JSON.stringify([CLOUDINARY_MEDIA.pantai_kuta.url]),
    },
    {
      userId: demoUser.id,
      destinationId: 'dest_gili_trawangan',
      rating: 5.0,
      content:
        'Snorkeling langsung dari tepi pantai dan langsung bertemu penyu hijau besar! Sore hari keliling pulau naik sepeda adalah pengalaman terbaik.',
      photos: JSON.stringify([CLOUDINARY_MEDIA.pantai_kuta.url]),
    },
    {
      userId: localGuideUser.id,
      destinationId: 'dest_gunung_rinjani',
      rating: 5.0,
      content:
        'Puncak Dewi Anjani 3.726 mdpl selalu memberikan rasa takjub. Danau Segara Anak di bawah kawah adalah salah satu tempat terindah di dunia.',
      photos: JSON.stringify([CLOUDINARY_MEDIA.pantai_kuta.url]),
    },
  ];

  for (const rev of reviewsData) {
    await prisma.review.create({ data: rev });
  }

  // =========================================================================
  // 8. SEED FAVORITES
  // =========================================================================
  await prisma.favorite.create({
    data: {
      userId: demoUser.id,
      destinationId: 'dest_tanjung_aan',
    },
  });

  await prisma.favorite.create({
    data: {
      userId: demoUser.id,
      destinationId: 'dest_bukit_merese',
    },
  });

  await prisma.favorite.create({
    data: {
      userId: demoUser.id,
      destinationId: 'dest_gili_trawangan',
    },
  });

  // =========================================================================
  // 9. SEED ITINERARIES
  // =========================================================================
  const sampleItinerary = await prisma.itinerary.create({
    data: {
      id: 'itin_3days_lombok_classic',
      userId: demoUser.id,
      title: '3 Hari Jelajah Pesona Lombok Selatan & Gili',
      description:
        'Itinerary lengkap dari pantai eksotis Mandalika, bukit savana Merese, hingga snorkeling air kristal Gili Trawangan.',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      totalDays: 3,
      totalEstimatedBudget: 1850000,
      travelStyle: TravelStyle.BEACH_RELAXATION,
      budgetLevel: BudgetLevel.MID_RANGE,
      pace: 'BALANCED',
      isSaved: true,
      isPublic: true,
      days: {
        create: [
          {
            dayNumber: 1,
            title: 'Hari 1: Eksotika Mandalika & Pesisir Selatan',
            notes: 'Fokus perjalanan di pesisir selatan Lombok Tengah.',
            items: {
              create: [
                {
                  orderIndex: 1,
                  timeSlot: '08:30 - 10:30',
                  destinationId: 'dest_desa_sade',
                  customTitle: 'Eksplorasi Budaya Tradisional Sade',
                  activityNotes: 'Mempelajari adat Sasak dan melihat proses tenun kain songket.',
                  estimatedDurationMinutes: 120,
                  estimatedCost: 35000,
                },
                {
                  orderIndex: 2,
                  timeSlot: '11:00 - 14:00',
                  destinationId: 'dest_tanjung_aan',
                  customTitle: 'Santai & Berenang di Tanjung Aan',
                  activityNotes: 'Berenang di air tenang dan makan siang kelapa muda.',
                  estimatedDurationMinutes: 180,
                  estimatedCost: 75000,
                },
                {
                  orderIndex: 3,
                  timeSlot: '16:00 - 18:30',
                  destinationId: 'dest_bukit_merese',
                  customTitle: 'Sunset Magis di Puncak Bukit Merese',
                  activityNotes: 'Menikmati golden hour matahari terbenam berlatar Samudra Hindia.',
                  estimatedDurationMinutes: 150,
                  estimatedCost: 20000,
                },
              ],
            },
          },
          {
            dayNumber: 2,
            title: 'Hari 2: Petualangan Tropis Air Terjun Senaru',
            notes: 'Trekking di kaki Gunung Rinjani Lombok Utara.',
            items: {
              create: [
                {
                  orderIndex: 1,
                  timeSlot: '09:00 - 14:00',
                  destinationId: 'dest_tiu_kelep',
                  customTitle: 'Trekking Hutan & Air Terjun Tiu Kelep',
                  activityNotes: 'Berenang di kolam air terjun alami.',
                  estimatedDurationMinutes: 300,
                  estimatedCost: 150000,
                },
              ],
            },
          },
          {
            dayNumber: 3,
            title: 'Hari 3: Snorkeling Trio Gili & Pulau Bebas Polusi',
            notes: 'Menyeberang ke Gili Trawangan dari Pelabuhan Teluk Nare.',
            items: {
              create: [
                {
                  orderIndex: 1,
                  timeSlot: '08:30 - 16:30',
                  destinationId: 'dest_gili_trawangan',
                  customTitle: 'Snorkeling Penyu & Keliling Sepeda Gili Trawangan',
                  activityNotes: 'Sewa sepeda santai keliling pulau dan snorkeling.',
                  estimatedDurationMinutes: 480,
                  estimatedCost: 350000,
                },
              ],
            },
          },
        ],
      },
    },
  });

  // =========================================================================
  // 10. SEED RECOMMENDATIONS
  // =========================================================================
  await prisma.recommendation.create({
    data: {
      id: 'rec_south_lombok_beach',
      title: 'Eksotika Bahari Lombok Selatan',
      subtitle: 'Jelajahi pantai pasir merica, bukit perawan, dan ombak Mandalika.',
      bannerUrl: CLOUDINARY_MEDIA.bukit_merese.url,
        bannerPublicId: CLOUDINARY_MEDIA.bukit_merese.publicId,
      travelStyle: TravelStyle.BEACH_RELAXATION,
      budgetLevel: BudgetLevel.MID_RANGE,
      recommendedDays: 3,
      estimatedBudget: 1500000,
      isActive: true,
      destinations: {
        create: [
          { destinationId: 'dest_tanjung_aan', orderIndex: 0 },
          { destinationId: 'dest_bukit_merese', orderIndex: 1 },
          { destinationId: 'dest_desa_sade', orderIndex: 2 },
          { destinationId: 'dest_selong_belanak', orderIndex: 3 },
        ],
      },
    },
  });

  await prisma.recommendation.create({
    data: {
      id: 'rec_north_rinjani_adventure',
      title: 'Petualangan Alam Geopark Rinjani',
      subtitle: 'Trekking hutan tropis, air terjun tersembunyi, dan pesona Sembalun.',
      bannerUrl: CLOUDINARY_MEDIA.bukit_merese.url,
        bannerPublicId: CLOUDINARY_MEDIA.bukit_merese.publicId,
      travelStyle: TravelStyle.NATURE_ADVENTURE,
      budgetLevel: BudgetLevel.MID_RANGE,
      recommendedDays: 3,
      estimatedBudget: 1750000,
      isActive: true,
      destinations: {
        create: [
          { destinationId: 'dest_tiu_kelep', orderIndex: 0 },
          { destinationId: 'dest_bukit_pergasingan', orderIndex: 1 },
          { destinationId: 'dest_mangku_sakti', orderIndex: 2 },
        ],
      },
    },
  });

  // =========================================================================
  // 10B. SEED CURATED ITINERARY TEMPLATES (MULTI-DAY HIERARCHICAL)
  // =========================================================================
  await prisma.itineraryTemplate.create({
    data: {
      id: 'rec_mandalika_3d',
      title: '3 Hari Liburan Seru di Mandalika & Pantai Selatan',
      description:
        'Itinerary kurasi pesona pantai pasir putih, bukit sunset legendaris, dan kekayaan budaya tenun Sasak di Lombok Selatan.',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      totalDays: 3,
      travelStyle: TravelStyle.BEACH_RELAXATION,
      budgetLevel: BudgetLevel.MID_RANGE,
      transportationMode: TransportationMode.CAR,
      transportPaceNote: 'Mobil Sewa / Motor • Santai & Menyenangkan',
      totalEstimatedBudget: 1350000,
      totalDistanceKm: 42.5,
      totalDurationMinutes: 120,
      isPublished: true,
      isFeatured: true,
      sortOrder: 1,
      days: {
        create: [
          {
            dayNumber: 1,
            title: 'Mandalika Coastal Explorer',
            notes: 'Siapkan sunscreen dan kacamata hitam untuk eksplorasi pantai selatan.',
            totalDistanceKm: 8.6,
            totalDurationMinutes: 20,
            estimatedBudget: 450000,
            activities: {
              create: [
                {
                  destinationId: 'dest_tanjung_aan',
                  orderIndex: 0,
                  startTime: '08:30',
                  endTime: '10:30',
                  estimatedDurationMinutes: 120,
                  estimatedCost: 10000,
                  distanceFromPrevKm: 0,
                  travelTimeFromPrevMinutes: 0,
                  activityNotes: 'Menikmati pantai pasir merica dan air laut toska jernih.',
                },
                {
                  destinationId: 'dest_bukit_merese',
                  orderIndex: 1,
                  startTime: '11:00',
                  endTime: '13:00',
                  estimatedDurationMinutes: 120,
                  estimatedCost: 10000,
                  distanceFromPrevKm: 1.4,
                  travelTimeFromPrevMinutes: 5,
                  activityNotes: 'Trekking bukit hijau dengan panorama Samudra Hindia 360 derajat.',
                },
                {
                  destinationId: 'dest_pantai_kuta_lombok',
                  orderIndex: 2,
                  startTime: '15:30',
                  endTime: '18:00',
                  estimatedDurationMinutes: 150,
                  estimatedCost: 10000,
                  distanceFromPrevKm: 7.2,
                  travelTimeFromPrevMinutes: 15,
                  activityNotes: 'Sunset santai di promenade Kuta Mandalika.',
                },
              ],
            },
          },
          {
            dayNumber: 2,
            title: 'Teluk Selong Belanak & Surfing Mawi',
            notes: 'Cocok untuk belajar surfing santai dan berburu sunset eksotis.',
            totalDistanceKm: 18.2,
            totalDurationMinutes: 45,
            estimatedBudget: 500000,
            activities: {
              create: [
                {
                  destinationId: 'dest_selong_belanak',
                  orderIndex: 0,
                  startTime: '09:00',
                  endTime: '12:00',
                  estimatedDurationMinutes: 180,
                  estimatedCost: 15000,
                  distanceFromPrevKm: 0,
                  travelTimeFromPrevMinutes: 0,
                  activityNotes: 'Pantai landai berpasir halus surganya peselancar pemula.',
                },
                {
                  destinationId: 'dest_pantai_mawun',
                  orderIndex: 1,
                  startTime: '13:00',
                  endTime: '15:00',
                  estimatedDurationMinutes: 120,
                  estimatedCost: 10000,
                  distanceFromPrevKm: 8.5,
                  travelTimeFromPrevMinutes: 20,
                  activityNotes: 'Teluk berbentuk tapal kuda berair tenang untuk berenang.',
                },
                {
                  destinationId: 'dest_pantai_mawi',
                  orderIndex: 2,
                  startTime: '15:30',
                  endTime: '18:30',
                  estimatedDurationMinutes: 180,
                  estimatedCost: 10000,
                  distanceFromPrevKm: 9.7,
                  travelTimeFromPrevMinutes: 25,
                  activityNotes: 'Spot sunset karang megah favorit peselancar dunia.',
                },
              ],
            },
          },
          {
            dayNumber: 3,
            title: 'Warisan Budaya Sasak & Tenun Tradisional',
            notes: 'Mengenal kearifan lokal suku Sasak dan berbelanja kain tenun otentik.',
            totalDistanceKm: 15.7,
            totalDurationMinutes: 35,
            estimatedBudget: 400000,
            activities: {
              create: [
                {
                  destinationId: 'dest_desa_sade',
                  orderIndex: 0,
                  startTime: '09:00',
                  endTime: '11:30',
                  estimatedDurationMinutes: 150,
                  estimatedCost: 25000,
                  distanceFromPrevKm: 0,
                  travelTimeFromPrevMinutes: 0,
                  activityNotes: 'Rumah adat Bale Tani dan tarian adat suku Sasak.',
                },
                {
                  destinationId: 'dest_desa_sukarara',
                  orderIndex: 1,
                  startTime: '13:00',
                  endTime: '15:30',
                  estimatedDurationMinutes: 150,
                  estimatedCost: 20000,
                  distanceFromPrevKm: 15.7,
                  travelTimeFromPrevMinutes: 35,
                  activityNotes: 'Mencoba menenun kain songket khas Lombok bersama pengrajin lokal.',
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.itineraryTemplate.create({
    data: {
      id: 'rec_gili_3d',
      title: '3 Hari Surga Bawah Laut & Snorkeling 3 Gili',
      description:
        'Paket perjalanan bahari lengkap mengarungi Gili Trawangan, patung bawah laut Gili Meno, dan ketenangan pasir putih Gili Air.',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      totalDays: 3,
      travelStyle: TravelStyle.BEACH_RELAXATION,
      budgetLevel: BudgetLevel.MID_RANGE,
      transportationMode: TransportationMode.MOTORCYCLE,
      transportPaceNote: 'Speedboat / Sepeda • Wisata Bahari & Snorkeling',
      totalEstimatedBudget: 1750000,
      totalDistanceKm: 22.0,
      totalDurationMinutes: 80,
      isPublished: true,
      isFeatured: true,
      sortOrder: 2,
      days: {
        create: [
          {
            dayNumber: 1,
            title: 'Eksplorasi Gili Trawangan & Sunset Point',
            notes: 'Sewa sepeda untuk keliling pulau tanpa polusi kendaraan bermotor.',
            totalDistanceKm: 7.5,
            totalDurationMinutes: 25,
            estimatedBudget: 600000,
            activities: {
              create: [
                {
                  destinationId: 'dest_gili_trawangan',
                  orderIndex: 0,
                  startTime: '09:00',
                  endTime: '13:00',
                  estimatedDurationMinutes: 240,
                  estimatedCost: 50000,
                  distanceFromPrevKm: 0,
                  travelTimeFromPrevMinutes: 0,
                  activityNotes: 'Menikmati pantai pasir putih dan kafe tepi pantai.',
                },
                {
                  destinationId: 'dest_shark_point_gili',
                  orderIndex: 1,
                  startTime: '14:30',
                  endTime: '17:30',
                  estimatedDurationMinutes: 180,
                  estimatedCost: 150000,
                  distanceFromPrevKm: 2.5,
                  travelTimeFromPrevMinutes: 10,
                  activityNotes: 'Snorkeling dan diving melihat reef shark dan terumbu karang.',
                },
              ],
            },
          },
          {
            dayNumber: 2,
            title: 'Snorkeling Patung Bawah Laut Gili Meno & Penyu',
            notes: 'Berenang bersama penyu hijau liar di konservasi terumbu karang.',
            totalDistanceKm: 6.0,
            totalDurationMinutes: 25,
            estimatedBudget: 650000,
            activities: {
              create: [
                {
                  destinationId: 'dest_gili_meno',
                  orderIndex: 0,
                  startTime: '08:30',
                  endTime: '12:30',
                  estimatedDurationMinutes: 240,
                  estimatedCost: 75000,
                  distanceFromPrevKm: 0,
                  travelTimeFromPrevMinutes: 0,
                  activityNotes: 'Spot patung bawah laut "The Nest" karya Jason deCaires Taylor.',
                },
              ],
            },
          },
          {
            dayNumber: 3,
            title: 'Santai di Pantai Pasir Putih Gili Air',
            notes: 'Suasana pulau yang tenang dan damai untuk relaksasi akhir liburan.',
            totalDistanceKm: 5.5,
            totalDurationMinutes: 20,
            estimatedBudget: 500000,
            activities: {
              create: [
                {
                  destinationId: 'dest_gili_air',
                  orderIndex: 0,
                  startTime: '09:00',
                  endTime: '13:00',
                  estimatedDurationMinutes: 240,
                  estimatedCost: 50000,
                  distanceFromPrevKm: 0,
                  travelTimeFromPrevMinutes: 0,
                  activityNotes: 'Bersantai menikmati ayunan laut dan kuliner segar kelapa muda.',
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.itineraryTemplate.create({
    data: {
      id: 'rec_sembalun_2d',
      title: '2 Hari Petualangan Lereng Rinjani & Lembah Sembalun',
      description:
        'Rasakan udara pegunungan yang sejuk, panorama petak sawah warna-warni Sembalun, dan gemuruh air terjun Tiu Kelep.',
      coverImageUrl: CLOUDINARY_MEDIA.pantai_kuta.url,
      coverImagePublicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
      totalDays: 2,
      travelStyle: TravelStyle.NATURE_ADVENTURE,
      budgetLevel: BudgetLevel.MID_RANGE,
      transportationMode: TransportationMode.CAR,
      transportPaceNote: 'Mobil Sewa • Udara Sejuk & Lanskap Pegunungan',
      totalEstimatedBudget: 900000,
      totalDistanceKm: 58.0,
      totalDurationMinutes: 120,
      isPublished: true,
      isFeatured: true,
      sortOrder: 3,
      days: {
        create: [
          {
            dayNumber: 1,
            title: 'Panorama Bukit Pergasingan & Kebun Sembalun',
            notes: 'Bawa jaket hangat karena suhu malam hari bisa mencapai 15°C.',
            totalDistanceKm: 25.0,
            totalDurationMinutes: 50,
            estimatedBudget: 450000,
            activities: {
              create: [
                {
                  destinationId: 'dest_bukit_pergasingan',
                  orderIndex: 0,
                  startTime: '08:00',
                  endTime: '12:00',
                  estimatedDurationMinutes: 240,
                  estimatedCost: 20000,
                  distanceFromPrevKm: 0,
                  travelTimeFromPrevMinutes: 0,
                  activityNotes: 'Pemandangan spektakuler Gunung Rinjani dan hamparan sawah kotak.',
                },
                {
                  destinationId: 'dest_kebun_strawberry_sembalun',
                  orderIndex: 1,
                  startTime: '13:30',
                  endTime: '15:30',
                  estimatedDurationMinutes: 120,
                  estimatedCost: 35000,
                  distanceFromPrevKm: 4.2,
                  travelTimeFromPrevMinutes: 10,
                  activityNotes: 'Petik buah strawberry segar langsung dari kebun agrowisata.',
                },
                {
                  destinationId: 'dest_bukit_selong',
                  orderIndex: 2,
                  startTime: '16:00',
                  endTime: '18:00',
                  estimatedDurationMinutes: 120,
                  estimatedCost: 15000,
                  distanceFromPrevKm: 3.8,
                  travelTimeFromPrevMinutes: 10,
                  activityNotes: 'Spot foto rumah adat Sasak Beleq berlatar perbukitan hijau.',
                },
              ],
            },
          },
          {
            dayNumber: 2,
            title: 'Kesejukan Air Terjun Tiu Kelep & Sendang Gile',
            notes: 'Gunakan sandal gunung/alas kaki anti slip untuk susur sungai.',
            totalDistanceKm: 33.0,
            totalDurationMinutes: 70,
            estimatedBudget: 450000,
            activities: {
              create: [
                {
                  destinationId: 'dest_sendang_gile',
                  orderIndex: 0,
                  startTime: '08:30',
                  endTime: '10:30',
                  estimatedDurationMinutes: 120,
                  estimatedCost: 20000,
                  distanceFromPrevKm: 0,
                  travelTimeFromPrevMinutes: 0,
                  activityNotes: 'Air terjun bertingkat megah di gerbang masuk pendakian Senaru.',
                },
                {
                  destinationId: 'dest_tiu_kelep',
                  orderIndex: 1,
                  startTime: '11:00',
                  endTime: '14:00',
                  estimatedDurationMinutes: 180,
                  estimatedCost: 20000,
                  distanceFromPrevKm: 1.2,
                  travelTimeFromPrevMinutes: 30,
                  activityNotes: 'Air terjun mistis dengan kolam alami yang konon membuat awet muda.',
                },
              ],
            },
          },
        ],
      },
    },
  });

  // =========================================================================
  // 11. SEED WEATHER CACHE
  // =========================================================================
  const weatherRegions = [
    {
      region: LombokRegion.LOMBOK_SELATAN,
      locationName: 'Kuta Mandalika, Lombok Selatan',
      condition: 'Cerah & Tropis',
      tempCelsius: 29,
      feelsLikeCelsius: 32,
      humidityPercent: 70,
      windSpeedKmh: 14.5,
      uvIndex: 7,
      iconName: 'sunny',
      recommendationTip: 'Kondisi sangat ideal untuk aktivitas pantai, surfing pemula, dan sunset di Bukit Merese.',
      forecast: JSON.stringify([
        { date: '2026-09-10', dayOfWeek: 'Kamis', condition: 'Cerah Berawan', tempMinCelsius: 24, tempMaxCelsius: 31, humidityPercent: 72, iconName: 'partly_cloudy_day' },
        { date: '2026-09-11', dayOfWeek: 'Jumat', condition: 'Cerah', tempMinCelsius: 24, tempMaxCelsius: 32, humidityPercent: 68, iconName: 'sunny' },
        { date: '2026-09-12', dayOfWeek: 'Sabtu', condition: 'Cerah', tempMinCelsius: 25, tempMaxCelsius: 32, humidityPercent: 70, iconName: 'sunny' },
      ]),
    },
    {
      region: LombokRegion.LOMBOK_UTARA,
      locationName: 'Senaru & Rinjani, Lombok Utara',
      condition: 'Sejuk & Berawan',
      tempCelsius: 24,
      feelsLikeCelsius: 25,
      humidityPercent: 78,
      windSpeedKmh: 10.0,
      uvIndex: 5,
      iconName: 'cloud',
      recommendationTip: 'Suhu sejuk nyaman untuk trekking air terjun Tiu Kelep dan Sendang Gile.',
      forecast: JSON.stringify([
        { date: '2026-09-10', dayOfWeek: 'Kamis', condition: 'Hujan Ringan Siang Hari', tempMinCelsius: 20, tempMaxCelsius: 26, humidityPercent: 82, iconName: 'rain' },
        { date: '2026-09-11', dayOfWeek: 'Jumat', condition: 'Cerah Berawan', tempMinCelsius: 19, tempMaxCelsius: 27, humidityPercent: 75, iconName: 'partly_cloudy_day' },
      ]),
    },
    {
      region: LombokRegion.GILI_ISLANDS,
      locationName: 'Gili Trawangan & Meno',
      condition: 'Cerah Tropis Sempurna',
      tempCelsius: 30,
      feelsLikeCelsius: 33,
      humidityPercent: 66,
      windSpeedKmh: 12.0,
      uvIndex: 8,
      iconName: 'sunny',
      recommendationTip: 'Visibilitas air sangat jernih (25m+), sempurna untuk snorkeling dan scuba diving bersama penyu.',
      forecast: JSON.stringify([
        { date: '2026-09-10', dayOfWeek: 'Kamis', condition: 'Cerah', tempMinCelsius: 25, tempMaxCelsius: 31, humidityPercent: 65, iconName: 'sunny' },
        { date: '2026-09-11', dayOfWeek: 'Jumat', condition: 'Cerah', tempMinCelsius: 25, tempMaxCelsius: 32, humidityPercent: 64, iconName: 'sunny' },
      ]),
    },
  ];

  for (const w of weatherRegions) {
    await prisma.weatherCache.create({ data: w });
  }

  // =========================================================================
  // 12. SEED CHECKLISTS & JOURNALS
  // =========================================================================
  await prisma.checklist.create({
    data: {
      userId: demoUser.id,
      title: 'Perlengkapan Liburan Mandalika & Gili',
      category: ChecklistCategory.BEACH,
      items: {
        create: [
          { itemText: 'Kacamata Hitam Polarized & Sunscreen SPF 50+', isChecked: true, orderIndex: 0 },
          { itemText: 'Dry bag tahan air untuk perahu snorkeling', isChecked: true, orderIndex: 1 },
          { itemText: 'Sepatu sandal trekking antiselip', isChecked: false, orderIndex: 2 },
          { itemText: 'Kamera / Underwater Action Cam', isChecked: false, orderIndex: 3 },
          { itemText: 'Topi pantai & pakaian renang cepat kering', isChecked: true, orderIndex: 4 },
        ],
      },
    },
  });

  await prisma.travelJournal.create({
    data: {
      userId: demoUser.id,
      title: 'Kesan Pertama Menjejakkan Kaki di Bukit Merese',
      content:
        'Sore hari di Bukit Merese benar-benar magis. Angin semilir dari Samudra Hindia dan warna langit senja yang berpendar jingga toska tak akan pernah saya lupakan.',
      locationName: 'Bukit Merese, Pujut',
      photos: JSON.stringify([CLOUDINARY_MEDIA.pantai_kuta.url]),
      isPublic: true,
    },
  });

  await prisma.expense.create({
    data: {
      userId: demoUser.id,
      itineraryId: sampleItinerary.id,
      category: ExpenseCategory.FOOD,
      title: 'Makan Malam Kuliner Ayam Taliwang H. Ipip',
      amount: 85000,
      currency: 'IDR',
    },
  });

  // =========================================================================
  // 12. SEED SAMPLE FEED POSTS
  // =========================================================================
  await prisma.post.create({
    data: {
      id: 'post_seed_merese_sunset',
      userId: demoUser.id,
      title: 'Sunset Magis di Puncak Bukit Merese',
      description:
        'Pemandangan 360 derajat ke laut lepas Mandalika saat matahari terbenam luar biasa indah. Jangan lupa bawa jaket angin dan alas kaki yang nyaman!',
      destinationId: 'dest_bukit_merese',
      locationName: 'Bukit Merese, Pujut',
      latitude: -8.9083,
      longitude: 116.3218,
      status: 'PUBLISHED',
      likeCount: 15,
      commentCount: 2,
      shareCount: 4,
      location: {
        create: {
          name: 'Bukit Merese',
          latitude: -8.9083,
          longitude: 116.3218,
          address: 'Kawasan Mandalika, Pujut, Kabupaten Lombok Tengah, NTB',
          destinationId: 'dest_bukit_merese',
        },
      },
      media: {
        create: [
          {
            url: CLOUDINARY_MEDIA.bukit_merese.url,
            publicId: CLOUDINARY_MEDIA.bukit_merese.publicId,
            type: 'IMAGE',
            sortOrder: 0,
            caption: 'Puncak Bukit Merese saat golden hour',
          },
        ],
      },
      comments: {
        create: [
          {
            userId: baseAdmin.id,
            content: 'Foto yang sangat indah! Salah satu spot sunset terbaik di Lombok.',
          },
        ],
      },
    },
  });

  await prisma.post.create({
    data: {
      id: 'post_seed_tanjung_aan_paddle',
      userId: demoUser.id,
      title: 'Serunya Stand-Up Paddle di Teluk Tanjung Aan',
      description:
        'Ombak di teluk Tanjung Aan sangat tenang dengan air laut hijau toska yang jernih. Pasir mericanya juga sangat unik!',
      destinationId: 'dest_tanjung_aan',
      locationName: 'Pantai Tanjung Aan',
      latitude: -8.9083,
      longitude: 116.3218,
      status: 'PUBLISHED',
      likeCount: 8,
      commentCount: 1,
      shareCount: 1,
      location: {
        create: {
          name: 'Pantai Tanjung Aan',
          latitude: -8.9083,
          longitude: 116.3218,
          address: 'Sengkol, Pujut, Kabupaten Lombok Tengah, NTB',
          destinationId: 'dest_tanjung_aan',
        },
      },
      media: {
        create: [
          {
            url: CLOUDINARY_MEDIA.pantai_kuta.url,
            publicId: CLOUDINARY_MEDIA.pantai_kuta.publicId,
            type: 'IMAGE',
            sortOrder: 0,
            caption: 'Air toska jernih Pantai Tanjung Aan',
          },
        ],
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Lombok Explorer Phase 4 database seeded successfully! (${destinationsData.length} destinations seeded)`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
