// Kadro Management System
// FIFA FC Manager - Kadro Module

// Kadro variables
let kadroData = JSON.parse(localStorage.getItem('fifaKadro')) || {};
let currentKadroPlayerId = null;

// Kadro functions
function saveKadroData() {
    localStorage.setItem('fifaKadro', JSON.stringify(kadroData));
}

function calculateKadroCost(overall) {
    const tiers = CONFIG.KADRO.SALARY_TIERS;
    const tier = tiers.find(t => overall >= t.min && overall <= t.max);
    const rate    = tier ? tier.rate    : 0;
    const divisor = tier ? tier.divisor : 0.5;
    return { rate, divisor, rateText: `%${rate}` };
}

function showKadroModal(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    currentKadroPlayerId = player.fullName;

    const modal = document.getElementById('kadroModal');
    const playerImage = document.getElementById('kadroPlayerImage');
    const playerName = document.getElementById('kadroPlayerName');
    const playerTeam = document.getElementById('kadroPlayerTeam');
    const currentBalance = document.getElementById('kadroCurrentBalance');

    playerImage.src = player.profileImage || 'content/images/player-placeholder.svg';
    playerName.textContent = player.fullName;
    playerTeam.textContent = player.team;
    currentBalance.textContent = player.balance.toFixed(2);

    // Initialize kadro if not exists
    if (!kadroData[player.fullName]) {
        kadroData[player.fullName] = [];
    }

    updateKadroDisplay(player.fullName);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function hideKadroModal() {
    const modal = document.getElementById('kadroModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function showAddKadroPlayerModal() {
    const cfg = CONFIG.KADRO;
    const panel = document.getElementById('addKadroFormPanel');
    const arrow = document.getElementById('addKadroFormArrow');

    // Zaten açıksa kapat (toggle)
    if (!panel.classList.contains('hidden')) {
        hideAddKadroPlayerModal();
        return;
    }

    // Formu sıfırla
    document.getElementById('kadroPlayerNameInput').value = '';
    document.getElementById('kadroCostDisplay').classList.add('hidden');
    document.getElementById('addKadroPlayerBtn').disabled = true;

    // Config'den overall aralığını ayarla
    const overallInput = document.getElementById('kadroPlayerOverall');
    overallInput.min = cfg.OVERALL_MIN;
    overallInput.max = cfg.OVERALL_MAX;
    overallInput.placeholder = `${cfg.OVERALL_MIN}-${cfg.OVERALL_MAX} arası`;
    overallInput.value = '';

    // Maaş kademeleri tablosunu render et (config'den)
    const tiersEl = document.getElementById('salaryTiersTable');
    tiersEl.innerHTML = `
        <div class="grid grid-cols-3 bg-fifa-darker/80 px-3 py-2 font-semibold text-gray-300 border-b border-gray-700/50 text-center">
            <span>OVR Aralığı</span>
            <span>Maaş</span>
            <span class="text-left pl-2">Örnek</span>
        </div>
        ${cfg.SALARY_TIERS.map(t => {
            const exOvr     = Math.round((t.min + t.max) / 2);
            const exOvrCost = Math.floor(exOvr * t.divisor);
            const exTotal   = exOvrCost + t.rate;
            return `
            <div class="grid grid-cols-3 px-3 py-1 border-b border-gray-700/20 hover:bg-fifa-blue/10 transition-colors text-center items-center">
                <span class="text-gray-400">${t.min}–${t.max}</span>
                <span class="text-fifa-orange font-bold">₺${t.rate}</span>
                <span class="text-gray-500 text-left pl-2">
                    ${exOvr} OVR = ${exOvrCost}₺ + ${t.rate}₺ = <span class="text-white font-semibold">${exTotal}₺</span>
                </span>
            </div>`;
        }).join('')}
    `;

    // Paneli aç, oku döndür
    panel.classList.remove('hidden');
    arrow.style.transform = 'rotate(180deg)';

    // Input listener ekle
    overallInput.removeEventListener('input', calculateKadroPlayerCost);
    overallInput.addEventListener('input', calculateKadroPlayerCost);

    // Formu görünür yere kaydır
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAddKadroPlayerModal() {
    const panel = document.getElementById('addKadroFormPanel');
    const arrow = document.getElementById('addKadroFormArrow');

    panel.classList.add('hidden');
    arrow.style.transform = 'rotate(0deg)';

    // Formu sıfırla
    document.getElementById('kadroPlayerNameInput').value = '';
    document.getElementById('kadroPlayerOverall').value = '';
    document.getElementById('kadroCostDisplay').classList.add('hidden');
    document.getElementById('addKadroPlayerBtn').disabled = true;
}

function calculateKadroPlayerCost() {
    const cfg = CONFIG.KADRO;
    const overall = parseInt(document.getElementById('kadroPlayerOverall').value);
    const playerName = document.getElementById('kadroPlayerNameInput').value.trim();

    if (overall >= cfg.OVERALL_MIN && overall <= cfg.OVERALL_MAX && playerName) {
        const salaryInfo = calculateKadroCost(overall);
        const overallCost = Math.floor(overall * salaryInfo.divisor);
        const salaryCost = salaryInfo.rate;
        const totalCost = overallCost + salaryCost;

        document.getElementById('costOverall').textContent = overall;
        document.getElementById('costRate').textContent = `Maaş: ${salaryInfo.rateText}`;
        document.getElementById('costTotal').textContent = `₺${totalCost} (Overall: ₺${overallCost} + Maaş: ₺${salaryCost})`;
        document.getElementById('kadroCostDisplay').classList.remove('hidden');
        document.getElementById('addKadroPlayerBtn').disabled = false;
    } else {
        document.getElementById('kadroCostDisplay').classList.add('hidden');
        document.getElementById('addKadroPlayerBtn').disabled = true;
    }
}

function addKadroPlayer() {
    const cfg = CONFIG.KADRO;
    const playerName = document.getElementById('kadroPlayerNameInput').value.trim();
    const overall = parseInt(document.getElementById('kadroPlayerOverall').value);

    if (!playerName || !overall || overall < cfg.OVERALL_MIN || overall > cfg.OVERALL_MAX) {
        showAlertModal('error', 'Hata', `Geçerli bir oyuncu ismi ve overall girin! (${cfg.OVERALL_MIN}-${cfg.OVERALL_MAX} arası)`);
        return;
    }

    const player = players.find(p => p.fullName === currentKadroPlayerId);
    if (!player) return;

    const salaryInfo = calculateKadroCost(overall);
    const overallCost = Math.floor(overall * salaryInfo.divisor);
    const salaryCost = salaryInfo.rate;
    const totalCost = overallCost + salaryCost;
    const salePrice = Math.floor(totalCost * cfg.SALE_PRICE_MULTIPLIER);

    // Check if player has enough balance
    if (player.balance < totalCost) {
        showAlertModal('error', 'Yetersiz Bakiye', `Oyuncu eklemek için ₺${totalCost} gerekli!\n(Overall: ₺${overallCost} + Maaş: ₺${salaryCost})\nMevcut bakiye: ₺${player.balance.toFixed(2)}`);
        return;
    }

    // Deduct total cost from player balance immediately
    player.balance -= totalCost;
    addTransactionLog('kadro', player.fullName, totalCost, `${playerName} Oyuncu Alımı (Overall: ${overall})`, '⚽');

    // Add player to kadro
    const newPlayer = {
        id: Date.now(),
        name: playerName,
        overall: overall,
        overallCost: overallCost,
        salaryCost: salaryCost,
        totalCost: totalCost,
        forSale: false,
        salePrice: salePrice
    };

    if (!kadroData[player.fullName]) {
        kadroData[player.fullName] = [];
    }

    kadroData[player.fullName].push(newPlayer);

    // Save data
    savePlayers();
    saveKadroData();

    // Update displays
    updateKadroDisplay(player.fullName);
    updateStats();
    renderPlayers();

    document.getElementById('kadroCurrentBalance').textContent = player.balance.toFixed(2);

    hideAddKadroPlayerModal();

    const salePct = Math.round(cfg.SALE_PRICE_MULTIPLIER * 100);
    showAlertModal('success', 'Oyuncu Eklendi!',
        `${playerName} (Overall: ${overall}) kadroya eklendi!\nBakiyeden ₺${totalCost} düşüldü!\n(Overall: ₺${overallCost} + Maaş: ₺${salaryCost})\nSatış fiyatı: ₺${salePrice} (%${salePct})`);
}

function updateKadroDisplay(playerName) {
    const kadroList = document.getElementById('kadroList');
    const playerKadro = kadroData[playerName] || [];

    if (playerKadro.length === 0) {
        kadroList.innerHTML = '<p class="text-gray-400 text-center">Henüz oyuncu eklenmemiş</p>';
        return;
    }

    kadroList.innerHTML = playerKadro.map(player => `
        <div class="flex items-center justify-between bg-fifa-darker rounded-lg p-3">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-fifa-blue rounded-full flex items-center justify-center">
                    <span class="text-white font-bold text-sm">${player.overall}</span>
                </div>
                <div>
                    <h5 class="text-white font-bold">${player.name}</h5>
                    <p class="text-gray-400 text-sm">Overall: ₺${player.overallCost || player.overall} | Maaş: ₺${player.salaryCost || calculateKadroCost(player.overall).rate}</p>
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <button onclick="sellPlayer('${playerName}', ${player.id})" class="bg-fifa-orange hover:bg-fifa-orange/80 text-white px-3 py-1 rounded text-xs transition-colors">Sat</button>
                <button onclick="removeKadroPlayer('${playerName}', ${player.id})" class="bg-fifa-red hover:bg-fifa-red/80 text-white px-3 py-1 rounded text-xs transition-colors">Sil</button>
            </div>
        </div>
    `).join('');
}

function sellPlayer(managerName, playerId) {
    const kadroPlayer = kadroData[managerName].find(p => p.id === playerId);
    const manager = players.find(p => p.fullName === managerName);

    if (!kadroPlayer || !manager) return;

    showAlertModal('warning', 'Oyuncu Satışı',
        `${kadroPlayer.name} (Overall: ${kadroPlayer.overall}) oyuncusunu satmak istediğinizden emin misiniz?\n\nSatış fiyatı: ₺${kadroPlayer.salePrice}`,
        () => {
            confirmSellPlayer(managerName, playerId, kadroPlayer, manager);
        }
    );
}

function confirmSellPlayer(managerName, playerId, kadroPlayer, manager) {
    manager.balance += kadroPlayer.salePrice;
    addTransactionLog('credit', manager.fullName, kadroPlayer.salePrice, `${kadroPlayer.name} Oyuncu Satışı`, '👤');

    kadroData[managerName] = kadroData[managerName].filter(p => p.id !== playerId);

    savePlayers();
    saveKadroData();

    updateKadroDisplay(managerName);
    updateStats();
    renderPlayers();

    document.getElementById('kadroCurrentBalance').textContent = manager.balance.toFixed(2);

    showAlertModal('success', 'Oyuncu Satıldı!', `${kadroPlayer.name} satıldı!\n₺${kadroPlayer.salePrice} bakiyeye eklendi!`);
}

function removeKadroPlayer(managerName, playerId) {
    const kadroPlayer = kadroData[managerName].find(p => p.id === playerId);
    if (!kadroPlayer) return;

    showAlertModal('warning', 'Oyuncu Silme',
        `${kadroPlayer.name} (Overall: ${kadroPlayer.overall}) oyuncusunu kadrodan silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`,
        () => {
            confirmRemoveKadroPlayer(managerName, playerId, kadroPlayer);
        }
    );
}

function confirmRemoveKadroPlayer(managerName, playerId, kadroPlayer) {
    kadroData[managerName] = kadroData[managerName].filter(p => p.id !== playerId);

    saveKadroData();
    updateKadroDisplay(managerName);

    showAlertModal('success', 'Oyuncu Silindi', `${kadroPlayer.name} kadrodan silindi!`);
}

function processKadroCostPayment(playerName, totalCost) {
    const player = players.find(p => p.fullName === playerName);
    if (!player) return;

    const kadro = kadroData[playerName] || [];

    const availableBalance = player.balance;
    player.balance = 0;
    let remainingCost = totalCost - availableBalance;

    while (remainingCost > 0 && kadro.length > 0) {
        const availablePlayers = kadro.filter(p => !p.forSale);

        if (availablePlayers.length === 0) break;

        const randomIndex = Math.floor(Math.random() * availablePlayers.length);
        const playerToSell = availablePlayers[randomIndex];

        playerToSell.forSale = true;

        player.balance += playerToSell.salePrice;
        remainingCost -= playerToSell.salePrice;

        if (player.balance >= remainingCost) {
            player.balance -= remainingCost;
            remainingCost = 0;
        }
    }

    const soldPlayers = kadro.filter(p => p.forSale);
    if (soldPlayers.length > 0) {
        const soldNames = soldPlayers.map(p => p.name).join(', ');
        setTimeout(() => {
            showAlertModal('warning', 'Oyuncular Satıldı!',
                `${player.fullName} oyuncusunun kadrosundan ${soldPlayers.length} oyuncu satıldı:\n\n${soldNames}\n\nToplam gelir: ₺${soldPlayers.reduce((sum, p) => sum + p.salePrice, 0)}`);
        }, 2000);
    }
}

// Update existing kadro costs after config changes
function updateExistingKadroCosts() {
    const cfg = CONFIG.KADRO;
    for (const managerName in kadroData) {
        if (kadroData.hasOwnProperty(managerName)) {
            kadroData[managerName].forEach(player => {
                const salaryInfo = calculateKadroCost(player.overall);
                player.overallCost = Math.floor(player.overall * salaryInfo.divisor);
                player.salaryCost = salaryInfo.rate;
                player.totalCost = player.overallCost + player.salaryCost;
                player.salePrice = Math.floor(player.totalCost * cfg.SALE_PRICE_MULTIPLIER);
            });
        }
    }
    saveKadroData();
}

// Call update for existing players
updateExistingKadroCosts();

// Make functions globally available
window.showKadroModal = showKadroModal;
window.hideKadroModal = hideKadroModal;
window.showAddKadroPlayerModal = showAddKadroPlayerModal;
window.hideAddKadroPlayerModal = hideAddKadroPlayerModal;
window.calculateKadroPlayerCost = calculateKadroPlayerCost;
window.addKadroPlayer = addKadroPlayer;
window.updateKadroDisplay = updateKadroDisplay;
window.sellPlayer = sellPlayer;
window.removeKadroPlayer = removeKadroPlayer;
window.saveKadroData = saveKadroData;
