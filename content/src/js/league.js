// League Management System
// FIFA FC Manager - League Module

// League variables
let leagueData = JSON.parse(localStorage.getItem('fifaLeague')) || {
    teams: {},
    matches: [],
    maxMatches: CONFIG.LEAGUE.MAX_MATCHES_PER_TEAM,
    seasonCompleted: false
};

// League functions
function saveLeagueData() {
    localStorage.setItem('fifaLeague', JSON.stringify(leagueData));
}

function initializeLeague() {
    // Initialize teams from players
    players.forEach(player => {
        if (!leagueData.teams[player.team]) {
            leagueData.teams[player.team] = {
                name: player.team,
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                points: 0
            };
        }
    });

    updateLeagueTable();
    updateLeagueStats();
}

function updateLeagueTable() {
    const tableBody = document.getElementById('leagueTableBody');
    const teams = Object.values(leagueData.teams);

    // Sort teams by points, then by goal difference
    teams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
    });

    tableBody.innerHTML = teams.map((team, index) => {
        const goalDifference = team.goalsFor - team.goalsAgainst;
        const goalDiffDisplay = goalDifference > 0 ? `+${goalDifference}` : goalDifference.toString();
        const goalDiffClass = goalDifference > 0 ? 'text-fifa-green' : goalDifference < 0 ? 'text-fifa-red' : 'text-gray-400';

        // Generate form chart for last 5 matches
        const formChart = generateFormChart(team.name);

        // Check if championship is guaranteed
        const isChampionGuaranteed = checkChampionshipGuaranteed(team.name, teams);
        const championBadge = isChampionGuaranteed ?
            '<span class="inline-block ml-2 text-fifa-orange font-bold text-lg cursor-help" title="Şampiyon Olarak">Ş</span>' : '';

        return `
        <tr class="border-b border-gray-700/30 hover:bg-fifa-dark/30 transition-colors">
            <td class="py-3 px-4 font-bold">${index + 1}</td>
            <td class="py-3 px-4 font-medium">${team.name}${championBadge}</td>
            <td class="py-3 px-2 text-center">${team.played}</td>
            <td class="py-3 px-2 text-center text-fifa-green">${team.won}</td>
            <td class="py-3 px-2 text-center text-fifa-blue">${team.drawn}</td>
            <td class="py-3 px-2 text-center text-fifa-red">${team.lost}</td>
            <td class="py-3 px-2 text-center">${team.goalsFor}</td>
            <td class="py-3 px-2 text-center">${team.goalsAgainst}</td>
            <td class="py-3 px-2 text-center font-bold ${goalDiffClass}">${goalDiffDisplay}</td>
            <td class="py-3 px-2 text-center">
                <div class="flex justify-center space-x-1">
                    ${formChart}
                </div>
            </td>
            <td class="py-3 px-2 text-center font-bold text-fifa-orange">${team.points}</td>
        </tr>
        `;
    }).join('');

    saveLeagueData();
}

function updateLeagueStats() {
    const totalMatches = leagueData.matches.length;
    const maxPossibleMatches = 10; // Toplam 10 maç oynanacak
    const remainingMatches = maxPossibleMatches - totalMatches;

    document.getElementById('matchesPlayed').textContent = totalMatches;
    document.getElementById('matchesRemaining').textContent = remainingMatches;

    if (remainingMatches <= 0) {
        document.getElementById('leagueStatus').textContent = 'Tamamlandı';
        document.getElementById('leagueStatus').className = 'text-lg font-bold text-fifa-red';
        if (!leagueData.seasonCompleted) {
            checkForChampionshipFinal();
        }
    } else {
        document.getElementById('leagueStatus').textContent = 'Devam Ediyor';
        document.getElementById('leagueStatus').className = 'text-lg font-bold text-fifa-green';
    }
}

function checkChampionshipGuaranteed(teamName, teams) {
    // Don't show if season is already completed
    if (leagueData.seasonCompleted) return false;

    const team = teams.find(t => t.name === teamName);
    if (!team) return false;

    // Calculate remaining matches for this team
    const teamMatches = leagueData.matches.filter(match =>
        match.home === teamName || match.away === teamName
    );
    const remainingMatches = leagueData.maxMatches - teamMatches.length;

    // If no remaining matches, championship is not guaranteed yet
    if (remainingMatches <= 0) return false;

    // Calculate maximum possible points for this team (if they win all remaining matches)
    const maxPossiblePoints = team.points + (remainingMatches * 3);

    // Check if any other team can reach or exceed this team's max possible points
    const otherTeams = teams.filter(t => t.name !== teamName);

    for (const otherTeam of otherTeams) {
        const otherTeamMatches = leagueData.matches.filter(match =>
            match.home === otherTeam.name || match.away === otherTeam.name
        );
        const otherRemainingMatches = leagueData.maxMatches - otherTeamMatches.length;
        const otherMaxPossiblePoints = otherTeam.points + (otherRemainingMatches * 3);

        if (otherMaxPossiblePoints >= maxPossiblePoints) {
            return false;
        }
    }

    return true;
}

function generateFormChart(teamName) {
    // Get last 5 matches for this team
    const teamMatches = leagueData.matches
        .filter(match => match.home === teamName || match.away === teamName)
        .sort((a, b) => b.id - a.id)
        .slice(0, 5);

    if (teamMatches.length === 0) {
        return '<div class="w-4 h-4 bg-gray-600 rounded-sm"></div>'.repeat(5);
    }

    const formResults = teamMatches.map(match => {
        const isHome = match.home === teamName;
        let result;

        if (match.result === 'draw') {
            result = 'D';
        } else if ((match.result === 'home' && isHome) || (match.result === 'away' && !isHome)) {
            result = 'W';
        } else {
            result = 'L';
        }

        return result;
    });

    // Fill remaining slots with empty if less than 5 matches
    while (formResults.length < 5) {
        formResults.unshift('-');
    }

    return formResults.map(result => {
        switch(result) {
            case 'W':
                return '<div class="w-4 h-4 bg-fifa-green rounded-sm" title="Galibiyet"></div>';
            case 'D':
                return '<div class="w-4 h-4 bg-fifa-orange rounded-sm" title="Beraberlik"></div>';
            case 'L':
                return '<div class="w-4 h-4 bg-fifa-red rounded-sm" title="Mağlubiyet"></div>';
            default:
                return '<div class="w-4 h-4 bg-gray-600 rounded-sm" title="Henüz maç yok"></div>';
        }
    }).join('');
}

function showMatchModal() {
    // Check if there are any players with teams
    const playerTeams = [...new Set(players.map(p => p.team).filter(team => team))];

    if (playerTeams.length === 0) {
        showAlertModal('error', 'Takım Bulunamadı', 'Maç eklemek için önce oyuncular ekleyin ve takım bilgilerini girin!');
        return;
    }

    // Allow final match even if season is completed
    const isFinalMatch = leagueData.matches.length > 10;

    if (leagueData.seasonCompleted && !isFinalMatch) {
        showAlertModal('info', 'Lig Tamamlandı', 'Yeni lig başlatmak için "Ligi Sıfırla" butonunu kullanın.');
        return;
    }

    const modal = document.getElementById('matchResultModal');
    const homeSelect = document.getElementById('homeTeam');
    const awaySelect = document.getElementById('awayTeam');

    // Populate team selects from player teams
    homeSelect.innerHTML = '<option value="">Takım Seçin</option>' +
        playerTeams.map(team => `<option value="${team}">${team}</option>`).join('');
    awaySelect.innerHTML = '<option value="">Takım Seçin</option>' +
        playerTeams.map(team => `<option value="${team}">${team}</option>`).join('');

    // // Auto-select teams if available
    // if (playerTeams.includes('Galatasaray')) {
    //     homeSelect.value = 'Galatasaray';
    // }
    // if (playerTeams.includes('Beşiktaş')) {
    //     awaySelect.value = 'Beşiktaş';
    // }
 
    // Reset score inputs
    document.getElementById('homeScore').value = '0';
    document.getElementById('awayScore').value = '0';
    document.getElementById('homeHalfScore').value = '0';
    document.getElementById('awayHalfScore').value = '0';

    // Update betting odds when teams are selected
    const updateBettingOdds = () => {
        const home = homeSelect.value;
        const away = awaySelect.value;
        if (home && away && home !== away && typeof currentMatchTeams !== 'undefined') {
            currentMatchTeams.home = home;
            currentMatchTeams.away = away;
        }
    };

    homeSelect.addEventListener('change', updateBettingOdds);
    awaySelect.addEventListener('change', updateBettingOdds);

    updateBettingOdds();

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // GSAP animation
    gsap.fromTo(modal.querySelector('.transform'),
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" }
    );
}

function hideMatchModal() {
    const modal = document.getElementById('matchResultModal');

    // Reset modal to normal state
    const modalTitle = document.querySelector('#matchResultModal h2');
    modalTitle.innerHTML = 'Maç Sonucu Ekle';

    // Re-enable team selection
    document.getElementById('homeTeam').disabled = false;
    document.getElementById('awayTeam').disabled = false;

    // Remove final match info if exists
    const finalInfo = document.querySelector('#matchResultModal .bg-fifa-orange\\/20');
    if (finalInfo) {
        finalInfo.remove();
    }

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

function confirmMatchResult() {
    const homeTeam = document.getElementById('homeTeam').value;
    const awayTeam = document.getElementById('awayTeam').value;
    const homeScore = parseInt(document.getElementById('homeScore').value);
    const awayScore = parseInt(document.getElementById('awayScore').value);
    const homeHalfScore = parseInt(document.getElementById('homeHalfScore').value);
    const awayHalfScore = parseInt(document.getElementById('awayHalfScore').value);

    if (!homeTeam || !awayTeam) {
        showAlertModal('warning', 'Eksik Bilgi', 'Lütfen takımları seçin!');
        return;
    }

    if (homeTeam === awayTeam) {
        showAlertModal('error', 'Hata', 'Aynı takım seçilemez!');
        return;
    }

    // Determine result from score
    let result;
    if (homeScore > awayScore) {
        result = 'home';
    } else if (awayScore > homeScore) {
        result = 'away';
    } else {
        result = 'draw';
    }

    // Process betting coupons for this match
    if (typeof processBetsForMatch === 'function') {
        processBetsForMatch(homeTeam, awayTeam, homeScore, awayScore, homeHalfScore, awayHalfScore);
    }

    // Add match result
    const match = {
        home: homeTeam,
        away: awayTeam,
        homeScore: homeScore,
        awayScore: awayScore,
        result: result,
        id: Date.now()
    };

    leagueData.matches.push(match);

    // Initialize teams if they don't exist
    if (!leagueData.teams[homeTeam]) {
        leagueData.teams[homeTeam] = {
            name: homeTeam, played: 0, won: 0, drawn: 0, lost: 0,
            goalsFor: 0, goalsAgainst: 0, points: 0
        };
    }
    if (!leagueData.teams[awayTeam]) {
        leagueData.teams[awayTeam] = {
            name: awayTeam, played: 0, won: 0, drawn: 0, lost: 0,
            goalsFor: 0, goalsAgainst: 0, points: 0
        };
    }

    // Update team stats
    updateTeamStats(homeTeam, awayTeam, result, homeScore, awayScore);

    // Distribute bonuses based on result and goals
    distributeMatchBonuses(homeTeam, awayTeam, homeScore, awayScore, result);

    // Process debt increase after match
    processMatchDebtIncrease();

    updateLeagueStats();
    hideMatchModal();

    // Check if league is completed
    if (leagueData.matches.length >= 10 && !leagueData.seasonCompleted) {
        setTimeout(() => {
            checkForChampionshipFinal();
        }, 1000);
    } else if (leagueData.matches.length > 10 && !leagueData.seasonCompleted) {
        setTimeout(() => {
            showChampion();
        }, 1000);
    }

    // Success animation
    gsap.fromTo("#leagueTableBody",
        { scale: 0.95 },
        { scale: 1, duration: 0.5, ease: "back.out(1.7)" }
    );
}

function updateTeamStats(home, away, result, homeScore, awayScore) {
    leagueData.teams[home].played++;
    leagueData.teams[away].played++;

    // Update goals
    leagueData.teams[home].goalsFor += homeScore;
    leagueData.teams[home].goalsAgainst += awayScore;
    leagueData.teams[away].goalsFor += awayScore;
    leagueData.teams[away].goalsAgainst += homeScore;

    switch(result) {
        case 'home':
            leagueData.teams[home].won++;
            leagueData.teams[home].points += 3;
            leagueData.teams[away].lost++;
            break;
        case 'away':
            leagueData.teams[away].won++;
            leagueData.teams[away].points += 3;
            leagueData.teams[home].lost++;
            break;
        case 'draw':
            leagueData.teams[home].drawn++;
            leagueData.teams[home].points += 1;
            leagueData.teams[away].drawn++;
            leagueData.teams[away].points += 1;
            break;
    }

    saveLeagueData();
    updateLeagueTable();
}

function distributeMatchBonuses(homeTeam, awayTeam, homeScore, awayScore, result) {
    const cfg = CONFIG.LEAGUE;
    let bonusMessage = '';

    // Determine winner for victory bonus
    let winner = null;
    if (result === 'home') {
        winner = homeTeam;
    } else if (result === 'away') {
        winner = awayTeam;
    }

    // Distribute victory/draw bonus
    if (winner) {
        players.forEach(player => {
            if (player.team === winner) {
                player.balance += cfg.WIN_BONUS;
                addTransactionLog('bonus', player.fullName, cfg.WIN_BONUS, `Maç Galibiyet Primi`, '🏆');
            }
        });
        bonusMessage += `🏆 ${winner} takımına galibiyet primi: ${cfg.WIN_BONUS}₺ x ${players.filter(p => p.team === winner).length} oyuncu\n`;
    } else if (result === 'draw') {
        const homePlayers = players.filter(p => p.team === homeTeam);
        const awayPlayers = players.filter(p => p.team === awayTeam);

        homePlayers.forEach(player => {
            player.balance += cfg.DRAW_BONUS;
            addTransactionLog('bonus', player.fullName, cfg.DRAW_BONUS, `Maç Beraberlik Primi`, '🤝');
        });
        awayPlayers.forEach(player => {
            player.balance += cfg.DRAW_BONUS;
            addTransactionLog('bonus', player.fullName, cfg.DRAW_BONUS, `Maç Beraberlik Primi`, '🤝');
        });

        bonusMessage += `🤝 ${homeTeam} beraberlik primi: ${cfg.DRAW_BONUS}₺ x ${homePlayers.length} oyuncu\n`;
        bonusMessage += `🤝 ${awayTeam} beraberlik primi: ${cfg.DRAW_BONUS}₺ x ${awayPlayers.length} oyuncu\n`;
    }

    // Distribute goal bonuses
    if (homeScore > 0) {
        const homePlayers = players.filter(p => p.team === homeTeam);
        homePlayers.forEach(player => {
            const goalBonus = homeScore * cfg.GOAL_BONUS_PER_GOAL;
            player.balance += goalBonus;
            addTransactionLog('bonus', player.fullName, goalBonus, `Maç Gol Primi (${homeScore} gol x ${cfg.GOAL_BONUS_PER_GOAL}₺)`, '⚽');
        });
        bonusMessage += `⚽ ${homeTeam} gol primi: ${homeScore} gol x ${cfg.GOAL_BONUS_PER_GOAL}₺ x ${players.filter(p => p.team === homeTeam).length} oyuncu\n`;
    }

    if (awayScore > 0) {
        const awayPlayers = players.filter(p => p.team === awayTeam);
        awayPlayers.forEach(player => {
            const goalBonus = awayScore * cfg.GOAL_BONUS_PER_GOAL;
            player.balance += goalBonus;
            addTransactionLog('bonus', player.fullName, goalBonus, `Maç Gol Primi (${awayScore} gol x ${cfg.GOAL_BONUS_PER_GOAL}₺)`, '⚽');
        });
        bonusMessage += `⚽ ${awayTeam} gol primi: ${awayScore} gol x ${cfg.GOAL_BONUS_PER_GOAL}₺ x ${players.filter(p => p.team === awayTeam).length} oyuncu\n`;
    }

    savePlayers();
    updateStats();
    renderPlayers();

    if (bonusMessage) {
        setTimeout(() => {
            showAlertModal('money', 'Maç Primleri Dağıtıldı!', bonusMessage);
        }, 500);
    }
}

function checkForChampionshipFinal() {
    const teams = Object.values(leagueData.teams);
    teams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
    });

    const leader = teams[0];
    const second = teams[1];

    console.log('Final kontrolü:', {
        leader: leader.name,
        leaderPoints: leader.points,
        leaderGoalDiff: leader.goalsFor - leader.goalsAgainst,
        second: second.name,
        secondPoints: second.points,
        secondGoalDiff: second.goalsFor - second.goalsAgainst
    });

    if (leader.points === second.points) {
        const leaderGoalDiff = leader.goalsFor - leader.goalsAgainst;
        const secondGoalDiff = second.goalsFor - second.goalsAgainst;

        if (leaderGoalDiff === secondGoalDiff) {
            showChampionshipFinalModal(leader.name, second.name);
            return;
        }
    }

    showChampion();
}

function showChampionshipFinalModal(team1, team2) {
    showAlertModal('info', 'Şampiyonluk Finali',
        `${team1} ve ${team2} takımları puan ve averajda eşit!\n\nŞampiyonu belirlemek için final maçı oynanacak.\n\nFinal maçını ekleyin!`,
        () => {
            setTimeout(() => {
                showMatchModal();
                document.getElementById('homeTeam').value = team1;
                document.getElementById('awayTeam').value = team2;

                document.getElementById('homeTeam').disabled = true;
                document.getElementById('awayTeam').disabled = true;

                const modalTitle = document.querySelector('#matchResultModal h2');
                modalTitle.innerHTML = 'Şampiyonluk Finali';

                const scoreSection = document.querySelector('#matchResultModal .text-center');
                const finalInfo = document.createElement('div');
                finalInfo.className = 'mb-4 p-3 bg-fifa-orange/20 rounded-lg border border-fifa-orange/30';
                finalInfo.innerHTML = `
                    <div class="text-fifa-orange font-bold text-sm">
                        <i class="fas fa-trophy mr-2"></i>
                        ŞAMPİYONLUK FİNALİ
                    </div>
                    <div class="text-gray-300 text-xs mt-1">
                        Kazanan takım şampiyon olacak!
                    </div>
                `;
                scoreSection.parentNode.insertBefore(finalInfo, scoreSection);
            }, 500);
        }
    );
}

function showChampion() {
    // Check if season already completed to prevent duplicate rewards
    if (leagueData.seasonCompleted) {
        return;
    }

    const cfg = CONFIG.LEAGUE;

    const teams = Object.values(leagueData.teams);
    teams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
    });

    const champion = teams[0];
    const championPlayers = players.filter(p => p.team === champion.name);

    // Distribute championship bonus only to champion players
    championPlayers.forEach(player => {
        player.balance += cfg.CHAMPIONSHIP_BONUS;
        addTransactionLog('bonus', player.fullName, cfg.CHAMPIONSHIP_BONUS, 'Şampiyonluk Primi', '🏆');
    });

    // Process season end payments
    processSeasonEndPayments();

    // Mark season as completed
    leagueData.seasonCompleted = true;
    saveLeagueData();

    // Show champion
    const championDisplay = document.getElementById('championDisplay');
    championDisplay.innerHTML = `
        <div class="bg-gradient-to-r from-fifa-orange to-fifa-blue rounded-2xl p-6">
            <i class="fas fa-crown text-4xl text-yellow-400 mb-4"></i>
            <h3 class="text-2xl font-bold text-white mb-2">🏆 ŞAMPİYON 🏆</h3>
            <h2 class="text-3xl font-bold text-fifa-orange mb-4">${champion.name}</h2>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="bg-fifa-darker/50 rounded-lg p-3">
                    <div class="text-gray-400">Puan</div>
                    <div class="text-xl font-bold text-fifa-orange">${champion.points}</div>
                </div>
                <div class="bg-fifa-darker/50 rounded-lg p-3">
                    <div class="text-gray-400">Averaj</div>
                    <div class="text-xl font-bold text-fifa-green">+${champion.goalsFor - champion.goalsAgainst}</div>
                </div>
            </div>
            <p class="text-gray-300 mt-4">${champion.name} takımının oyuncularına ${cfg.CHAMPIONSHIP_BONUS}₺ şampiyonluk primi verildi!</p>
        </div>
    `;

    championDisplay.classList.remove('hidden');

    // GSAP animation
    gsap.fromTo(championDisplay,
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.7)" }
    );
}

function resetLeague() {
    showAlertModal('warning', 'Ligi Sıfırla', 'Ligi sıfırlamak istediğinizden emin misiniz? Tüm maç sonuçları silinecek.');

    window.confirmResetLeague = function() {
        leagueData = {
            teams: {},
            matches: [],
            maxMatches: CONFIG.LEAGUE.MAX_MATCHES_PER_TEAM,
            seasonCompleted: false
        };

        // Increment season number
        currentSeason++;
        localStorage.setItem('fifaCurrentSeason', JSON.stringify(currentSeason));

        localStorage.setItem('fifaLeague', JSON.stringify(leagueData));

        initializeLeague();
        updateLeagueTable();
        updateLeagueStats();

        const championDisplay = document.getElementById('championDisplay');
        championDisplay.classList.add('hidden');

        setTimeout(() => {
            const confirmBtn = document.querySelector('#alertModal .bg-fifa-green');
            if (confirmBtn) {
                confirmBtn.removeEventListener('click', window.confirmResetLeague);
                confirmBtn.remove();
            }

            const cancelBtn = document.querySelector('#alertModal .bg-gray-600');
            if (cancelBtn) {
                cancelBtn.style.display = 'block';
            }
        }, 100);

        hideAlertModal();
    };

    window.currentAlertCallback = window.confirmResetLeague;
}

// Helper functions
function addToScore(scoreId, value) {
    const scoreInput = document.getElementById(scoreId);
    scoreInput.value = value;

    event.target.style.transform = 'scale(0.95)';
    setTimeout(() => {
        event.target.style.transform = 'scale(1)';
    }, 150);
}

// Make functions globally available
window.showMatchModal = showMatchModal;
window.hideMatchModal = hideMatchModal;
window.confirmMatchResult = confirmMatchResult;
window.updateLeagueTable = updateLeagueTable;
window.updateLeagueStats = updateLeagueStats;
window.initializeLeague = initializeLeague;
window.resetLeague = resetLeague;
window.addToScore = addToScore;
