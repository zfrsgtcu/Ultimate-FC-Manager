// ============================================================
//  FIFA FC Manager — Merkezi Yapılandırma Dosyası
//  Tüm sayısal ayarlar burada tanımlanır.
//  Herhangi bir değeri değiştirmek için sadece bu dosyayı düzenleyin.
// ============================================================

const CONFIG = {

    // --------------------------------------------------------
    // BANKA & KREDİ
    // --------------------------------------------------------
    BANK: {
        // Bir oyuncunun çekebileceği maksimum kredi miktarı (₺)
        CREDIT_LIMIT: 200,

        // Kredi faiz oranı (anapara üzerine eklenir; 0.38 = %38)
        INTEREST_RATE: 0.38,

        // Her maç sonrası ödenmemiş borca uygulanan ek faiz (1.01 = %1)
        MATCH_DEBT_INTEREST_RATE: 1.01,

        // Sezon sonu ödenmemiş borca uygulanan ek faiz (1.01 = %1)
        SEASON_DEBT_INTEREST_RATE: 1.01,
    },

    // --------------------------------------------------------
    // LİG — Manuel Maç Ekleme Sistemi (league.js)
    // --------------------------------------------------------
    LEAGUE: {
        // Her takımın bir sezonda oynayacağı maksimum maç sayısı
        MAX_MATCHES_PER_TEAM: 5,

        // Galip takımdaki her oyuncuya verilecek prim (₺)
        WIN_BONUS: 20,

        // Beraberlikte her oyuncuya verilecek prim (₺)
        DRAW_BONUS: 2,

        // Atılan her gol başına verilecek prim (₺)
        GOAL_BONUS_PER_GOAL: 14,

        // Şampiyonluk için her oyuncuya verilecek prim (₺)
        CHAMPIONSHIP_BONUS: 100,
    },

    // --------------------------------------------------------
    // FİKSTÜR — Otomatik Fikstür Sistemi (index.html)
    // --------------------------------------------------------
    FIXTURES: {
        // Toplam hafta sayısı (sezon uzunluğu)
        TOTAL_WEEKS: 10,

        // Ev sahibi avantaj katsayısı (olasılık hesabında)
        HOME_ADVANTAGE: 0.3,

        // Galip takımdaki her oyuncuya verilecek prim (₺)
        WIN_BONUS: 25,

        // Beraberlikte her oyuncuya verilecek prim (₺)
        DRAW_BONUS: 6,

        // Atılan her gol başına verilecek prim (₺)
        GOAL_BONUS_PER_GOAL: 12,

        // Şampiyonluk için her oyuncuya verilecek prim (₺)
        CHAMPIONSHIP_BONUS: 111,
    },

    // --------------------------------------------------------
    // KADRO — Oyuncu Alım / Satım Sistemi (kadro.js)
    // --------------------------------------------------------
    KADRO: {
        // Oyuncu satışında toplam maliyetin kaçı geri alınır (0.5 = %50)
        SALE_PRICE_MULTIPLIER: 0.5,

        // Geçerli overall aralığı
        OVERALL_MIN: 60,
        OVERALL_MAX: 99,

        // Overall'a göre maaş kademeleri
        // rate    : haftalık maaş bedeli (₺)
        // divisor : overall'ın kaçıyla çarpılır (alım maliyeti = overall * divisor)
        //           Örnek: divisor 0.5 → 90 OVR = 90 × 0.5 = 45₺ overall maliyeti
        SALARY_TIERS: [
            { min: 91, max: 99, rate: 180, divisor: 4 },  // Elite       — 91-99
            { min: 85, max: 90, rate: 140, divisor: 2.2 },  // World Class — 85-90
            { min: 80, max: 84, rate:  60, divisor: 1.2 },  // Gold+       — 80-84
            { min: 75, max: 79, rate:  41, divisor: 0.5 },  // Gold        — 75-79
            { min: 70, max: 74, rate:  20, divisor: 0.4 },  // Silver+     — 70-74
            { min: 65, max: 69, rate:  16, divisor: 0.4 },  // Silver      — 65-69
            { min: 60, max: 64, rate:  13, divisor: 0.4 },  // Bronze      — 60-64
        ],
    },

    // --------------------------------------------------------
    // KASİNO — Slot Makinesi (casino.js)
    // --------------------------------------------------------
    CASINO: {
        // Minimum bahis miktarı (₺)
        SLOT_MIN_BET: 20,

        // Kazanma olasılığı aralığı (her çevirmede rastgele belirlenir)
        // Gerçek oran = SLOT_WIN_RATE_BASE + (0..1) * SLOT_WIN_RATE_RANGE
        SLOT_WIN_RATE_BASE: 0.08,   // minimum kazanma ihtimali
        SLOT_WIN_RATE_RANGE: 0.35,  // kazanma ihtimali varyansı

        // Kazanç çarpanları (bahis miktarı × çarpan)
        SLOT_PAYOUTS: {
            '3x_same':      2,    // 3 aynı sembol
            '2x_same':      1.5,  // 2 aynı sembol
            'cherry_bonus': 3,    // 3x kiraz özel bonusu
            'jackpot':      5,    // 3x 🎰 jackpot
        },

        // Kazanç kombinasyonu olasılık eşikleri (kümülatif)
        SLOT_WIN_THRESHOLDS: {
            JACKPOT:   0.03,  // %5  — 3x 🎰
            TRIPLE:    0.08,  // %10 — 3x aynı sembol
            DOUBLE:    0.12,  // %20 — 2x aynı sembol
            // geri kalan %65 — 3x kiraz
        },
    },

};

// Config'i global scope'a aç (tüm modüller erişsin)
window.CONFIG = CONFIG;
