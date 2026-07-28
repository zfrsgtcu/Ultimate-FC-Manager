// Bank & Credit System
// FIFA FC Manager - Bank Module

// Bank variables
let bankData = JSON.parse(localStorage.getItem('fifaBank')) || {};

// Kısayol referansı
const BANK_CFG = () => CONFIG.BANK;

// Bank functions
function saveBankData() {
    localStorage.setItem('fifaBank', JSON.stringify(bankData));
}

function showBankModal(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    currentPlayerId = player.fullName;

    const modal = document.getElementById('bankModal');
    const playerImage = document.getElementById('bankPlayerImage');
    const playerName = document.getElementById('bankPlayerName');
    const playerTeam = document.getElementById('bankPlayerTeam');
    const currentBalance = document.getElementById('bankCurrentBalance');

    playerImage.src = player.profileImage || 'content/images/player-placeholder.svg';
    playerName.textContent = player.fullName;
    playerTeam.textContent = player.team;
    currentBalance.textContent = player.balance.toFixed(2);

    // Config değerlerini modal'a yansıt
    const cfg = BANK_CFG();
    const interestPct = Math.round(cfg.INTEREST_RATE * 100);

    document.getElementById('bankCreditLimitDisplay').textContent = `₺${cfg.CREDIT_LIMIT}`;
    document.getElementById('creditInterestLabel').textContent = `Faiz (%${interestPct}):`;

    const creditInput = document.getElementById('creditAmount');
    creditInput.max = cfg.CREDIT_LIMIT;
    creditInput.value = Math.min(100, cfg.CREDIT_LIMIT);
    creditInput.placeholder = `1 - ${cfg.CREDIT_LIMIT}`;

    // Initialize player debt if not exists
    if (!bankData[player.fullName]) {
        bankData[player.fullName] = {
            debt: 0,
            interestRate: BANK_CFG().INTEREST_RATE,
            debtSeason: currentSeason,
            latePaymentStarted: false
        };
    }

    updateBankDisplay(player.fullName);

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // GSAP animation
    gsap.fromTo(modal.querySelector('.transform'),
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" }
    );
}

function hideBankModal() {
    const modal = document.getElementById('bankModal');
    gsap.to(modal.querySelector('.transform'), {
        scale: 0.8,
        opacity: 0,
        duration: 0.3,
        onComplete: () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });
}

function updateBankDisplay(playerName) {
    const player = players.find(p => p.fullName === playerName);
    if (!player) return;

    const debt = bankData[playerName] ? bankData[playerName].debt : 0;
    const latePaymentStarted = bankData[playerName] ? bankData[playerName].latePaymentStarted : false;
    const debtSeason = bankData[playerName] ? bankData[playerName].debtSeason : null;
    document.getElementById('currentDebt').textContent = `₺${debt.toFixed(2)}`;
    document.getElementById('totalDebtAmount').textContent = `₺${debt.toFixed(2)}`;
    document.getElementById('paymentPower').textContent = `₺${player.balance.toFixed(2)}`;

    // Show debt status
    const debtStatus = document.getElementById('debtStatus') || document.createElement('div');
    if (!document.getElementById('debtStatus')) {
        debtStatus.id = 'debtStatus';
        debtStatus.className = 'mt-2 text-sm';
        document.getElementById('currentDebt').parentNode.appendChild(debtStatus);
    }

    if (debt > 0) {
        if (latePaymentStarted) {
            debtStatus.innerHTML = '<span class="text-fifa-red font-bold">⚠️ Gecikme faizi işliyor!</span>';
        } else if (debtSeason === currentSeason) {
            debtStatus.innerHTML = '<span class="text-fifa-green">✅ İlk sezon - Gecikme faizi henüz başlamadı</span>';
        } else {
            debtStatus.innerHTML = '<span class="text-fifa-orange">⏰ Eski borç - Maç sonrası faiz işliyor</span>';
        }
    } else {
        debtStatus.innerHTML = '';
    }

    // Show/hide sections based on debt
    const takeSection = document.getElementById('takeCreditSection');
    const paySection = document.getElementById('payCreditSection');

    if (debt > 0) {
        takeSection.classList.add('hidden');
        paySection.classList.remove('hidden');
    } else {
        takeSection.classList.remove('hidden');
        paySection.classList.add('hidden');
    }
}

function calculateCredit() {
    const cfg = BANK_CFG();
    const amount = parseInt(document.getElementById('creditAmount').value);
    if (!amount || amount <= 0 || amount > cfg.CREDIT_LIMIT) return;

    const interest = amount * cfg.INTEREST_RATE;
    const total = amount + interest;

    document.getElementById('creditPrincipal').textContent = `₺${amount.toFixed(2)}`;
    document.getElementById('creditInterest').textContent = `₺${interest.toFixed(2)}`;
    document.getElementById('creditTotal').textContent = `₺${total.toFixed(2)}`;

    document.getElementById('creditCalculation').classList.remove('hidden');
    document.getElementById('takeCreditBtn').disabled = false;
}

function takeCredit() {
    const cfg = BANK_CFG();
    const player = players.find(p => p.fullName === currentPlayerId);
    if (!player) return;

    const amount = parseInt(document.getElementById('creditAmount').value);
    const interestPct = Math.round(cfg.INTEREST_RATE * 100);

    if (!amount || amount <= 0 || amount > cfg.CREDIT_LIMIT) {
        showAlertModal('error', 'Hata', `Geçerli bir tutar girin! (Maks: ₺${cfg.CREDIT_LIMIT})`);
        return;
    }

    // Check if player already has debt (unless it's for salary payment)
    if (bankData[player.fullName] && bankData[player.fullName].debt > 0 && !window.isSalaryPaymentCredit) {
        showAlertModal('error', 'Kredi Hatası', 'Mevcut borcunuz varken yeni kredi çekemezsiniz!');
        return;
    }

    // Initialize player debt
    if (!bankData[player.fullName]) {
        bankData[player.fullName] = {
            debt: 0,
            interestRate: cfg.INTEREST_RATE,
            debtSeason: currentSeason,
            latePaymentStarted: false
        };
    }

    const interest = amount * cfg.INTEREST_RATE;
    const totalDebt = amount + interest;

    // Add credit to player balance
    player.balance += amount;
    addTransactionLog('loan', player.fullName, amount, `Kredi Çekildi`, '🏦');

    // Set debt (add to existing if salary payment credit)
    if (window.isSalaryPaymentCredit && bankData[player.fullName].debt > 0) {
        bankData[player.fullName].debt += totalDebt;
    } else {
        bankData[player.fullName].debt = totalDebt;
        bankData[player.fullName].debtSeason = currentSeason;
        bankData[player.fullName].latePaymentStarted = false;
    }

    // Save data
    savePlayers();
    saveBankData();

    // Update displays
    updateStats();
    renderPlayers();
    updateBankDisplay(currentPlayerId);

    // If this is for salary payment, process payment after credit
    if (window.isSalaryPaymentCredit && window.processSalaryAfterCredit) {
        window.isSalaryPaymentCredit = false;
        setTimeout(() => {
            window.processSalaryAfterCredit(player);
            window.processSalaryAfterCredit = null;
        }, 500);
    } else {
        showAlertModal('success', 'Kredi Çekildi!', `₺${amount} kredi bakiyenize eklendi.\nToplam borç: ₺${bankData[player.fullName].debt.toFixed(2)}\n(%${interestPct} faiz dahil)`);
    }
}

function payCredit() {
    const player = players.find(p => p.fullName === currentPlayerId);
    if (!player) return;

    const debt = bankData[player.fullName].debt;

    if (debt <= 0) {
        showAlertModal('error', 'Hata', 'Ödenecek borç bulunmuyor!');
        return;
    }

    const paymentAmount = Math.min(player.balance, debt);

    // Deduct payment from balance and debt
    player.balance -= paymentAmount;
    bankData[player.fullName].debt -= paymentAmount;

    if (bankData[player.fullName].debt < 0.01) {
        bankData[player.fullName].debt = 0;
    }

    // Log payment
    addTransactionLog('debit', player.fullName, paymentAmount, `Kredi Borç Ödemesi`, '🏦');

    // Save data
    savePlayers();
    saveBankData();

    // Update displays
    updateStats();
    renderPlayers();
    updateBankDisplay(player.fullName);

    // Show success message
    if (bankData[player.fullName].debt === 0) {
        showAlertModal('success', 'Borç Ödendi!', `₺${paymentAmount.toFixed(2)} borç tamamen ödendi!`);
    } else {
        showAlertModal('success', 'Kısmi Ödeme!', `₺${paymentAmount.toFixed(2)} borç ödendi.\nKalan borç: ₺${bankData[player.fullName].debt.toFixed(2)}`);
    }
}

function processMatchDebtIncrease() {
    const cfg = BANK_CFG();
    players.forEach(player => {
        if (bankData[player.fullName] && bankData[player.fullName].debt > 0) {
            // Only apply match interest if late payment has started
            if (bankData[player.fullName].latePaymentStarted) {
                const oldDebt = bankData[player.fullName].debt;
                bankData[player.fullName].debt *= cfg.MATCH_DEBT_INTEREST_RATE;
                const increaseAmount = bankData[player.fullName].debt - oldDebt;
                const pct = Math.round((cfg.MATCH_DEBT_INTEREST_RATE - 1) * 100);

                // Log debt increase
                addTransactionLog('debit', player.fullName, increaseAmount, `Maç Sonrası Borç Artışı (%${pct} faiz)`, '📈');
            }
        }
    });

    saveBankData();
}

function processSeasonEndPayments() {
    const cfg = BANK_CFG();
    const seasonDebtPct = Math.round((cfg.SEASON_DEBT_INTEREST_RATE - 1) * 100);

    players.forEach(player => {
        // Process bank debt payments
        if (bankData[player.fullName] && bankData[player.fullName].debt > 0) {
            const debt = bankData[player.fullName].debt;
            const paymentAmount = Math.min(player.balance, debt);

            player.balance -= paymentAmount;
            bankData[player.fullName].debt -= paymentAmount;

            // Log the debt payment
            if (paymentAmount > 0) {
                addTransactionLog('debit', player.fullName, paymentAmount, `Sezon Sonu Kredi Borç Ödemesi`, '🏦');
            }

            if (bankData[player.fullName].debt < 0.01) {
                bankData[player.fullName].debt = 0;
            } else {
                // Mark late payment started if first season debt not paid
                if (bankData[player.fullName].debtSeason === currentSeason && !bankData[player.fullName].latePaymentStarted) {
                    bankData[player.fullName].latePaymentStarted = true;
                    addTransactionLog('warning', player.fullName, 0, `İlk sezon borcu ödenmedi - Gecikme faizi başladı!`, '⚠️');
                }

                // Increase debt per config rate
                const oldDebtSeasonEnd = bankData[player.fullName].debt;
                bankData[player.fullName].debt *= cfg.SEASON_DEBT_INTEREST_RATE;
                const debtIncreaseSeasonEnd = bankData[player.fullName].debt - oldDebtSeasonEnd;
                addTransactionLog('debit', player.fullName, debtIncreaseSeasonEnd, `Kredi Borcu Artırıldı (%${seasonDebtPct} faiz)`, '📈');
            }
        }

        // Process kadro salary payments at season end
        if (kadroData[player.fullName] && kadroData[player.fullName].length > 0) {
            const totalSalary = kadroData[player.fullName].reduce((sum, kadroPlayer) => sum + kadroPlayer.salaryCost, 0);

            if (player.balance >= totalSalary) {
                player.balance -= totalSalary;
                addTransactionLog('debit', player.fullName, totalSalary, `Sezon Sonu Maaş Ödemesi`, '💸');
            } else {
                processKadroSalaryPayment(player.fullName, totalSalary);
            }
        }
    });

    savePlayers();
    saveBankData();
    saveKadroData();
    updateStats();
    renderPlayers();
}

function processKadroSalaryPayment(playerName, totalSalary) {
    const player = players.find(p => p.fullName === playerName);
    if (!player) return;

    const kadro = kadroData[playerName] || [];

    // Deduct available balance first
    const availableBalance = player.balance;
    player.balance = 0;
    let remainingSalary = totalSalary - availableBalance;

    if (remainingSalary <= 0) return;

    // Start selling players randomly until salary is covered
    const soldPlayers = [];
    while (remainingSalary > 0 && kadro.length > 0) {
        const randomIndex = Math.floor(Math.random() * kadro.length);
        const kadroPlayer = kadro[randomIndex];

        // Sale price comes from kadro config (stored at purchase time)
        const salePrice = kadroPlayer.salePrice || (kadroPlayer.totalCost * CONFIG.KADRO.SALE_PRICE_MULTIPLIER);

        player.balance += salePrice;
        remainingSalary -= salePrice;

        addTransactionLog('credit', player.fullName, salePrice, `Maaş için ${kadroPlayer.name} (${kadroPlayer.overall} OVR) satıldı`, '⚠️');
        soldPlayers.push(kadroPlayer.name);

        kadro.splice(randomIndex, 1);
    }

    // Deduct remaining salary from balance
    if (remainingSalary < 0) {
        player.balance += Math.abs(remainingSalary);
    }

    kadroData[playerName] = kadro;

    if (soldPlayers.length > 0) {
        showAlertModal('warning', 'Maaş Ödemesi',
            `${player.fullName} yeterli bakiyeye sahip olmadığı için maaş ödemesi yapabilmek amacıyla şu oyuncular otomatik olarak satıldı:\n\n${soldPlayers.join(', ')}`);
    }
}

// Make functions globally available
window.showBankModal = showBankModal;
window.hideBankModal = hideBankModal;
window.updateBankDisplay = updateBankDisplay;
window.calculateCredit = calculateCredit;
window.takeCredit = takeCredit;
window.payCredit = payCredit;
window.processMatchDebtIncrease = processMatchDebtIncrease;
window.processSeasonEndPayments = processSeasonEndPayments;
window.saveBankData = saveBankData;
