// Casino & Slot Machine System
// FIFA FC Manager - Casino Module

// Slot configuration — değerler CONFIG.CASINO üzerinden alınır
const slotSymbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '🎰', '💎', '🔔'];

// Slot functions
function showSlotModal(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    currentPlayerId = player.fullName;
    currentBetAmount = CONFIG.CASINO.SLOT_MIN_BET;

    const modal = document.getElementById('slotModal');
    const playerImage = document.getElementById('slotPlayerImage');
    const playerName = document.getElementById('slotPlayerName');
    const playerTeam = document.getElementById('slotPlayerTeam');
    const currentBalance = document.getElementById('slotCurrentBalance');
    const betAmountSpan = document.getElementById('slotBetAmount');

    playerImage.src = player.profileImage || 'content/images/player-placeholder.svg';
    playerName.textContent = player.fullName;
    playerTeam.textContent = player.team;
    currentBalance.textContent = player.balance.toFixed(2);
    betAmountSpan.textContent = currentBetAmount;

    // Reset slot symbols
    const slot1 = document.getElementById('slot1').querySelector('.slot-symbol');
    const slot2 = document.getElementById('slot2').querySelector('.slot-symbol');
    const slot3 = document.getElementById('slot3').querySelector('.slot-symbol');

    slot1.textContent = '🍒';
    slot2.textContent = '🍋';
    slot3.textContent = '🍊';
    slot1.style.transform = 'translateY(0)';
    slot2.style.transform = 'translateY(0)';
    slot3.style.transform = 'translateY(0)';

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.getElementById('slotResult').classList.add('hidden');
    document.getElementById('spinSlotBtn').disabled = false;

    // GSAP animation
    gsap.fromTo(modal.querySelector('.transform'),
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)",
          onComplete: () => {
            modal.querySelector('.transform').style.opacity = '1';
          }
        }
    );
}

function hideSlotModal() {
    const modal = document.getElementById('slotModal');
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

function changeSlotBetAmount(change) {
    const player = players.find(p => p.fullName === currentPlayerId);
    if (!player) return;

    const newAmount = currentBetAmount + change;

    if (newAmount >= CONFIG.CASINO.SLOT_MIN_BET && newAmount <= player.balance) {
        currentBetAmount = newAmount;
        document.getElementById('slotBetAmount').textContent = currentBetAmount;
    }
}

function spinSlot() {
    if (isSpinning) return;

    const player = players.find(p => p.fullName === currentPlayerId);
    if (!player || player.balance < currentBetAmount) {
        showAlertModal('error', 'Yetersiz Bakiye', 'Slot oynamak için yeterli bakiyeniz yok!');
        return;
    }

    isSpinning = true;
    document.getElementById('spinSlotBtn').disabled = true;
    document.getElementById('slotResult').classList.add('hidden');

    // Deduct bet amount
    player.balance -= currentBetAmount;
    addTransactionLog('debit', player.fullName, currentBetAmount, `Slot Oyunu Bahis`, '🎰');
    savePlayers();
    updateStats();
    renderPlayers();

    // Generate random symbols with weighted probabilities
    const symbols = generateWeightedSymbols();

    // Animate slot reels
    animateSlotReels(symbols, () => {
        // Calculate win
        const winAmount = calculateSlotWin(symbols);

        if (winAmount > 0) {
            player.balance += winAmount;
            addTransactionLog('bonus', player.fullName, winAmount, `Slot Oyunu Kazancı`, '🎰');
            savePlayers();
            updateStats();
            renderPlayers();
        }

        // Show result
        showSlotResult(symbols, winAmount);

        isSpinning = false;
        document.getElementById('spinSlotBtn').disabled = false;
    });
}

function generateWeightedSymbols() {
    const cfg = CONFIG.CASINO;

    // Dinamik kazanma oranı — config üzerinden
    const winRate = cfg.SLOT_WIN_RATE_BASE + (Math.random() * cfg.SLOT_WIN_RATE_RANGE);
    const thr = cfg.SLOT_WIN_THRESHOLDS;

    console.log(`Bu çevirmede kazanma oranı: ${(winRate * 100).toFixed(1)}%`);

    const allSymbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '🎰', '💎', '🔔'];
    const symbols = [];

    const isWin = Math.random() < winRate;

    if (isWin) {
        const winType = Math.random();

        if (winType < thr.JACKPOT) {
            // Jackpot — 3x 🎰
            symbols.push('🎰', '🎰', '🎰');
        } else if (winType < thr.TRIPLE) {
            // 3x aynı sembol
            const symbol = allSymbols[Math.floor(Math.random() * allSymbols.length)];
            symbols.push(symbol, symbol, symbol);
        } else if (winType < thr.DOUBLE) {
            // 2x aynı sembol
            const symbol = allSymbols[Math.floor(Math.random() * allSymbols.length)];
            const otherSymbol = allSymbols.filter(s => s !== symbol)[Math.floor(Math.random() * (allSymbols.length - 1))];

            const positions = [0, 1, 2];
            const samePositions = positions.sort(() => 0.5 - Math.random()).slice(0, 2);

            for (let i = 0; i < 3; i++) {
                symbols.push(samePositions.includes(i) ? symbol : otherSymbol);
            }
        } else {
            // 3x kiraz özel bonus
            symbols.push('🍒', '🍒', '🍒');
        }
    } else {
        // Kayıp kombinasyonu — 3 farklı sembol
        const shuffledSymbols = [...allSymbols].sort(() => 0.5 - Math.random());
        symbols.push(shuffledSymbols[0], shuffledSymbols[1], shuffledSymbols[2]);

        if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
            symbols[1] = allSymbols.filter(s => s !== symbols[0] && s !== symbols[2])[0];
        }
    }

    return symbols;
}

function animateSlotReels(symbols, callback) {
    const reels = [
        document.getElementById('slot1').querySelector('.slot-symbol'),
        document.getElementById('slot2').querySelector('.slot-symbol'),
        document.getElementById('slot3').querySelector('.slot-symbol')
    ];

    reels.forEach((reel, index) => {
        const duration = 1 + (index * 0.3);

        gsap.to(reel, {
            y: -200,
            duration: duration,
            ease: "power2.out",
            repeat: 3,
            yoyo: true,
            onComplete: () => {
                reel.textContent = symbols[index];
                reel.style.transform = 'translateY(0)';

                if (index === 2) {
                    setTimeout(callback, 300);
                }
            }
        });
    });
}

function calculateSlotWin(symbols) {
    const payouts = CONFIG.CASINO.SLOT_PAYOUTS;
    const [s1, s2, s3] = symbols;

    // Jackpot — 3x 🎰
    if (s1 === '🎰' && s2 === '🎰' && s3 === '🎰') {
        return currentBetAmount * payouts.jackpot;
    }

    // Cherry bonus — 3x 🍒
    if (s1 === '🍒' && s2 === '🍒' && s3 === '🍒') {
        return currentBetAmount * payouts.cherry_bonus;
    }

    // 3x aynı sembol
    if (s1 === s2 && s2 === s3) {
        return currentBetAmount * payouts['3x_same'];
    }

    // 2x aynı sembol
    if (s1 === s2 || s2 === s3 || s1 === s3) {
        return currentBetAmount * payouts['2x_same'];
    }

    return 0; // No win
}

function showSlotResult(symbols, winAmount) {
    const resultDiv = document.getElementById('slotResult');
    const resultText = document.getElementById('slotResultText');
    const resultAmount = document.getElementById('slotResultAmount');

    if (winAmount > 0) {
        resultText.textContent = `🎉 Tebrikler! ${symbols.join(' ')} kazandınız!`;
        resultText.className = 'text-xl font-bold mb-2 text-fifa-green';
        resultAmount.textContent = `+₺${winAmount.toFixed(2)}`;
        resultAmount.className = 'text-2xl font-bold text-fifa-green';
    } else {
        resultText.textContent = `😔 ${symbols.join(' ')} - Maalesef kaybettiniz!`;
        resultText.className = 'text-xl font-bold mb-2 text-fifa-red';
        resultAmount.textContent = `-₺${currentBetAmount.toFixed(2)}`;
        resultAmount.className = 'text-2xl font-bold text-fifa-red';
    }

    resultDiv.classList.remove('hidden');

    // Update balance display
    const player = players.find(p => p.fullName === currentPlayerId);
    if (player) {
        document.getElementById('slotCurrentBalance').textContent = player.balance.toFixed(2);
    }
}

// Make functions globally available
window.showSlotModal = showSlotModal;
window.hideSlotModal = hideSlotModal;
window.changeSlotBetAmount = changeSlotBetAmount;
window.spinSlot = spinSlot;
