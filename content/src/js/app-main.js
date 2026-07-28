// Global variables
let players = JSON.parse(localStorage.getItem('fifaPlayers')) || [];
let currentPlayerId = null;
let balanceOperation = null;
let currentBetAmount = 10;
let isSpinning = false;

// League variables moved to league.js
let currentMatchResult = null;

// Bank variables moved to bank.js
let currentSeason = JSON.parse(localStorage.getItem('fifaCurrentSeason')) || 1;

// Kadro variables moved to kadro.js

// Transaction log variables
let transactionLog = JSON.parse(localStorage.getItem('fifaTransactionLog')) || [];

// Slot symbols and payouts
// Slot variables moved to casino.js

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    // Load players from localStorage first
    players = JSON.parse(localStorage.getItem('fifaPlayers')) || [];
    // Load persisted fixtures if any
    try {
        const f = JSON.parse(localStorage.getItem('fifaFixtures') || 'null');
        const pw = JSON.parse(localStorage.getItem('fifaPlayedWeeks') || 'null');
        if (Array.isArray(f) && f.length) { fixtures = f; }
        if (Array.isArray(pw)) { playedWeeks = new Set(pw); }
    } catch { }
    // Load league state (match results, teams)
    loadLeagueState();

    initializeApp();
    setupEventListeners();

    // Initialize transaction log and match history
    updateTransactionLogDisplay();
    if (typeof updateMatchHistoryDisplay === 'function') {
        updateMatchHistoryDisplay();
    }

    // If fixtures are present from storage, show season UI immediately
    if (fixtures && fixtures.length) {
        seasonStarted = true;
        const weekSel = document.getElementById('weekSelector');
        if (weekSel) weekSel.style.display = 'block';
        const startBtn = document.getElementById('startSeasonBtn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Sezon Oluşturuldu';
            startBtn.classList.remove('hover:from-purple-700', 'hover:to-blue-700', 'hover:scale-105');
            startBtn.classList.add('opacity-75', 'cursor-not-allowed');
        }
        populateWeekSelector();
        updateStandings();
        // If there are stored results, show current selected week matches with those results
        const selected = document.getElementById('weekSelect')?.value || 0;
        displayMatches(parseInt(selected));
    }
});

function initializeApp() {
    // If no players, don't auto-add; open add player modal and guard UI
    if (players.length === 0) {
        updateStats();
        renderPlayers();
        applyPlayersGuard();
        showModal();
        return;
    }

    updateStats();
    renderPlayers();
    applyPlayersGuard();

    // Animations removed for performance
}

// Disable league/feature controls if no players present
function applyPlayersGuard() {
    const hasPlayers = players && players.length > 0;
    const startBtn = document.getElementById('startSeasonBtn');
    const weekSelect = document.getElementById('weekSelect');
    const playWeekBtn = document.getElementById('playWeekBtn');
    if (startBtn) startBtn.disabled = !hasPlayers;
    if (weekSelect) weekSelect.disabled = !hasPlayers;
    if (playWeekBtn) playWeekBtn.disabled = !hasPlayers;
}

// Betting modal controls
function showBetModal(playerId) {
    if (!players || players.length === 0) {
        showModal();
        return;
    }
    currentPlayerId = playerId;
    regenerateOddsSeed();
    buildBetAccordion();
    resetBetSlip();
    const m = document.getElementById('betModal');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function hideBetModal() {
    const m = document.getElementById('betModal');
    m.classList.add('hidden');
    m.classList.remove('flex');
}

// Build betting bulletin for the nearest unplayed week
function buildBetAccordion() {
    const acc = document.getElementById('betAccordion');
    if (!fixtures || fixtures.length === 0) {
        acc.innerHTML = '<p class="text-gray-400 text-center py-4">Önce sezonu oluşturun</p>';
        return;
    }
    let nextWeek = -1;
    for (let i = 0; i < fixtures.length; i++) {
        if (!playedWeeks.has(i)) { nextWeek = i; break; }
    }
    if (nextWeek === -1) {
        acc.innerHTML = '<p class="text-gray-400 text-center py-4">Oynanmayan maç kalmadı</p>';
        return;
    }
    const weekMatches = fixtures[nextWeek];
    acc.innerHTML = '';
    weekMatches.forEach((match, idx) => {
        const item = document.createElement('div');
        item.className = 'bg-fifa-dark rounded-lg overflow-hidden border border-fifa-blue/20';
        const id = `bet-${nextWeek}-${idx}`;
        const odds = calculateMatchOdds(match);
        item.innerHTML = `
                    <button onclick="toggleBetAcc('${id}')" class="w-full p-4 flex items-center justify-between hover:bg-fifa-dark/70 transition-colors">
                        <div class="flex items-center gap-3 flex-1">
                            <img src="${match.home.logo}" class="w-8 h-8 object-contain">
                            <span class="text-white font-semibold">${match.home.name}</span>
                        </div>
                        <div class="text-fifa-orange font-bold">VS</div>
                        <div class="flex items-center gap-3 flex-1 justify-end">
                            <span class="text-white font-semibold">${match.away.name}</span>
                            <img src="${match.away.logo}" class="w-8 h-8 object-contain">
                        </div>
                        <i id="${id}-icon" class="fas fa-chevron-down text-gray-400 ml-3 transition-transform"></i>
                    </button>
                    <div id="${id}-content" class="hidden p-4 pt-0 space-y-3">
                        ${renderBetOptionsHTML(id, match, odds)}
                    </div>
                `;
        acc.appendChild(item);
    });
}

function toggleBetAcc(id) {
    const c = document.getElementById(`${id}-content`);
    const icon = document.getElementById(`${id}-icon`);
    document.querySelectorAll('#betAccordion [id$="-content"]').forEach(el => { if (el.id !== `${id}-content`) el.classList.add('hidden'); });
    document.querySelectorAll('#betAccordion [id$="-icon"]').forEach(el => { if (el.id !== `${id}-icon`) { el.classList.remove('fa-chevron-up'); el.classList.add('fa-chevron-down'); } });
    c.classList.toggle('hidden');
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
}

// Betting helpers
let currentOddsSeed = null;
function regenerateOddsSeed() { currentOddsSeed = Math.random().toString(36).slice(2); }
function formatOdd(v) { return Math.max(1.1, parseFloat(v)).toFixed(2); }
function getTeamRating(teamName) {
    const base = teamStrengths[teamName] || 1.0;
    const stats = getTeamStats(teamName);
    const form = stats.played > 0 ? ((stats.won * 3 + stats.draw) / (stats.played * 3)) : 0.5;
    return base + (form - 0.5) * 0.4;
}
function calculateMatchOdds(match) {
    const home = match.home.name, away = match.away.name;
    const hr = getTeamRating(home) + HOME_ADVANTAGE;
    const ar = getTeamRating(away);
    // seed ile hafif rasgelelik
    const noise = (str) => { let h = 0; const s = (currentOddsSeed || ''); for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return ((Math.sin(h + (str ? str.length : 0)) + 1) / 2 - 0.5) * 0.12; };
    const diff = hr - ar + noise(home + away);
    const sig = (x) => 1 / (1 + Math.exp(-x));
    let pH = sig(diff), pA = sig(-diff), pD = Math.max(0.15, Math.min(0.30, 0.25 + (0.1 - Math.abs(diff) * 0.05)));
    const s = pH + pA + pD; pH /= s; pA /= s; pD /= s; const m = 0.06; const am = (p) => p * (1 - m);
    const odds = { matchResult: { home: 1 / am(pH), draw: 1 / am(pD), away: 1 / am(pA) } };
    const leagueAvg = 2.6; const tsH = getTeamStats(home), tsA = getTeamStats(away);
    const avgG = (tsH.avgGoals + tsA.avgGoals) || leagueAvg;
    const expG = Math.max(1.4, Math.min(4.0, (leagueAvg * (hr + ar) / 2) * 0.9 + 0.1 * avgG));
    const over25 = sig((expG - 2.5) * 1.4); odds.overUnder = { over25: 1 / am(over25), under25: 1 / am(1 - over25) };
    const htD = Math.min(0.45, pD + 0.15); let htH = pH * 0.7, htA = pA * 0.7; const sh = htH + htA + htD; htH /= sh; htA /= sh;
    odds.htResult = { home: 1 / am(htH), draw: 1 / am(htD), away: 1 / am(htA) };
    const htG = expG * 0.45; const htOver15 = sig((htG - 1.5) * 1.5); odds.htOverUnder = { over15: 1 / am(htOver15), under15: 1 / am(1 - htOver15) };
    const btts = sig((expG - 2.2) * 1.1); odds.btts = { yes: 1 / am(btts), no: 1 / am(1 - btts) };
    const fav = diff >= 0 ? 'home' : 'away'; const hb = Math.min(0.75, Math.abs(diff));
    odds.handicap = { homeMinus1: 1 / am(fav === 'home' ? 0.38 + (0.4 - hb * 0.3) : 0.22), awayPlus1: 1 / am(fav === 'home' ? 0.62 - (0.3 - hb * 0.2) : 0.78), awayMinus1: 1 / am(fav === 'away' ? 0.38 + (0.4 - hb * 0.3) : 0.22), homePlus1: 1 / am(fav === 'away' ? 0.62 - (0.3 - hb * 0.2) : 0.78) };
    odds.score = { '1-0': 1 / am(0.10 + diff * 0.03), '0-1': 1 / am(0.10 - diff * 0.03), '1-1': 1 / am(0.14), '2-1': 1 / am(0.09 + diff * 0.02), '1-2': 1 / am(0.09 - diff * 0.02), '2-2': 1 / am(0.06), '3-1': 1 / am(0.05 + diff * 0.015), '1-3': 1 / am(0.05 - diff * 0.015) };
    const p01 = sig((1.1 - expG) * 1.4), p23 = sig(Math.abs(expG - 2.5) * -1.2 + 0.8), p45 = Math.max(0, 0.25 - Math.abs(expG - 4) * 0.2), p6 = Math.max(0, 0.12 - Math.abs(expG - 5.5) * 0.1); const sumR = p01 + p23 + p45 + p6 || 1;
    odds.goalRange = { r01: 1 / am(p01 / sumR), r23: 1 / am(p23 / sumR), r45: 1 / am(p45 / sumR), r6p: 1 / am(p6 / sumR) };
    Object.keys(odds).forEach(k => { Object.keys(odds[k]).forEach(o => odds[k][o] = parseFloat(formatOdd(odds[k][o]))) });
    return odds;
}
function renderBetOptionsHTML(id, match, odds) {
    const mr = odds.matchResult, ht = odds.htResult, ou = odds.overUnder, htou = odds.htOverUnder, btts = odds.btts, hcap = odds.handicap, score = odds.score, gr = odds.goalRange;
    const home = match.home.name, away = match.away.name, matchStr = `${home} vs ${away}`;
    const btn = (m, k, l, v) => `<button class="bet-btn bg-fifa-dark hover:bg-fifa-blue/20 border border-gray-600 rounded p-2 transition-all text-left" data-market="${m}" data-key="${k}" data-id="${id}" data-match="${matchStr}" data-home="${home}" data-away="${away}" onclick="onBetSelect(event)"><div class="flex items-center justify-between"><span class="text-white text-sm">${l}</span><span class="text-fifa-green text-sm font-bold" data-odd>${formatOdd(v)}</span></div></button>`;
    return `
            <div class="space-y-3">
                <div><div class="text-gray-400 text-sm mb-2">Maç Sonucu</div><div class="grid grid-cols-3 gap-2">${btn('mr', 'home', home, mr.home)}${btn('mr', 'draw', 'Beraberlik', mr.draw)}${btn('mr', 'away', away, mr.away)}</div></div>
                <div><div class="text-gray-400 text-sm mb-2">İlk Yarı Maç Sonucu</div><div class="grid grid-cols-3 gap-2">${btn('ht', 'home', `İY ${home}`, ht.home)}${btn('ht', 'draw', 'İY Beraberlik', ht.draw)}${btn('ht', 'away', `İY ${away}`, ht.away)}</div></div>
                <div><div class="text-gray-400 text-sm mb-2">Alt/Üst</div><div class="grid grid-cols-2 gap-2">${btn('ou', 'over25', 'Üst 2.5', ou.over25)}${btn('ou', 'under25', 'Alt 2.5', ou.under25)}</div></div>
                <div><div class="text-gray-400 text-sm mb-2">İlk Yarı Alt/Üst</div><div class="grid grid-cols-2 gap-2">${btn('htou', 'over15', 'İY Üst 1.5', htou.over15)}${btn('htou', 'under15', 'İY Alt 1.5', htou.under15)}</div></div>
                <div><div class="text-gray-400 text-sm mb-2">Karşılıklı Gol</div><div class="grid grid-cols-2 gap-2">${btn('btts', 'yes', 'Karşılıklı Gol Var', btts.yes)}${btn('btts', 'no', 'Karşılıklı Gol Yok', btts.no)}</div></div>
                <div><div class="text-gray-400 text-sm mb-2">Handikap</div><div class="grid grid-cols-2 gap-2">${btn('hcap', 'homeMinus1', `${home} (-1)`, hcap.homeMinus1)}${btn('hcap', 'awayPlus1', `${away} (+1)`, hcap.awayPlus1)}${btn('hcap', 'awayMinus1', `${away} (-1)`, hcap.awayMinus1)}${btn('hcap', 'homePlus1', `${home} (+1)`, hcap.homePlus1)}</div></div>
                <div><div class="text-gray-400 text-sm mb-2">Skor</div><div class="grid grid-cols-3 gap-2">${Object.keys(score).slice(0, 9).map(k => btn('score', k, `${home} ${k.split('-')[0]}-${k.split('-')[1]} ${away}`, score[k])).join('')}</div></div>
                <div><div class="text-gray-400 text-sm mb-2">Gol Aralığı</div><div class="grid grid-cols-4 gap-2">${btn('gr', 'r01', '0-1', gr.r01)}${btn('gr', 'r23', '2-3', gr.r23)}${btn('gr', 'r45', '4-5', gr.r45)}${btn('gr', 'r6p', '6+', gr.r6p)}</div></div>
            </div>`;
}
function onBetSelect(e) {
    // Oran değiştirme yok; sadece seçim vurgusu uygula
    const btn = e.currentTarget;
    const id = btn.getAttribute('data-id');
    document.querySelectorAll(`.bet-btn[data-id='${id}']`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}

// -------- Bet slip logic --------
let betSlip = [];
function resetBetSlip() { betSlip = []; renderBetSlip(); }
function addToBetSlip(matchId, market, key, label, odd, matchStr) {
    // aynı seçim toggle
    const dupIdx = betSlip.findIndex(s => s.matchId === matchId && s.market === market && s.key === key);
    if (dupIdx >= 0) { betSlip.splice(dupIdx, 1); renderBetSlip(); return; }
    // aynı maçtan farklı/çelişen tüm seçimleri çıkar
    betSlip = betSlip.filter(s => s.matchId !== matchId);
    // yeni seçimi ekle
    betSlip.push({ matchId, market, key, label, odd: parseFloat(odd), match: matchStr });
    renderBetSlip();
}
function renderBetSlip() {
    const list = document.getElementById('betSlipList');
    const typeEl = document.getElementById('betSlipType');
    const totalEl = document.getElementById('betSlipTotal');
    if (betSlip.length === 0) { list.innerHTML = '<p class="text-gray-400 text-sm">Seçim yapın</p>'; typeEl.textContent = 'Tekli'; totalEl.textContent = '1.00'; return; }
    const isSingle = betSlip.length === 1; typeEl.textContent = isSingle ? 'Tekli' : 'Kombine';
    list.innerHTML = betSlip.map((s, i) => {
        const odd = formatOdd(s.odd);
        const type = s.market === 'mr' ? (s.key === 'home' ? 'MS 1' : s.key === 'draw' ? 'MS X' : 'MS 2') :
            s.market === 'ht' ? (s.key === 'home' ? 'İY 1' : s.key === 'draw' ? 'İY X' : 'İY 2') :
                s.market === 'ou' ? (s.key === 'over25' ? 'Üst 2.5' : 'Alt 2.5') :
                    s.market === 'htou' ? (s.key === 'over15' ? 'İY Üst 1.5' : 'İY Alt 1.5') :
                        s.market === 'btts' ? (s.key === 'yes' ? 'KG Var' : 'KG Yok') :
                            s.market === 'hcap' ? (s.key === 'homeMinus1' ? 'Handikap Ev -1' : s.key === 'homePlus1' ? 'Handikap Ev +1' : s.key === 'awayMinus1' ? 'Handikap Dep -1' : 'Handikap Dep +1') :
                                s.market === 'score' ? `Skor ${s.key}` :
                                    s.market === 'gr' ? `Gol Aralığı ${s.key.replace('r01', '0-1').replace('r23', '2-3').replace('r45', '4-5').replace('r6p', '6+')}` : s.market;
        return `<div class="bg-fifa-darker rounded p-2 text-xs text-gray-300 border border-gray-700/40">
                    <div class="flex items-center justify-between"><span class="text-white font-semibold">${s.match}</span><span class="text-fifa-green font-bold">${odd}</span></div>
                    <div class="mt-1">Bahis Seçeneği: <span class="text-white font-semibold">${type}</span></div>
                </div>`;
    }).join('');
    const total = isSingle ? betSlip[0].odd : betSlip.reduce((a, b) => a * b.odd, 1);
    totalEl.textContent = formatOdd(total);
}

// capture bet selection clicks using event delegation
document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('.bet-btn');
    if (!btn || !document.getElementById('betModal') || document.getElementById('betModal').classList.contains('hidden')) return;
    const market = btn.getAttribute('data-market');
    const key = btn.getAttribute('data-key');
    const id = btn.getAttribute('data-id');
    const oddEl = btn.querySelector('[data-odd]');
    const label = btn.querySelector('span').textContent;
    const matchStr = btn.getAttribute('data-match') || '';
    addToBetSlip(id, market, key, label, oddEl.textContent, matchStr);
});

document.getElementById('confirmBetSlipBtn').addEventListener('click', function () {
    if (betSlip.length === 0) { showAlertModal('warning', 'Seçim Yok', 'Kupona en az bir seçim ekleyin.'); return; }
    const amount = parseFloat(document.getElementById('betSlipAmount').value) || 0;
    if (amount <= 0) { showAlertModal('error', 'Tutar Hatası', 'Geçerli bir tutar girin.'); return; }
    const player = players.find(p => p.id === currentPlayerId);
    if (!player) { showAlertModal('error', 'Oyuncu Bulunamadı', 'Lütfen tekrar deneyin.'); return; }
    if (player.balance < amount) { showAlertModal('error', 'Yetersiz Bakiye', 'Bakiyeniz yetersiz.'); return; }
    const isSingle = betSlip.length === 1;
    const total = isSingle ? betSlip[0].odd : betSlip.reduce((a, b) => a * b.odd, 1);
    const coupon = { id: Date.now(), playerId: player.id, selections: betSlip.slice(), amount, total, status: 'pending' };
    // store to active coupons
    const key = 'activeCoupons';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(coupon);
    localStorage.setItem(key, JSON.stringify(existing));
    renderBetCoupons();
    // deduct balance
    player.balance -= amount; savePlayers(); updateStats(); renderPlayers();
    showAlertModal('success', 'Kupon Onaylandı', `Toplam Oran: ${formatOdd(total)}\nTutar: ${amount.toFixed(2)}\nOlası Kazanç: ${(amount * total).toFixed(2)}`);
    // OK butonunu otomatik simulate edip kapat
    setTimeout(() => { hideAlertModal(false); hideBetModal(); }, 1200);
    // Kuponu ekranda göstermek için işlem geçmişine ve ayrı bir kupon loguna yazalım
    addTransactionLog('bet', player.fullName, amount, `Kupon Onaylandı (Oran: ${formatOdd(total)})`, '🎫');
    // Kuponları basit bir listede göstermek için matchHistory alanının altına bir panel eklenebilir; 
    // Şimdilik transactionLog üzerinden görünür.
});

function renderBetCoupons() {
    const wrap = document.getElementById('betCouponsList'); if (!wrap) return;
    const list = JSON.parse(localStorage.getItem('activeCoupons') || '[]').slice().reverse();
    if (list.length === 0) { wrap.innerHTML = '<p class="text-gray-400 text-sm">Henüz kupon yok</p>'; return; }
    wrap.innerHTML = list.map(c => {
        const type = c.selections.length === 1 ? 'Tekli' : 'Kombine';
        const statusIcon = c.status === 'won' ? '<span class="text-fifa-green">✔</span>' : c.status === 'lost' ? '<span class="text-fifa-red">✖</span>' : '<span class="text-gray-400">⏳</span>';
        const sel = c.selections.map(s => {
            const t = s.market === 'mr' ? (s.key === 'home' ? 'MS 1' : s.key === 'draw' ? 'MS X' : 'MS 2') :
                s.market === 'ht' ? (s.key === 'home' ? 'İY 1' : s.key === 'draw' ? 'İY X' : 'İY 2') :
                    s.market === 'ou' ? (s.key === 'over25' ? 'Üst 2.5' : 'Alt 2.5') :
                        s.market === 'htou' ? (s.key === 'over15' ? 'İY Üst 1.5' : 'İY Alt 1.5') :
                            s.market === 'btts' ? (s.key === 'yes' ? 'KG Var' : 'KG Yok') :
                                s.market === 'hcap' ? (s.key === 'homeMinus1' ? 'Handikap Ev -1' : s.key === 'homePlus1' ? 'Handikap Ev +1' : s.key === 'awayMinus1' ? 'Handikap Dep -1' : 'Handikap Dep +1') :
                                    s.market === 'score' ? `Skor ${s.key}` :
                                        s.market === 'gr' ? `Gol Aralığı ${s.key.replace('r01', '0-1').replace('r23', '2-3').replace('r45', '4-5').replace('r6p', '6+')}` : s.market;
            const w = findWeekForMatchStr(s.match || '');
            const weekTxt = (w >= 0) ? `${(w + 1)}. hafta` : '-';
            return `Maç Haftası: <span class="text-white font-semibold">${weekTxt}</span><br>${s.match || ''}<br>Bahis Seçeneği: <span class="text-white font-semibold">${t}</span> • Oran: <span class="text-fifa-green font-bold">${formatOdd(s.odd)}</span>`;
        }).join('<br>');
        return `<div class="bg-fifa-darker rounded p-2 text-xs text-gray-300 border border-gray-700/40">
                    <div class="flex items-center justify-between"><span class="text-white font-semibold">${type} Kupon ${statusIcon}</span><span class="text-fifa-green font-bold">Toplam Oran: ${formatOdd(c.total)}</span></div>
                    <div class="mt-1">${sel}</div>
                    <div class="mt-1 flex items-center justify-between"><span>Yatırılan: <span class="text-white font-bold">${c.amount.toFixed(2)}</span> • Olası: <span class="text-white font-bold">${(c.amount * c.total).toFixed(2)}</span></span>
                        <button class="btn-check-coupon bg-fifa-blue hover:bg-fifa-blue/80 text-white px-3 py-1 rounded" data-coupon-id="${c.id}">Kontrol Et</button>
                    </div>
                </div>`;
    }).join('');
}

function findWeekForMatchStr(matchStr) {
    if (!matchStr || !fixtures || !fixtures.length) return -1;
    const parts = matchStr.split(' vs '); if (parts.length !== 2) return -1;
    const home = parts[0].trim(), away = parts[1].trim();
    for (let w = 0; w < fixtures.length; w++) {
        const wm = fixtures[w];
        for (let i = 0; i < wm.length; i++) {
            if (wm[i].home.name === home && wm[i].away.name === away) return w;
        }
    }
    return -1;
}

// Kontrol Et butonu davranışı
document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('.btn-check-coupon');
    if (!btn) return;
    const id = parseInt(btn.getAttribute('data-coupon-id'));
    checkCouponNow(id);
});

function checkCouponNow(couponId) {
    const key = 'activeCoupons';
    const coupons = JSON.parse(localStorage.getItem(key) || '[]');
    const c = coupons.find(x => x.id === couponId);
    if (!c) { showAlertModal('error', 'Kupon Bulunamadı', 'Lütfen tekrar deneyin.'); return; }
    // değerlendirme
    let hasPending = false, hasLose = false;
    for (const s of c.selections) {
        const w = findWeekForMatchStr(s.match || '');
        if (w < 0) { hasPending = true; continue; }
        const parts = (s.match || '').split(' vs '); const home = parts[0]?.trim(), away = parts[1]?.trim();
        const idx = fixtures[w].findIndex(m => m.home.name === home && m.away.name === away);
        const res = matchResults[`${w}-${idx}`];
        if (!res) { hasPending = true; continue; }
        const win = isSelectionWinning(s, res.homeHT, res.awayHT, res.homeFT, res.awayFT);
        if (!win) { hasLose = true; break; }
    }
    if (hasLose) { c.status = 'lost'; localStorage.setItem(key, JSON.stringify(coupons)); renderBetCoupons(); showAlertModal('error', 'Kupon Kaybetti', 'Seçimlerinizden en az biri tutmadı.'); return; }
    if (hasPending) { showAlertModal('info', 'Henüz Oynanmadı', 'Seçimlerinizin tamamı sonuçlanmadı.'); return; }
    // hepsi kazanmış
    if (c.status !== 'won') {
        c.status = 'won';
        const player = players.find(p => p.id === c.playerId);
        if (player) { const gain = c.amount * c.total; player.balance += gain; savePlayers(); updateStats(); renderPlayers(); addTransactionLog('win', player.fullName, gain, 'Kupon Kazandı (Manuel Kontrol)', '🎉'); }
        localStorage.setItem(key, JSON.stringify(coupons));
    }
    renderBetCoupons();
    showAlertModal('money', 'Kupon Kazandı!', 'Tebrikler, kuponunuz kazandı.');
}

// Default players creation removed per requirements
function addDefaultPlayers() { /* no-op */ }

function setupEventListeners() {
    // Modal controls
    document.getElementById('addPlayerBtn').addEventListener('click', showModal);
    document.getElementById('addFirstPlayer').addEventListener('click', showModal);
    document.getElementById('closeModal').addEventListener('click', hideModal);
    document.getElementById('cancelBtn').addEventListener('click', hideModal);
    document.getElementById('closeBalanceModal').addEventListener('click', hideBalanceModal);
    document.getElementById('cancelBalanceBtn').addEventListener('click', hideBalanceModal);

    // Forms
    document.getElementById('playerForm').addEventListener('submit', addPlayer);
    document.getElementById('confirmBalanceBtn').addEventListener('click', processBalance);

    // Slot modal controls
    document.getElementById('closeSlotModal').addEventListener('click', hideSlotModal);
    document.getElementById('cancelSlotBtn').addEventListener('click', hideSlotModal);
    document.getElementById('spinSlotBtn').addEventListener('click', spinSlot);

    // Modals don't close on outside click

    // Bank controls
    document.getElementById('closeBankModal').addEventListener('click', hideBankModal);
    document.getElementById('cancelBankBtn').addEventListener('click', hideBankModal);

    // Kadro controls
    document.getElementById('closeKadroModal').addEventListener('click', hideKadroModal);
    document.getElementById('cancelKadroBtn').addEventListener('click', hideKadroModal);

    // Salary payment modal controls
    document.getElementById('salaryPaymentCreditBtn').addEventListener('click', handleSalaryPaymentCredit);
    document.getElementById('salaryPaymentSellBtn').addEventListener('click', handleSalaryPaymentSell);
    document.getElementById('salarySaleCloseBtn').addEventListener('click', hideSalaryPlayerSaleModal);
}

function showModal() {
    const modal = document.getElementById('playerModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Reset form
    document.getElementById('playerForm').reset();

    // Animation removed
}

function hideModal() {
    const modal = document.getElementById('playerModal');
    // Animation removed
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function showBalanceModal(playerId, operation) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    currentPlayerId = playerId;
    balanceOperation = operation;

    const modal = document.getElementById('balanceModal');
    const title = document.getElementById('balanceModalTitle');
    const playerImage = document.getElementById('balancePlayerImage');
    const playerName = document.getElementById('balancePlayerName');
    const playerTeam = document.getElementById('balancePlayerTeam');
    const currentBalance = document.getElementById('currentBalance');

    if (operation === 'add') {
        title.textContent = 'Bakiye Ekle';
    } else if (operation === 'subtract') {
        title.textContent = 'Bakiye Çıkar';
    }
    playerImage.src = player.profileImage || 'content/images/player-placeholder.svg';
    playerName.textContent = player.fullName;
    playerTeam.textContent = player.team;
    currentBalance.textContent = player.balance.toFixed(2);

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Show/hide amount input based on operation
    const amountInputDiv = document.getElementById('amountInputDiv');
    const amountLabel = amountInputDiv.querySelector('label');
    const amountInput = document.getElementById('balanceAmount');

    // Always show amount input for add/subtract operations
    amountInputDiv.style.display = 'block';
    amountLabel.textContent = 'Tutar';
    amountInput.value = '';
    amountInput.min = '0';
    amountInput.step = '0.01';

    // Animation removed
}

function hideBalanceModal() {
    const modal = document.getElementById('balanceModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function addPlayer(e) {
    e.preventDefault();

    const formData = {
        id: Date.now(),
        fullName: document.getElementById('fullName').value,
        nickname: document.getElementById('nickname').value,
        team: document.getElementById('team').value,
        profileImage: document.getElementById('profileImage').value,
        balance: parseFloat(document.getElementById('balance').value) || 0
    };

    players.push(formData);
    savePlayers();
    updateStats();
    renderPlayers();
    hideModal();

    // Animation removed
}

function processBalance() {
    const player = players.find(p => p.id === currentPlayerId);
    if (!player) return;

    if (balanceOperation === 'add' || balanceOperation === 'subtract') {
        const amount = parseFloat(document.getElementById('balanceAmount').value);
        if (!amount || amount <= 0) return;

        if (balanceOperation === 'add') {
            player.balance += amount;
            addTransactionLog('credit', player.fullName, amount, `Bakiye Eklendi`, '💰');
        } else if (balanceOperation === 'subtract') {
            if (player.balance >= amount) {
                player.balance -= amount;
                addTransactionLog('debit', player.fullName, amount, `Bakiye Çıkarıldı`, '💸');
            } else {
                showAlertModal('error', 'Yetersiz Bakiye', 'Yetersiz bakiye!');
                return;
            }
        }
    }

    savePlayers();
    updateStats();
    renderPlayers();
    hideBalanceModal();
    // If no players, guard and force add modal
    if (players.length === 0) {
        applyPlayersGuard();
        showModal();
        return;
    }

    // Animation removed
}

function renderPlayers() {
    const grid = document.getElementById('playersGrid');
    const emptyState = document.getElementById('emptyState');

    // Debug log
    console.log('Rendering players:', players.length);

    if (players.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    grid.innerHTML = players.map(player => `
                <div id="player-${player.id}" class="bg-fifa-dark/50 backdrop-blur-sm border border-fifa-blue/20 rounded-xl p-6 hover:border-fifa-blue/40 transition-all duration-300 hover:scale-105">
                    <div class="text-center mb-4">
                        <img src="${player.profileImage || 'content/images/player-placeholder.svg'}" alt="${player.fullName}" class="w-20 h-20 rounded-full mx-auto mb-3 object-cover border-2 border-fifa-blue/30">
                        <h3 class="text-xl font-bold text-white">${player.fullName}</h3>
                        <p class="text-fifa-blue font-medium">@${player.nickname}</p>
                        <p class="text-gray-400 text-sm">${player.team}</p>
                        <div class="mt-3">
                            <span class="bg-fifa-green/20 text-fifa-green px-3 py-1 rounded-full text-sm font-medium">
                                ₺${player.balance.toFixed(2)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <button onclick="showBalanceModal(${player.id}, 'add')" class="w-full bg-fifa-blue hover:bg-fifa-blue/80 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2">
                            <i class="fas fa-plus"></i>
                            <span>Bakiye Ekle</span>
                        </button>
                        
                        <button onclick="showBalanceModal(${player.id}, 'subtract')" class="w-full bg-fifa-red hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2">
                            <i class="fas fa-minus"></i>
                            <span>Bakiye Çıkar</span>
                        </button>
                        
                        <button onclick="showSlotModal(${player.id})" class="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2">
                            <i class="fas fa-dice"></i>
                            <span>Slot Oyna</span>
                        </button>
                        
                        <button onclick="showBetModal(${player.id})" class="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2">
                            <i class="fas fa-futbol"></i>
                            <span>Bahis Oyna</span>
                        </button>
                        
                        <button onclick="showBankModal(${player.id})" class="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2">
                            <i class="fas fa-university"></i>
                            <span>Banka</span>
                        </button>
                        
                        <button onclick="showKadroModal(${player.id})" class="w-full bg-fifa-green hover:bg-fifa-green/80 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2">
                            <i class="fas fa-users"></i>
                            <span>Kadro</span>
                        </button>
                        
                        <button onclick="resetPlayerBalance(${player.id})" class="w-full bg-fifa-red hover:bg-fifa-red/80 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2">
                            <i class="fas fa-undo"></i>
                            <span>Bakiye Sıfırla</span>
                        </button>
                        
                        <button onclick="deletePlayer(${player.id})" class="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2">
                            <i class="fas fa-trash"></i>
                            <span>Sil</span>
                        </button>
                    </div>
                </div>
            `).join('');

    // Animation removed
}

function deletePlayer(playerId) {
    if (confirm('Bu oyuncuyu silmek istediğinizden emin misiniz?')) {
        players = players.filter(p => p.id !== playerId);
        savePlayers();
        updateStats();
        renderPlayers();
        // If no players left, guard and prompt add
        if (players.length === 0) {
            applyPlayersGuard();
            showModal();
        }
    }
}

function updateStats() {
    const totalPlayers = players.length;
    const totalBalance = players.reduce((sum, player) => sum + player.balance, 0);
    const activeTeams = new Set(players.map(p => p.team)).size;

    document.getElementById('totalPlayers').textContent = totalPlayers;
    document.getElementById('totalBalance').textContent = `₺${totalBalance.toFixed(2)}`;
    document.getElementById('activeTeams').textContent = activeTeams;

    // Apply guard logic on every stats update
    applyPlayersGuard();
}

function savePlayers() {
    localStorage.setItem('fifaPlayers', JSON.stringify(players));
    console.log('Players saved to localStorage:', players);
}

// Slot functions moved to casino.js


function addToScore(scoreId, value) {
    const scoreInput = document.getElementById(scoreId);
    scoreInput.value = value;

    // Button click animation
    event.target.style.transform = 'scale(0.95)';
    setTimeout(() => {
        event.target.style.transform = 'scale(1)';
    }, 150);
}

// Alert Modal Functions
function showAlertModal(type, title, message, callback = null) {
    const modal = document.getElementById('alertModal');
    const icon = document.getElementById('alertIcon');
    const titleEl = document.getElementById('alertTitle');
    const messageEl = document.getElementById('alertMessage');
    const closeBtn = document.getElementById('alertCloseBtn');

    // Store callback for later use
    window.currentAlertCallback = callback;

    // Set content based on type
    switch (type) {
        case 'success':
            icon.textContent = '🎉';
            icon.className = 'text-6xl mb-4 text-fifa-green';
            titleEl.textContent = title;
            titleEl.className = 'text-2xl font-bold text-fifa-green mb-2';
            break;
        case 'error':
            icon.textContent = '❌';
            icon.className = 'text-6xl mb-4 text-fifa-red';
            titleEl.textContent = title;
            titleEl.className = 'text-2xl font-bold text-fifa-red mb-2';
            break;
        case 'warning':
            icon.textContent = '⚠️';
            icon.className = 'text-6xl mb-4 text-fifa-orange';
            titleEl.textContent = title;
            titleEl.className = 'text-2xl font-bold text-fifa-orange mb-2';
            break;
        case 'info':
            icon.textContent = 'ℹ️';
            icon.className = 'text-6xl mb-4 text-fifa-blue';
            titleEl.textContent = title;
            titleEl.className = 'text-2xl font-bold text-fifa-blue mb-2';
            break;
        case 'champion':
            icon.textContent = '🏆';
            icon.className = 'text-6xl mb-4 text-yellow-400';
            titleEl.textContent = title;
            titleEl.className = 'text-2xl font-bold text-yellow-400 mb-2';
            break;
        case 'money':
            icon.textContent = '💰';
            icon.className = 'text-6xl mb-4 text-fifa-green';
            titleEl.textContent = title;
            titleEl.className = 'text-2xl font-bold text-fifa-green mb-2';
            break;
    }

    messageEl.textContent = message;

    // Clear any existing cancel buttons first
    const existingCancelBtns = modal.querySelectorAll('.alert-cancel-btn');
    existingCancelBtns.forEach(btn => btn.remove());

    // Update buttons based on whether callback exists
    if (callback && typeof callback === 'function') {
        // Show confirmation buttons (Evet / İptal)
        closeBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Evet';
        closeBtn.className = 'bg-fifa-green hover:bg-fifa-green/80 text-white px-8 py-3 rounded-lg transition-colors mr-4';

        // Create new cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'alert-cancel-btn bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-lg transition-colors';
        cancelBtn.innerHTML = '<i class="fas fa-times mr-2"></i>İptal';
        cancelBtn.onclick = () => {
            hideAlertModal(false); // Don't execute callback
        };

        // Insert cancel button after close button
        closeBtn.parentNode.insertBefore(cancelBtn, closeBtn.nextSibling);
    } else {
        // Show single OK button
        closeBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Tamam';
        closeBtn.className = 'bg-fifa-blue hover:bg-fifa-blue/80 text-white px-8 py-3 rounded-lg transition-colors';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Animation removed
    // Wire close button to hide modal
    closeBtn.onclick = () => hideAlertModal(true);
}

function hideAlertModal(executeCallback = true) {
    const modal = document.getElementById('alertModal');
    const closeBtn = document.getElementById('alertCloseBtn');

    // Get callback before closing
    const callback = window.currentAlertCallback;

    // Clear callback immediately to prevent double execution
    window.currentAlertCallback = null;

    // Animation removed
    modal.classList.add('hidden');
    modal.classList.remove('flex');

    // Clear all cancel buttons
    const existingCancelBtns = modal.querySelectorAll('.alert-cancel-btn');
    existingCancelBtns.forEach(btn => btn.remove());

    // Reset button to default state BEFORE executing callback
    closeBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Tamam';
    closeBtn.className = 'bg-fifa-blue hover:bg-fifa-blue/80 text-white px-8 py-3 rounded-lg transition-colors';

    // Execute callback after modal is closed and reset
    if (executeCallback && callback && typeof callback === 'function') {
        setTimeout(() => { callback(); }, 50);
    }
}

// League functions moved to league.js








// League functions moved to league.js

// Bank functions
// Bank functions moved to bank.js

// Kadro Functions moved to kadro.js

// All kadro functions moved to kadro.js

// Transaction Log Functions
function addTransactionLog(type, playerName, amount, description, icon = '💰') {
    const logEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('tr-TR'),
        type: type, // 'credit', 'debit', 'bonus', 'loan', 'payment', 'transfer', 'kadro'
        playerName: playerName,
        amount: amount,
        description: description,
        icon: icon
    };

    transactionLog.unshift(logEntry); // Add to beginning

    // Keep only last 50 entries
    if (transactionLog.length > 50) {
        transactionLog = transactionLog.slice(0, 50);
    }

    saveTransactionLog();
    updateTransactionLogDisplay();
}

function saveTransactionLog() {
    localStorage.setItem('fifaTransactionLog', JSON.stringify(transactionLog));
}

function updateTransactionLogDisplay() {
    const logContainer = document.getElementById('transactionLog');

    if (transactionLog.length === 0) {
        logContainer.innerHTML = '<p class="text-gray-400 text-center">Henüz işlem yapılmamış</p>';
        return;
    }

    logContainer.innerHTML = transactionLog.map(entry => {
        const isPositive = ['credit', 'bonus', 'loan', 'win'].includes(entry.type);
        const amountClass = isPositive ? 'text-fifa-green' : 'text-fifa-red';
        const amountPrefix = isPositive ? '+' : '-';
        const amount = parseFloat(entry.amount) || 0;

        return `
                    <div class="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0">
                        <div class="flex items-center space-x-3">
                            <span class="text-xl">${entry.icon}</span>
                            <div>
                                <p class="text-white text-sm font-medium">${entry.description}</p>
                                <p class="text-gray-400 text-xs">${entry.playerName} - ${entry.timestamp}</p>
                            </div>
                        </div>
                        <span class="${amountClass} font-bold">${amountPrefix}₺${amount.toFixed(2)}</span>
                    </div>
                `;
    }).join('');
}

function clearTransactionLog() {
    showAlertModal('warning', 'Log Temizle', 'Tüm işlem geçmişini silmek istediğinizden emin misiniz?');

    setTimeout(() => {
        const modal = document.getElementById('alertModal');
        const closeBtn = document.getElementById('alertCloseBtn');

        closeBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Evet, Sil';
        closeBtn.className = 'bg-fifa-red hover:bg-fifa-red/80 text-white px-8 py-3 rounded-lg transition-colors mr-4';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-lg transition-colors';
        cancelBtn.innerHTML = '<i class="fas fa-times mr-2"></i>İptal';
        cancelBtn.onclick = () => {
            hideAlertModal();
            closeBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Tamam';
            closeBtn.className = 'bg-fifa-blue hover:bg-fifa-blue/80 text-white px-8 py-3 rounded-lg transition-colors';
        };

        closeBtn.onclick = () => {
            hideAlertModal();
            transactionLog = [];
            saveTransactionLog();
            updateTransactionLogDisplay();
            closeBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Tamam';
            closeBtn.className = 'bg-fifa-blue hover:bg-fifa-blue/80 text-white px-8 py-3 rounded-lg transition-colors';
        };

        closeBtn.parentNode.insertBefore(cancelBtn, closeBtn);
    }, 100);
}

// processSeasonEndPayments and processKadroSalaryPayment moved to bank.js

// processKadroCostPayment moved to kadro.js

// processMatchDebtIncrease moved to bank.js

function resetPlayerBalance(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const oldBalance = player.balance;

    // Show confirmation modal
    showAlertModal('warning', 'Bakiye Sıfırla',
        `${player.fullName} oyuncusunun bakiyesini sıfırlamak istediğinizden emin misiniz?\n\nMevcut bakiye: ₺${oldBalance.toFixed(2)}`,
        () => {
            // Reset balance to 0
            player.balance = 0;

            // Save data
            savePlayers();
            updateStats();
            renderPlayers();

            // Log the transaction
            addTransactionLog('debit', player.fullName, oldBalance, 'Bakiye Sıfırlandı', '🔄');

            // Show success message after a short delay
            setTimeout(() => {
                showAlertModal('success', 'Bakiye Sıfırlandı!',
                    `${player.fullName} oyuncusunun bakiyesi ₺${oldBalance.toFixed(2)} → ₺0.00 olarak sıfırlandı!`);
            }, 200);
        }
    );
}

// Make functions globally available
window.showBalanceModal = showBalanceModal;
window.deletePlayer = deletePlayer;
// window.showSlotModal moved to casino.js
window.resetPlayerBalance = resetPlayerBalance;
// window.changeSlotBetAmount moved to casino.js
// window.setMatchResult removed - function not defined
// window.showBankModal moved to bank.js
// window.calculateCredit moved to bank.js
// window.takeCredit moved to bank.js
// window.payCredit moved to bank.js

// ============================================
// FIXTURE SYSTEM - Lig ve Fikstür Yönetimi
// ============================================

// Takım logoları
const FALLBACK_PLAYER_IMAGE = 'content/images/player-placeholder.svg';
const FALLBACK_TEAM_LOGO = 'content/images/Galatasaray_SK_football_logo.png';
const teamLogos = {
    'Galatasaray': 'content/images/Galatasaray_SK_football_logo.png',
    'Beşiktaş': 'content/images/BesiktasJK-Logo.svg.png',
    'Başakşehir': 'content/images/İstanbul_Başakşehir_FK.png',
    'Trabzonspor': 'content/images/TrabzonsporAmblemi.png',
    'Fenerbahçe': 'content/images/Fenerbahçe_SK.png',
    'Konyaspor': 'content/images/Konyaspor_1922.png',
};

// Takım güç değerleri
const teamStrengths = {
    'Galatasaray': 0.38,
    'Beşiktaş': 0.30,
    'Başakşehir': 0.20,
    'Trabzonspor': 0.25,
    'Fenerbahçe': 0.33,
    'Konyaspor': 0.23,
};

let teams = [];
let fixtures = [];
let matchResults = {};
let playedWeeks = new Set();
let currentModalMatch = null;
let seasonStarted = false;
let currentWeek = 0;

const HOME_ADVANTAGE = CONFIG.FIXTURES.HOME_ADVANTAGE;
const TOTAL_WEEKS = CONFIG.FIXTURES.TOTAL_WEEKS;

// Persist/restore league state
function saveLeagueState() {
    try {
        localStorage.setItem('fifaMatchResults', JSON.stringify(matchResults));
        localStorage.setItem('fifaPlayedWeeks', JSON.stringify([...playedWeeks]));
        localStorage.setItem('fifaTeams', JSON.stringify(teams));
    } catch { }
}

function loadLeagueState() {
    try {
        const mr = JSON.parse(localStorage.getItem('fifaMatchResults') || 'null');
        if (mr && typeof mr === 'object') matchResults = mr;
        const pw = JSON.parse(localStorage.getItem('fifaPlayedWeeks') || 'null');
        if (Array.isArray(pw)) playedWeeks = new Set(pw);
        const t = JSON.parse(localStorage.getItem('fifaTeams') || 'null');
        if (Array.isArray(t) && t.length) teams = t;
    } catch { }
}

// Apply result to global teams table (standings)
function applyResultToTeams(homeName, awayName, homeFT, awayFT) {
    const th = teams.find(t => t.name === homeName);
    const ta = teams.find(t => t.name === awayName);
    if (!th || !ta) return;
    th.played = (th.played || 0) + 1; ta.played = (ta.played || 0) + 1;
    th.goalsFor = (th.goalsFor || 0) + homeFT; th.goalsAgainst = (th.goalsAgainst || 0) + awayFT;
    ta.goalsFor = (ta.goalsFor || 0) + awayFT; ta.goalsAgainst = (ta.goalsAgainst || 0) + homeFT;
    if (homeFT > awayFT) { th.won = (th.won || 0) + 1; th.points = (th.points || 0) + 3; ta.lost = (ta.lost || 0) + 1; }
    else if (awayFT > homeFT) { ta.won = (ta.won || 0) + 1; ta.points = (ta.points || 0) + 3; th.lost = (th.lost || 0) + 1; }
    else { th.draw = (th.draw || 0) + 1; ta.draw = (ta.draw || 0) + 1; th.points = (th.points || 0) + 1; ta.points = (ta.points || 0) + 1; }
}

// matchHistory zaten betting.js'de tanımlı - oradan kullanacağız

// Geçmiş maç fonksiyonları (betting.js'deki fonksiyonları kullan)
function getHeadToHead(team1, team2) {
    if (typeof window.matchHistory === 'undefined') return [];
    return window.matchHistory.filter(match =>
        (match.homeTeam === team1 && match.awayTeam === team2) ||
        (match.homeTeam === team2 && match.awayTeam === team1)
    );
}

function getTeamStats(teamName) {
    if (typeof window.matchHistory === 'undefined') return { played: 0 };

    const teamMatches = window.matchHistory.filter(match =>
        match.homeTeam === teamName || match.awayTeam === teamName
    );

    let stats = {
        played: teamMatches.length,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0
    };

    teamMatches.forEach(match => {
        const isHome = match.homeTeam === teamName;
        const scored = isHome ? match.homeScore : match.awayScore;
        const conceded = isHome ? match.awayScore : match.homeScore;

        stats.goalsFor += scored;
        stats.goalsAgainst += conceded;

        if (match.result === 'draw') {
            stats.drawn++;
        } else if ((match.result === 'home' && isHome) || (match.result === 'away' && !isHome)) {
            stats.won++;
        } else {
            stats.lost++;
        }
    });

    return stats;
}

// Takımları dinamik oluştur
function initializeTeams() {
    teams = [];
    const playerTeamNames = [...new Set(players.map(p => p.team).filter(t => t))];

    // Tüm mevcut takımları oluştur
    const allTeamNames = ['Galatasaray', 'Beşiktaş', 'Başakşehir', 'Trabzonspor', 'Fenerbahçe', 'Konyaspor'];

    allTeamNames.forEach((teamName, index) => {
        const isPlayerTeam = playerTeamNames.includes(teamName);
        teams.push({
            id: index + 1,
            name: teamName,
            logo: teamLogos[teamName] || FALLBACK_TEAM_LOGO,
            played: 0,
            won: 0,
            draw: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0,
            strength: teamStrengths[teamName] || 1.0,
            owner: isPlayerTeam ? (players.find(p => p.team === teamName)?.fullName || '') : '' // Sadece oyuncu takımlarında owner göster
        });
    });
}

// Oyuncu takımı mı kontrol et
function isPlayerTeam(teamName) {
    return players.some(p => p.team === teamName);
}

// Manuel takım kontrolü - Oyuncu takımları manuel
function isManualTeamMatch(homeTeam, awayTeam) {
    return isPlayerTeam(homeTeam.name) || isPlayerTeam(awayTeam.name);
}

// Sezon kontrolü
function checkSeasonEnd() {
    if (playedWeeks.size >= fixtures.length) {
        showChampion();
        return true;
    }
    return false;
}

// Şampiyonu göster
function showChampion() {
    const champion = teams.reduce((prev, current) => {
        if (current.points > prev.points) return current;
        if (current.points === prev.points) {
            const currentGoalDiff = current.goalsFor - current.goalsAgainst;
            const prevGoalDiff = prev.goalsFor - prev.goalsAgainst;
            return currentGoalDiff > prevGoalDiff ? current : prev;
        }
        return prev;
    });

    // Şampiyonluk primi dağıt (sadece oyuncu takımıysa)
    const championPlayers = players.filter(p => p.team === champion.name);
    if (championPlayers.length > 0) {
        const champBonus = CONFIG.FIXTURES.CHAMPIONSHIP_BONUS;
        championPlayers.forEach(player => {
            player.balance += champBonus;
            addTransactionLog('bonus', player.fullName, champBonus, 'Şampiyonluk Primi', '🏆');
        });
        savePlayers();
        updateStats();
        renderPlayers();
    }

    document.getElementById('championLogo').src = champion.logo;
    document.getElementById('championName').textContent = champion.name;
    document.getElementById('championStats').textContent =
        `${champion.points} Puan • ${champion.won} Galibiyet • ${champion.goalsFor - champion.goalsAgainst} Averaj`;

    const championSection = document.getElementById('championSection');
    championSection.style.display = 'block';

    // Animation removed

    setTimeout(() => {
        championSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
}

// Sezonu sıfırla (Maç geçmişini KORUYARAK)
function resetSeason() {
    initializeTeams(); // Takımları yeniden oluştur

    teams.forEach(team => {
        team.played = 0;
        team.won = 0;
        team.draw = 0;
        team.lost = 0;
        team.goalsFor = 0;
        team.goalsAgainst = 0;
        team.points = 0;
    });

    fixtures = [];
    matchResults = {};
    playedWeeks = new Set();
    currentModalMatch = null;
    seasonStarted = false;
    currentWeek = 0;

    // Sezon numarasını artır
    currentSeason++;
    localStorage.setItem('fifaCurrentSeason', JSON.stringify(currentSeason));

    // NOT: matchHistory KORUNUYOR - Sıfırlanmıyor!

    document.getElementById('championSection').style.display = 'none';
    document.getElementById('weekSelector').style.display = 'none';
    document.getElementById('startSeasonBtn').disabled = false;
    document.getElementById('startSeasonBtn').innerHTML = '<i class="fas fa-play mr-2"></i>Sezonu Başlat';
    document.getElementById('startSeasonBtn').classList.remove('opacity-75', 'cursor-not-allowed');
    document.getElementById('startSeasonBtn').classList.add('hover:from-purple-700', 'hover:to-blue-700', 'hover:scale-105');

    document.getElementById('matchesContainer').innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-info-circle text-4xl mb-3"></i>
                    <p class="text-lg">Sezonu başlatmak için yukarıdaki butona tıklayın</p>
                </div>
            `;

    updateStandings();

    // Animation removed
}

// Fikstür oluşturma - 6 hafta (2 takım arasında toplam 6 maç)
function generateFixtures() {
    initializeTeams(); // Takımları yeniden oluştur
    fixtures = [];
    const numTeams = teams.length;

    if (numTeams < 2) {
        alert('En az 2 takım gerekli!');
        return;
    }

    // Takım isimlerini al
    const teamNames = teams.map(t => t.name);
    const n = teamNames.length;

    // Round‑Robin tek devre oluştur
    const rounds = [];
    const half = n / 2;
    const fixed = teamNames[0];
    const rest = teamNames.slice(1);

    for (let i = 0; i < n - 1; i++) {
        const round = [];
        // fixed takım ile rest[0] eşleşir
        round.push({ home: fixed, away: rest[0] });
        for (let j = 1; j < half; j++) {
            round.push({ home: rest[j], away: rest[n - 1 - j] });
        }
        rounds.push(round);
        // rest dizisini döndür (son elemanı başa al)
        const last = rest.pop();
        rest.unshift(last);
    }

    // Çift devre oluştur: ilk yarı (rounds) ev sahibi, ikinci yarı deplasman
    const allRounds = [];

    // İlk yarı – ev sahibi olanlar
    for (const round of rounds) {
        const homeAwayRound = round.map(match => ({
            home: teams.find(t => t.name === match.home),
            away: teams.find(t => t.name === match.away)
        }));
        allRounds.push(homeAwayRound);
    }

    // İkinci yarı – ev sahibi deplasman ile yer değiştirir
    for (const round of rounds) {
        const awayHomeRound = round.map(match => ({
            home: teams.find(t => t.name === match.away),
            away: teams.find(t => t.name === match.home)
        }));
        allRounds.push(awayHomeRound);
    }

    fixtures = allRounds;

    // Kaydet
    localStorage.setItem('fifaFixtures', JSON.stringify(fixtures));
    localStorage.setItem('fifaPlayedWeeks', JSON.stringify([...playedWeeks]));
}

// Hafta seçenekleri - 10 hafta
function populateWeekSelector() {
    const weekSelect = document.getElementById('weekSelect');
    const prev = weekSelect.value;
    weekSelect.innerHTML = '<option value="">Hafta seçiniz...</option>';

    for (let i = 0; i < fixtures.length; i++) {
        const option = document.createElement('option');
        option.value = i;
        const playedMark = playedWeeks.has(i) ? ' ✅ (Oynandı)' : '';
        option.textContent = `${i + 1}. Hafta${playedMark}`;
        weekSelect.appendChild(option);
    }
    // Kullanıcının mevcut seçimini koru; otomatik ileri alma yok
    if (prev !== '' && weekSelect.querySelector(`option[value="${prev}"]`)) {
        weekSelect.value = prev;
    }
}

// Normal dağılım
function boxMullerRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateNormalDistributedGoals(mean, stdDev) {
    const randomValue = boxMullerRandom();
    const goals = mean + (stdDev * randomValue);
    return Math.max(0, Math.min(9, Math.round(goals)));
}

// Gerçekçi skor oluşturma
function generateRealisticScore(homeTeam, awayTeam) {
    const BASE_MEAN = 1.2;
    const STD_DEV = 1.0;

    let homeMean = BASE_MEAN;
    homeMean *= homeTeam.strength;
    homeMean += HOME_ADVANTAGE;

    let awayMean = BASE_MEAN;
    awayMean *= awayTeam.strength;
    awayMean -= 0.15;

    const strengthDiff = homeTeam.strength - awayTeam.strength;
    homeMean += strengthDiff * 0.2;
    awayMean -= strengthDiff * 0.15;

    homeMean = Math.max(0.3, homeMean);
    awayMean = Math.max(0.3, awayMean);

    let homeGoals = generateNormalDistributedGoals(homeMean, STD_DEV);
    let awayGoals = generateNormalDistributedGoals(awayMean, STD_DEV);

    if (Math.random() < 0.08 && homeGoals <= 1 && awayGoals <= 1) {
        homeGoals = 0;
        awayGoals = 0;
    }

    if (Math.random() < 0.12 && homeGoals <= 2 && awayGoals <= 2 && homeGoals !== awayGoals) {
        homeGoals = 1;
        awayGoals = 1;
    }

    let homeHT = 0;
    let awayHT = 0;

    if (homeGoals > 0) {
        const htRatio = 0.35 + Math.random() * 0.2;
        homeHT = Math.floor(homeGoals * htRatio);
        homeHT = Math.max(0, Math.min(homeGoals, homeHT));
    }

    if (awayGoals > 0) {
        const htRatio = 0.35 + Math.random() * 0.2;
        awayHT = Math.floor(awayGoals * htRatio);
        awayHT = Math.max(0, Math.min(awayGoals, awayHT));
    }

    if (Math.random() < 0.2 && homeGoals > 0) {
        homeHT = Math.min(homeGoals, homeHT + 1);
    }
    if (Math.random() < 0.2 && awayGoals > 0) {
        awayHT = Math.min(awayGoals, awayHT + 1);
    }

    if (homeHT === 0 && homeGoals > 0 && Math.random() < 0.3) {
        homeHT = 1;
    }
    if (awayHT === 0 && awayGoals > 0 && Math.random() < 0.3) {
        awayHT = 1;
    }

    return {
        homeFT: homeGoals,
        awayFT: awayGoals,
        homeHT: homeHT,
        awayHT: awayHT
    };
}

function getTeamForm(teamName, matchCount = 5) {
    const recentMatches = [];
    const history = Array.isArray(window.matchHistory) ? window.matchHistory : [];

    if (history.length) {
        recentMatches.push(...history
            .filter(match => match.homeTeam === teamName || match.awayTeam === teamName)
            .sort((a, b) => (b.id || 0) - (a.id || 0))
            .slice(0, matchCount));
    }

    if (recentMatches.length === 0) {
        return Array.from({ length: matchCount }, () => '<span class="inline-flex h-3 w-3 rounded-full bg-gray-600"></span>').join('');
    }

    const formResults = recentMatches.slice(0, matchCount).map(match => {
        const isHome = match.homeTeam === teamName;
        if (match.result === 'draw') return 'D';
        if ((match.result === 'home' && isHome) || (match.result === 'away' && !isHome)) return 'W';
        return 'L';
    });

    return formResults.map(result => {
        switch (result) {
            case 'W':
                return '<span class="inline-flex h-3 w-3 rounded-full bg-fifa-green" title="Galibiyet"></span>';
            case 'D':
                return '<span class="inline-flex h-3 w-3 rounded-full bg-fifa-orange" title="Beraberlik"></span>';
            case 'L':
                return '<span class="inline-flex h-3 w-3 rounded-full bg-fifa-red" title="Mağlubiyet"></span>';
            default:
                return '<span class="inline-flex h-3 w-3 rounded-full bg-gray-600" title="Henüz maç yok"></span>';
        }
    }).join('');
}

window.getTeamForm = getTeamForm;

// Puan tablosunu güncelle
function updateStandings() {
    // Sezon başlamadan önce alfabetik sırala, başladıysa puan/a.
    const seasonNotStarted = !seasonStarted || playedWeeks.size === 0;
    if (seasonNotStarted) {
        teams.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    } else {
        teams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
        });
    }

    const tableBody = document.getElementById('leagueStandingsTable');
    tableBody.innerHTML = '';

    teams.forEach((team, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-800 transition-colors';

        const rankClass = index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-400' : 'text-gray-400';
        const pointsClass = index === 0 ? 'text-yellow-400' : 'text-white';

        const ownerInfo = team.owner ? `<div class=\"text-xs text-gray-400 mt-1\">T.Direktör: ${team.owner}</div>` : '';

        const goalDiff = (team.goalsFor || 0) - (team.goalsAgainst || 0);
        const goalDiffTxt = goalDiff > 0 ? `+${goalDiff}` : `${goalDiff}`;

        tr.innerHTML = `
                    <td class="px-4 py-3 text-center font-bold ${rankClass}">${index + 1}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                            <img src="${team.logo}" alt="${team.name}" class="w-10 h-10 object-contain">
                            <div>
                                <div class="font-semibold text-white text-lg">${team.name}</div>
                                ${ownerInfo}
                                <div class="mt-1 flex items-center gap-1 text-xs">${getTeamForm(team.name, 5)}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-2 py-3 text-right">${team.played || 0}</td>
                    <td class="px-2 py-3 text-right text-green-400 font-bold">${team.won || 0}</td>
                    <td class="px-2 py-3 text-right text-yellow-400">${team.draw || 0}</td>
                    <td class="px-2 py-3 text-right text-red-400">${team.lost || 0}</td>
                    <td class="px-2 py-3 text-right">${goalDiffTxt}</td>
                    <td class="px-2 py-3 text-right">${team.goalsFor || 0}</td>
                    <td class="px-2 py-3 text-right">${team.goalsAgainst || 0}</td>
                    <td class="px-2 py-3 text-right font-bold text-xl ${pointsClass}">${team.points || 0}</td>
                `;

        tableBody.appendChild(tr);
    });
}

// Maçları göster
function displayMatches(weekIndex) {
    const matchesContainer = document.getElementById('matchesContainer');
    const playWeekBtn = document.getElementById('playWeekBtn');

    if (weekIndex === '') {
        matchesContainer.innerHTML = `
                    <div class="text-center text-gray-400 py-8">
                        <i class="fas fa-info-circle text-4xl mb-3"></i>
                        <p class="text-lg">Lütfen bir hafta seçin</p>
                    </div>
                `;
        playWeekBtn.style.display = 'none';
        return;
    }

    const weekMatches = fixtures[weekIndex];
    const isPlayed = playedWeeks.has(parseInt(weekIndex));
    matchesContainer.innerHTML = '';

    if (isPlayed) {
        playWeekBtn.style.display = 'none';
    } else {
        playWeekBtn.style.display = 'block';
    }

    weekMatches.forEach((match, index) => {
        const matchKey = `${weekIndex}-${index}`;
        const result = matchResults[matchKey];

        const matchCard = document.createElement('div');
        matchCard.className = 'match-card bg-fifa-darker rounded-xl p-6 shadow-lg';

        const isManualMatch = isManualTeamMatch(match.home, match.away);

        if (result) {
            const homeWin = result.homeFT > result.awayFT;
            const awayWin = result.awayFT > result.homeFT;
            const draw = result.homeFT === result.awayFT;

            matchCard.innerHTML = `
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4 flex-1">
                                <img src="${match.home.logo}" alt="${match.home.name}" class="w-12 h-12 object-contain">
                                <span class="text-white font-semibold text-lg ${homeWin ? 'text-green-400' : ''}">${match.home.name}</span>
                            </div>
                            
                            <div class="mx-6 text-center">
                                <div class="bg-gradient-to-r ${homeWin ? 'from-green-600 to-green-700' : awayWin ? 'from-red-600 to-red-700' : 'from-gray-600 to-gray-700'} px-8 py-4 rounded-lg">
                                    <span class="text-white font-bold text-3xl">${result.homeFT} - ${result.awayFT}</span>
                                    <div class="text-gray-300 text-sm mt-1">
                                        (İY: ${result.homeHT} - ${result.awayHT})
                                    </div>
                                </div>
                                ${draw ? '<div class="text-yellow-400 text-sm mt-2">Berabere</div>' : ''}
                            </div>
                            
                            <div class="flex items-center gap-4 flex-1 flex-row-reverse">
                                <img src="${match.away.logo}" alt="${match.away.name}" class="w-12 h-12 object-contain">
                                <span class="text-white font-semibold text-lg ${awayWin ? 'text-green-400' : ''}">${match.away.name}</span>
                            </div>
                        </div>
                    `;
        } else {
            const manualButton = isManualMatch ? `
                        <button class="manual-score-btn mt-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300" data-week="${weekIndex}" data-match="${index}">
                            <i class="fas fa-edit mr-2"></i>
                            Maçı Sonuçlandır
                        </button>
                    ` : '';

            matchCard.innerHTML = `
                        <div>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-4 flex-1">
                                    <img src="${match.home.logo}" alt="${match.home.name}" class="w-12 h-12 object-contain">
                                    <span class="text-white font-semibold text-lg">${match.home.name}</span>
                                </div>
                                
                                <div class="mx-6 text-center">
                                    <div class="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 rounded-lg">
                                        <span class="text-white font-bold text-xl">VS</span>
                                    </div>
                                </div>
                                
                                <div class="flex items-center gap-4 flex-1 flex-row-reverse">
                                    <img src="${match.away.logo}" alt="${match.away.name}" class="w-12 h-12 object-contain">
                                    <span class="text-white font-semibold text-lg">${match.away.name}</span>
                                </div>
                            </div>
                            <div class="text-center">
                                ${manualButton}
                            </div>
                        </div>
                    `;
        }

        matchesContainer.appendChild(matchCard);

        if (!result && isManualMatch) {
            const manualBtn = matchCard.querySelector('.manual-score-btn');
            if (manualBtn) {
                manualBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    openManualScoreModal(weekIndex, index, match);
                });
            }
        }

        // Animation removed
    });
}

// Manuel skor modal
function openManualScoreModal(weekIndex, matchIndex, match) {
    currentModalMatch = { weekIndex, matchIndex, match };

    document.getElementById('modalHomeTeamLogo').src = match.home.logo;
    document.getElementById('modalHomeTeamName').textContent = match.home.name;
    document.getElementById('modalAwayTeamLogo').src = match.away.logo;
    document.getElementById('modalAwayTeamName').textContent = match.away.name;

    document.getElementById('inputHomeHT').value = 0;
    document.getElementById('inputAwayHT').value = 0;
    document.getElementById('inputHomeFT').value = 0;
    document.getElementById('inputAwayFT').value = 0;

    const modal = document.getElementById('manualScoreModal');
    const modalContent = modal.querySelector('.bg-fifa-darker');

    modal.style.display = 'flex';
}

function closeManualScoreModal(callback) {
    const modal = document.getElementById('manualScoreModal');
    const modalContent = modal.querySelector('.bg-fifa-darker');

    modal.style.display = 'none';
    currentModalMatch = null;
    if (callback) callback();
}

// Maç kazançlarını dağıt (sadece oyuncu takımları için)
function distributeMatchBonuses(homeTeam, awayTeam, homeScore, awayScore, result) {
    const cfg = CONFIG.FIXTURES;
    const homeTeamPlayers = players.filter(p => p.team === homeTeam);
    const awayTeamPlayers = players.filter(p => p.team === awayTeam);

    // Eğer her iki takımda da oyuncu yoksa kazanç dağıtma
    if (homeTeamPlayers.length === 0 && awayTeamPlayers.length === 0) {
        return;
    }

    // Galibiyet primi
    if (result === 'home' && homeTeamPlayers.length > 0) {
        homeTeamPlayers.forEach(player => {
            player.balance += cfg.WIN_BONUS;
            addTransactionLog('bonus', player.fullName, cfg.WIN_BONUS, `Maç Galibiyet Primi`, '🏆');
        });
    } else if (result === 'away' && awayTeamPlayers.length > 0) {
        awayTeamPlayers.forEach(player => {
            player.balance += cfg.WIN_BONUS;
            addTransactionLog('bonus', player.fullName, cfg.WIN_BONUS, `Maç Galibiyet Primi`, '🏆');
        });
    } else if (result === 'draw') {
        // Beraberlik primi
        if (homeTeamPlayers.length > 0) {
            homeTeamPlayers.forEach(player => {
                player.balance += cfg.DRAW_BONUS;
                addTransactionLog('bonus', player.fullName, cfg.DRAW_BONUS, 'Maç Beraberlik Primi', '🤝');
            });
        }
        if (awayTeamPlayers.length > 0) {
            awayTeamPlayers.forEach(player => {
                player.balance += cfg.DRAW_BONUS;
                addTransactionLog('bonus', player.fullName, cfg.DRAW_BONUS, 'Maç Beraberlik Primi', '🤝');
            });
        }
    }

    // Gol primi
    if (homeScore > 0 && homeTeamPlayers.length > 0) {
        const goalBonus = homeScore * cfg.GOAL_BONUS_PER_GOAL;
        homeTeamPlayers.forEach(player => {
            player.balance += goalBonus;
            addTransactionLog('bonus', player.fullName, goalBonus, `Maç Gol Primi (${homeScore} gol x ${cfg.GOAL_BONUS_PER_GOAL}₺)`, '⚽');
        });
    }

    if (awayScore > 0 && awayTeamPlayers.length > 0) {
        const goalBonus = awayScore * cfg.GOAL_BONUS_PER_GOAL;
        awayTeamPlayers.forEach(player => {
            player.balance += goalBonus;
            addTransactionLog('bonus', player.fullName, goalBonus, `Maç Gol Primi (${awayScore} gol x ${cfg.GOAL_BONUS_PER_GOAL}₺)`, '⚽');
        });
    }

    savePlayers();
    updateStats();
    renderPlayers();
}

function saveManualScore() {
    if (!currentModalMatch) return;

    const homeHT = parseInt(document.getElementById('inputHomeHT').value) || 0;
    const awayHT = parseInt(document.getElementById('inputAwayHT').value) || 0;
    const homeFT = parseInt(document.getElementById('inputHomeFT').value) || 0;
    const awayFT = parseInt(document.getElementById('inputAwayFT').value) || 0;

    if (homeHT > homeFT || awayHT > awayFT) {
        alert('İlk yarı skoru maç sonundan fazla olamaz!');
        return;
    }

    const { weekIndex, matchIndex, match } = currentModalMatch;
    const matchKey = `${weekIndex}-${matchIndex}`;

    matchResults[matchKey] = {
        homeFT: homeFT,
        awayFT: awayFT,
        homeHT: homeHT,
        awayHT: awayHT
    };

    // Sadece fikstür kartındaki referanslara dokunma; global standings zaten applyResultToTeams ile güncellendi
    // Global standings update
    applyResultToTeams(match.home.name, match.away.name, homeFT, awayFT);

    let result;
    if (homeFT > awayFT) {
        result = 'home';
    } else if (awayFT > homeFT) {
        result = 'away';
    } else {
        result = 'draw';
    }

    // Kazançları dağıt
    distributeMatchBonuses(match.home.name, match.away.name, homeFT, awayFT, result);
    // Kuponları kontrol et
    evaluateCouponsForMatch(match.home.name, match.away.name, homeHT, awayHT, homeFT, awayFT);

    // Maç geçmişine ekle (betting.js fonksiyonu)
    if (typeof addMatchToHistory === 'function') {
        addMatchToHistory(match.home.name, match.away.name, homeFT, awayFT, homeHT, awayHT);
    }

    updateStandings(); saveLeagueState();

    const weekMatches = fixtures[weekIndex];
    const allMatchesPlayed = weekMatches.every((m, i) => {
        const key = `${weekIndex}-${i}`;
        return matchResults[key] !== undefined;
    });

    if (allMatchesPlayed && !playedWeeks.has(parseInt(weekIndex))) {
        playedWeeks.add(parseInt(weekIndex));

        // Hafta tamamlandı
    }
    // persist after each match entry
    saveLeagueState();

    closeManualScoreModal(() => {
        displayMatches(weekIndex);
        populateWeekSelector();
        document.getElementById('weekSelect').value = weekIndex;
        checkSeasonEnd();

        // Yeni hafta için güncellemeler tamam

        // Animation removed
    });
}

// ---- Coupon evaluation per match ----
function evaluateCouponsForMatch(home, away, homeHT, awayHT, homeFT, awayFT) {
    const key = 'activeCoupons';
    const coupons = JSON.parse(localStorage.getItem(key) || '[]');
    if (!coupons.length) return;
    const matchStr = `${home} vs ${away}`;
    let anyUpdated = false; let winMessages = [];
    coupons.forEach(c => {
        if (c.status !== 'pending') return;
        // Seçimleri bu maça ait olanlar var mı
        const relevant = c.selections.filter(s => (s.match || '').includes(home) && (s.match || '').includes(away));
        if (!relevant.length) return;
        // Hepsinin doğruluğunu kontrol et
        let allOk = true;
        relevant.forEach(s => { if (!isSelectionWinning(s, homeHT, awayHT, homeFT, awayFT)) allOk = false; });
        // Eğer bu maça dair seçimlerden biri bile kaybettiyse kupon kaybeder
        if (!allOk) { c.status = 'lost'; anyUpdated = true; return; }
        // Bu maça dair seçimler kazandı, diğer maçlar beklenebilir
        // Kuponun tüm seçimleri kazandı mı kontrolü (basitleştirilmiş): tüm seçimler değerlendirilebiliyorsa kazanır
        const otherPending = c.selections.some(s => {
            const hasThisMatch = (s.match || '').includes(home) && (s.match || '').includes(away);
            return !hasThisMatch; // diğer maçlar var, henüz bekleyen olabilir
        });
        if (!otherPending) {
            c.status = 'won'; anyUpdated = true;
            const player = players.find(p => p.id === c.playerId);
            if (player) {
                const gain = c.amount * c.total;
                player.balance += gain; savePlayers(); updateStats(); renderPlayers();
                addTransactionLog('win', player.fullName, gain, `Kupon Kazandı (${matchStr}) • Oran: ${formatOdd(c.total)}`, '🎉');
                winMessages.push(`${player.fullName}: ${formatOdd(c.total)} oran • Kazanç ${(gain).toFixed(2)}`);
            }
        }
    });
    if (anyUpdated) { localStorage.setItem(key, JSON.stringify(coupons)); renderBetCoupons(); }
    if (winMessages.length) { showAlertModal('money', 'Kazanan Kupon!', winMessages.join('\n')); }
}

function isSelectionWinning(sel, homeHT, awayHT, homeFT, awayFT) {
    switch (sel.market) {
        case 'mr':
            if (sel.key === 'home') return homeFT > awayFT;
            if (sel.key === 'draw') return homeFT === awayFT;
            if (sel.key === 'away') return awayFT > homeFT; break;
        case 'ht':
            if (sel.key === 'home') return homeHT > awayHT;
            if (sel.key === 'draw') return homeHT === awayHT;
            if (sel.key === 'away') return awayHT > homeHT; break;
        case 'ou':
            const tg = homeFT + awayFT; if (sel.key === 'over25') return tg > 2; if (sel.key === 'under25') return tg < 3; break;
        case 'htou':
            const htg = homeHT + awayHT; if (sel.key === 'over15') return htg > 1; if (sel.key === 'under15') return htg < 2; break;
        case 'btts':
            if (sel.key === 'yes') return homeFT > 0 && awayFT > 0; if (sel.key === 'no') return (homeFT === 0 || awayFT === 0); break;
        case 'hcap':
            if (sel.key === 'homeMinus1') return (homeFT - 1) > awayFT;
            if (sel.key === 'homePlus1') return (homeFT + 1) > awayFT || (homeFT + 1) === awayFT; // +1 handikap push->kazanç saymayıp basitçe >= yaptık
            if (sel.key === 'awayMinus1') return (awayFT - 1) > homeFT;
            if (sel.key === 'awayPlus1') return (awayFT + 1) > homeFT || (awayFT + 1) === homeFT; break;
        case 'score':
            const [h, a] = sel.key.split('-').map(n => parseInt(n)); return homeFT === h && awayFT === a;
        case 'gr':
            const g = homeFT + awayFT; if (sel.key === 'r01') return g <= 1; if (sel.key === 'r23') return g >= 2 && g <= 3; if (sel.key === 'r45') return g >= 4 && g <= 5; if (sel.key === 'r6p') return g >= 6; break;
    }
    return false;
}

// Haftayı oyna
function playWeek(weekIndex) {
    const weekMatches = fixtures[weekIndex];
    let hasManualMatches = false;

    weekMatches.forEach((match, index) => {
        const matchKey = `${weekIndex}-${index}`;

        if (matchResults[matchKey]) {
            return;
        }

        if (isManualTeamMatch(match.home, match.away)) {
            hasManualMatches = true;
            return;
        }

        const score = generateRealisticScore(match.home, match.away);

        matchResults[matchKey] = {
            homeFT: score.homeFT,
            awayFT: score.awayFT,
            homeHT: score.homeHT,
            awayHT: score.awayHT
        };

        // Global standings update for bot matches
        applyResultToTeams(match.home.name, match.away.name, score.homeFT, score.awayFT);

        let result;
        if (score.homeFT > score.awayFT) {
            result = 'home';
        } else if (score.awayFT > score.homeFT) {
            result = 'away';
        } else {
            result = 'draw';
        }

        // Otomatik maçlar için de kazançları dağıt (eğer oyuncu takımı varsa)
        distributeMatchBonuses(match.home.name, match.away.name, score.homeFT, score.awayFT, result);

        // Maç geçmişine ekle (betting.js fonksiyonu)
        if (typeof addMatchToHistory === 'function') {
            addMatchToHistory(match.home.name, match.away.name, score.homeFT, score.awayFT, score.homeHT, score.awayHT);
        }
    });

    const allMatchesPlayed = weekMatches.every((match, index) => {
        const matchKey = `${weekIndex}-${index}`;
        return matchResults[matchKey] !== undefined;
    });

    if (allMatchesPlayed) {
        playedWeeks.add(parseInt(weekIndex));
    }

    updateStandings(); saveLeagueState();
    displayMatches(weekIndex);
    populateWeekSelector();
    document.getElementById('weekSelect').value = weekIndex;

    if (allMatchesPlayed) {
        checkSeasonEnd();
    }

    // Highlight manual score buttons without animation
    saveLeagueState();
}

// Sezon başlatıldığında kadro maaşlarını kontrol et
function checkAndProcessKadroSalaries() {
    const playersWithKadro = players.filter(p => {
        return kadroData[p.fullName] && kadroData[p.fullName].length > 0;
    });

    if (playersWithKadro.length === 0) {
        return true; // Kadrosu olan oyuncu yok, devam et
    }

    // Her oyuncu için maaş kontrolü yap
    let allPaid = true;
    const pendingPayments = [];

    playersWithKadro.forEach(player => {
        const kadro = kadroData[player.fullName] || [];
        const totalSalary = kadro.reduce((sum, kadroPlayer) => sum + (kadroPlayer.salaryCost || 0), 0);

        if (totalSalary > 0) {
            if (player.balance >= totalSalary) {
                // Bakiye yeterli, ödemeyi yap
                player.balance -= totalSalary;
                addTransactionLog('debit', player.fullName, totalSalary, `Sezon Başlangıcı Maaş Ödemesi`, '💸');
                savePlayers();
                updateStats();
                renderPlayers();
            } else {
                // Bakiye yetersiz, modal göster
                allPaid = false;
                pendingPayments.push({
                    player: player,
                    totalSalary: totalSalary,
                    deficit: totalSalary - player.balance
                });
            }
        }
    });

    if (!allPaid && pendingPayments.length > 0) {
        // İlk bekleyen ödemeyi göster
        showSalaryPaymentModal(pendingPayments[0]);
        return false; // Sezon başlatma işlemini durdur
    }

    return true; // Tüm ödemeler tamamlandı
}

// Maaş ödeme modalını göster
let currentSalaryPayment = null;
function showSalaryPaymentModal(paymentInfo) {
    currentSalaryPayment = paymentInfo;
    const { player, totalSalary, deficit } = paymentInfo;

    document.getElementById('salaryPaymentPlayerName').textContent = player.fullName;
    document.getElementById('salaryPaymentTotal').textContent = `₺${totalSalary.toFixed(2)}`;
    document.getElementById('salaryPaymentBalance').textContent = `₺${player.balance.toFixed(2)}`;
    document.getElementById('salaryPaymentDeficit').textContent = `₺${deficit.toFixed(2)}`;
    document.getElementById('salaryPaymentMessage').textContent =
        `Kadronuzdaki oyuncuların maaşlarını ödemek için yeterli bakiyeniz bulunmuyor.`;

    const modal = document.getElementById('salaryPaymentModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Maaş ödeme modalını gizle
function hideSalaryPaymentModal() {
    const modal = document.getElementById('salaryPaymentModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentSalaryPayment = null;
}

// Kredi çekme seçeneği
function handleSalaryPaymentCredit() {
    if (!currentSalaryPayment) return;

    const { player, deficit } = currentSalaryPayment;
    const requiredCredit = Math.ceil(deficit); // Eksik tutarı yukarı yuvarla

    // Banka modalını aç ve gerekli miktarı öner
    hideSalaryPaymentModal();
    showBankModalForSalaryPayment(player.id, requiredCredit);
}

// Oyuncu satma seçeneği
function handleSalaryPaymentSell() {
    if (!currentSalaryPayment) return;

    const { player, totalSalary } = currentSalaryPayment;
    hideSalaryPaymentModal();
    showSalaryPlayerSaleModal(player, totalSalary);
}

// Maaş ödemesi için banka modalını aç
function showBankModalForSalaryPayment(playerId, requiredAmount) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Maaş ödemesi için kredi çekme flag'i
    window.isSalaryPaymentCredit = true;
    window.processSalaryAfterCredit = function (p) {
        processSalaryPaymentAfterCredit(p);
    };

    // Banka modalını aç
    showBankModal(playerId);

    // Gerekli miktarı input'a yaz
    setTimeout(() => {
        const creditInput = document.getElementById('creditAmount');
        if (creditInput) {
            creditInput.value = Math.min(requiredAmount, CONFIG.BANK.CREDIT_LIMIT);
            calculateCredit();
        }
    }, 300);
}

// Kredi çekildikten sonra maaş ödemesini yap
function processSalaryPaymentAfterCredit(player) {
    const kadro = kadroData[player.fullName] || [];
    const totalSalary = kadro.reduce((sum, kadroPlayer) => sum + (kadroPlayer.salaryCost || 0), 0);

    if (totalSalary > 0 && player.balance >= totalSalary) {
        // Maaş ödemesini yap
        player.balance -= totalSalary;
        addTransactionLog('debit', player.fullName, totalSalary, `Sezon Başlangıcı Maaş Ödemesi (Kredi Sonrası)`, '💸');
        savePlayers();
        updateStats();
        renderPlayers();

        hideBankModal();
        showAlertModal('success', 'Maaş Ödendi!', `${player.fullName} için maaş ödemesi tamamlandı!\nKalan bakiye: ₺${player.balance.toFixed(2)}`);

        // Bir sonraki bekleyen ödemeyi kontrol et
        setTimeout(() => {
            checkNextPendingPayment();
        }, 1500);
    } else if (totalSalary > 0) {
        // Hala yeterli bakiye yok
        const deficit = totalSalary - player.balance;
        showAlertModal('warning', 'Yetersiz Bakiye', `Kredi çektiniz ancak hala ₺${deficit.toFixed(2)} eksik!\nLütfen daha fazla kredi çekin veya oyuncu satın.`);
    }
}

// Bir sonraki bekleyen ödemeyi kontrol et
function checkNextPendingPayment() {
    const playersWithKadro = players.filter(p => {
        return kadroData[p.fullName] && kadroData[p.fullName].length > 0;
    });

    const pendingPayments = [];
    playersWithKadro.forEach(player => {
        const kadro = kadroData[player.fullName] || [];
        const totalSalary = kadro.reduce((sum, kadroPlayer) => sum + (kadroPlayer.salaryCost || 0), 0);

        if (totalSalary > 0 && player.balance < totalSalary) {
            pendingPayments.push({
                player: player,
                totalSalary: totalSalary,
                deficit: totalSalary - player.balance
            });
        }
    });

    if (pendingPayments.length > 0) {
        showSalaryPaymentModal(pendingPayments[0]);
    } else {
        // Tüm ödemeler tamamlandı, sezonu başlat
        completeSeasonStart();
    }
}

// Sezon başlatmayı tamamla
function completeSeasonStart() {
    seasonStarted = true;
    document.getElementById('weekSelector').style.display = 'block';
    const startBtn = document.getElementById('startSeasonBtn');
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Sezon Oluşturuldu';
    startBtn.classList.remove('hover:from-purple-700', 'hover:to-blue-700', 'hover:scale-105');
    startBtn.classList.add('opacity-75', 'cursor-not-allowed');
}

// Oyuncu satış modalını göster
let currentSalarySaleInfo = null;
function showSalaryPlayerSaleModal(player, totalSalary) {
    currentSalarySaleInfo = { player, totalSalary };
    document.getElementById('salarySalePlayerName').textContent = player.fullName;
    updateSalarySaleModal();

    const kadro = kadroData[player.fullName] || [];
    const kadroList = document.getElementById('salarySaleKadroList');

    if (kadro.length === 0) {
        kadroList.innerHTML = '<p class="text-gray-400 text-center">Kadronuzda oyuncu bulunmuyor!</p>';
        document.getElementById('salarySaleCloseBtn').style.display = 'block';
        return;
    }

    kadroList.innerHTML = kadro.map(kadroPlayer => {
        const salePrice = kadroPlayer.salePrice || Math.floor((kadroPlayer.overall + kadroPlayer.salaryCost) * 0.5);
        return `
                    <div class="flex items-center justify-between bg-fifa-darker rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center space-x-4">
                            <div class="w-12 h-12 bg-fifa-blue rounded-full flex items-center justify-center">
                                <span class="text-white font-bold">${kadroPlayer.overall}</span>
                            </div>
                            <div>
                                <h5 class="text-white font-bold">${kadroPlayer.name}</h5>
                                <p class="text-gray-400 text-sm">Overall: ${kadroPlayer.overall} | Maaş: ₺${kadroPlayer.salaryCost}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-fifa-green font-bold text-lg mb-2">₺${salePrice}</div>
                            <button onclick="sellPlayerForSalary('${player.fullName}', ${kadroPlayer.id}, ${salePrice})" 
                                    class="bg-fifa-orange hover:bg-fifa-orange/80 text-white px-4 py-2 rounded transition-colors">
                                <i class="fas fa-hand-holding-usd mr-2"></i>Sat
                            </button>
                        </div>
                    </div>
                `;
    }).join('');

    const modal = document.getElementById('salaryPlayerSaleModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('salarySaleCloseBtn').style.display = 'none';
}

// Oyuncu satış modalını güncelle
function updateSalarySaleModal() {
    if (!currentSalarySaleInfo) return;
    const { player, totalSalary } = currentSalarySaleInfo;
    const remainingDebt = Math.max(0, totalSalary - player.balance);
    document.getElementById('salarySaleRemainingDebt').textContent = `₺${remainingDebt.toFixed(2)}`;
    document.getElementById('salarySaleBalance').textContent = `₺${player.balance.toFixed(2)}`;

    if (remainingDebt <= 0.01) {
        document.getElementById('salarySaleCloseBtn').style.display = 'block';
    }
}

// Maaş ödemesi için oyuncu sat
function sellPlayerForSalary(managerName, playerId, salePrice) {
    if (!currentSalarySaleInfo) return;
    const { player, totalSalary } = currentSalarySaleInfo;
    const manager = players.find(p => p.fullName === managerName);
    if (!manager || manager.id !== player.id) return;

    // Oyuncuyu bul
    const kadroPlayer = kadroData[managerName].find(p => p.id === playerId);
    if (!kadroPlayer) return;

    // Oyuncuyu sat
    manager.balance += salePrice;
    addTransactionLog('credit', manager.fullName, salePrice, `Maaş Ödemesi İçin ${kadroPlayer.name} Satışı`, '👤');

    // Kadrodan çıkar
    kadroData[managerName] = kadroData[managerName].filter(p => p.id !== playerId);
    saveKadroData();
    savePlayers();
    updateStats();
    renderPlayers();

    // Maaş ödemesini kontrol et
    const remainingDebt = Math.max(0, totalSalary - manager.balance);

    if (remainingDebt <= 0.01) {
        // Borç kapatıldı, maaş ödemesini yap
        manager.balance -= totalSalary;
        addTransactionLog('debit', manager.fullName, totalSalary, `Sezon Başlangıcı Maaş Ödemesi`, '💸');
        savePlayers();
        updateStats();
        renderPlayers();

        // Modal'ı güncelle
        updateSalarySaleModal();

        showAlertModal('success', 'Maaş Ödendi!', `${manager.fullName} için maaş ödemesi tamamlandı!\nKalan bakiye: ₺${manager.balance.toFixed(2)}`);

        // Bir sonraki bekleyen ödemeyi kontrol et
        setTimeout(() => {
            hideSalaryPlayerSaleModal();
            checkNextPendingPayment();
        }, 2000);
    } else {
        // Hala borç var, modal'ı güncelle
        currentSalarySaleInfo.player = manager; // Güncel player bilgisini güncelle
        updateSalarySaleModal();

        // Kadro listesini yeniden göster
        const kadro = kadroData[managerName] || [];
        const kadroList = document.getElementById('salarySaleKadroList');

        if (kadro.length === 0) {
            kadroList.innerHTML = '<p class="text-gray-400 text-center">Kadronuzda oyuncu kalmadı!</p>';
            document.getElementById('salarySaleCloseBtn').style.display = 'block';
        } else {
            kadroList.innerHTML = kadro.map(kp => {
                const sp = kp.salePrice || Math.floor((kp.overall + kp.salaryCost) * 0.5);
                return `
                            <div class="flex items-center justify-between bg-fifa-darker rounded-lg p-4 border border-gray-700">
                                <div class="flex items-center space-x-4">
                                    <div class="w-12 h-12 bg-fifa-blue rounded-full flex items-center justify-center">
                                        <span class="text-white font-bold">${kp.overall}</span>
                                    </div>
                                    <div>
                                        <h5 class="text-white font-bold">${kp.name}</h5>
                                        <p class="text-gray-400 text-sm">Overall: ${kp.overall} | Maaş: ₺${kp.salaryCost}</p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-fifa-green font-bold text-lg mb-2">₺${sp}</div>
                                    <button onclick="sellPlayerForSalary('${managerName}', ${kp.id}, ${sp})" 
                                            class="bg-fifa-orange hover:bg-fifa-orange/80 text-white px-4 py-2 rounded transition-colors">
                                        <i class="fas fa-hand-holding-usd mr-2"></i>Sat
                                    </button>
                                </div>
                            </div>
                        `;
            }).join('');
        }
    }
}

// Oyuncu satış modalını gizle
function hideSalaryPlayerSaleModal() {
    const modal = document.getElementById('salaryPlayerSaleModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentSalarySaleInfo = null;
}

// Global fonksiyonlar
window.sellPlayerForSalary = sellPlayerForSalary;

// Event listeners
document.getElementById('startSeasonBtn').addEventListener('click', function () {
    // Yeni sezon: önce önceki sezonun sonuçlarını temizle
    matchResults = {};
    playedWeeks = new Set();
    try {
        localStorage.setItem('fifaMatchResults', '{}');
        localStorage.setItem('fifaPlayedWeeks', '[]');
    } catch { }

    generateFixtures(); // initializeTeams içinde takımlar sıfırlanır ve yeni fikstür oluşturulur
    populateWeekSelector();
    updateStandings(); saveLeagueState();
    saveLeagueState(); // yeni boş durum kalıcı olsun

    // Kadro maaşlarını kontrol et
    if (checkAndProcessKadroSalaries()) {
        // Tüm ödemeler tamamlandı, sezonu başlat
        completeSeasonStart();
    }
    // Eğer ödemeler bekleniyorsa, modal gösterildi ve sezon başlatma işlemi durduruldu
});

document.getElementById('restartSeasonBtn').addEventListener('click', function () {
    if (confirm('Sezonu yeniden başlatmak istediğinizden emin misiniz? Tüm veriler silinecek!')) {
        resetSeason();
        // Clear persisted fixtures
        localStorage.removeItem('fifaFixtures');
        localStorage.removeItem('fifaPlayedWeeks');
        document.getElementById('championSection').style.display = 'none';
    }
});

// Üstteki yeniden başlat butonu
document.getElementById('restartSeasonBtnTop').addEventListener('click', function () {
    if (confirm('Sezonu yeniden başlatmak istediğinizden emin misiniz? Tüm veriler silinecek!')) {
        resetSeason();
        localStorage.removeItem('fifaFixtures');
        localStorage.removeItem('fifaPlayedWeeks');
        try { localStorage.removeItem('fifaMatchResults'); } catch { }
        document.getElementById('championSection').style.display = 'none';
    }
});

document.getElementById('weekSelect').addEventListener('change', function () {
    displayMatches(this.value);
});

// Betting modal close and outside click
document.getElementById('closeBetModal').addEventListener('click', hideBetModal);
document.getElementById('betModal').addEventListener('click', function (e) {
    if (e.target === this) hideBetModal();
});
// Esc ile tüm modalları kapat
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        ['playerModal', 'balanceModal', 'slotModal', 'bankModal', 'kadroModal', 'betModal', 'alertModal', 'manualScoreModal'].forEach(id => {
            const m = document.getElementById(id); if (m && !m.classList.contains('hidden')) {
                if (id === 'betModal') hideBetModal();
                else if (id === 'alertModal') hideAlertModal(false);
                else if (id === 'balanceModal') hideBalanceModal();
                else if (id === 'manualScoreModal') closeManualScoreModal();
                else hideModal();
            }
        });
    }
});

document.getElementById('playWeekBtn').addEventListener('click', function () {
    const weekIndex = document.getElementById('weekSelect').value;
    if (weekIndex !== '') {
        playWeek(weekIndex);

        // Animation removed
    }
});

document.getElementById('closeModal').addEventListener('click', closeManualScoreModal);

document.getElementById('manualScoreModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeManualScoreModal();
    }
});

document.getElementById('saveManualScore').addEventListener('click', saveManualScore);

document.getElementById('manualScoreModal').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        saveManualScore();
    }
});

// İlk yükleme
initializeTeams();
updateStandings();