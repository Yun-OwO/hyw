// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    parent: "game-container",
    width: lib.resolution.width,
    height: lib.resolution.height,
    backgroundColor: "#000000",
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: "game-container",
        autoRound: true
    },
    render: {
        pixelArt: true,
        antialias: false
    },
    resolution: devicePixelRatio
};

let game = new Phaser.Game(config);
let timer = 0;
let DB = {
    sprites: [],
    isDragging: false,
    dragStartPos: { x: 0, y: 0 },
    draggingHandIndex: null,
    draggingUnit: null,
    dragOrigin: null,
    gridSize: 144,
    gridCols: 16,
    gridRows: 6,
    worldWidth: 0,
    worldHeight: 0,
    gridOffsetX: 0,
    gridOffsetY: 0,
    currentScene: null,
    gameCanvas: null,
    gameWidth: 0,
    gameHeight: 0,
    dragPreview: null,
    pinchPointers: {},
    pinchStartDistance: null,
    pinchStartZoom: 1,
    minZoom: 0.8,
    maxZoom: 2.4
};

const GamePhase = {
    IDLE: "IDLE",
    PREP: "PREP",
    BATTLE: "BATTLE",
    RESOLVE: "RESOLVE",
    GAMEOVER: "GAMEOVER"
};

const state = {
    phase: GamePhase.IDLE,
    round: 1,
    gold: 5,
    dp: 3,
    hp: 10,
    shopLevel: 1,
    shopItems: [],
    hand: [],
    selectedHandIndex: null,
    deployed: [],
    currentStrategy: null,
    battleData: {
        waveIndex: 0,
        activeEnemies: [],
        slowMultiplier: 1,
        atkMultiplier: 1
    },
    pendingEquips: []
};

const ui = {
    gold: null,
    dp: null,
    hp: null,
    round: null,
    phaseButton: null,
    shopBody: null,
    shopNote: null,
    shopRefresh: null,
    shopUpgrade: null,
    handPanel: null,
    covenantBar: null,
    strategyPanel: null,
    strategyOptions: null,
    resultPanel: null,
    resultText: null,
    resultButton: null,
    shopPanel: null
};

function getOperatorDef(id, tier = 1) {
    const base = lib.config.operators.find(op => op.id === id && op.tier === 1);
    if (!base) {
        return null;
    }
    if (tier === 1) {
        return { ...base };
    }
    return {
        ...base,
        tier: 2,
        name: `${base.name} Elite`,
        atk: Math.round(base.atk * 1.45),
        def: Math.round(base.def * 1.35),
        hp: Math.round(base.hp * 1.5),
        atkSpd: Math.max(700, Math.round(base.atkSpd * 0.85)),
        costGold: Math.round(base.costGold * 2.4),
        costDP: Math.max(2, Math.round(base.costDP * 1.2))
    };
}

function getShopItem(id) {
    const operator = lib.config.operators.find(op => op.id === id);
    if (operator) {
        return { ...operator, type: "operator" };
    }
    const equip = lib.config.equips.find(item => item.id === id);
    if (equip) {
        return { ...equip };
    }
    const spell = lib.config.spells.find(item => item.id === id);
    if (spell) {
        return { ...spell };
    }
    return null;
}

function getCellCenter(col, row) {
    return {
        x: DB.gridOffsetX + col * DB.gridSize + DB.gridSize / 2,
        y: DB.gridOffsetY + row * DB.gridSize + DB.gridSize / 2
    };
}

function setPhase(newPhase) {
    state.phase = newPhase;
    updatePhaseUI();
}

function buildStatusText() {
    if (!ui.gold || !ui.dp || !ui.hp || !ui.round) {
        return;
    }
    ui.gold.textContent = `★ ${state.gold}`;
    ui.dp.textContent = `DP ${state.dp}`;
    ui.hp.textContent = `❤ ${state.hp}`;
    ui.round.textContent = `第${state.round}波`;
}

function updatePhaseUI() {
    if (!ui.phaseButton || !ui.shopPanel) {
        return;
    }
    ui.phaseButton.disabled = false;
    switch (state.phase) {
        case GamePhase.PREP:
            ui.phaseButton.textContent = "开始战斗";
            ui.phaseButton.disabled = state.deployed.length === 0;
            ui.shopPanel.setAttribute("aria-hidden", "false");
            break;
        case GamePhase.BATTLE:
            ui.phaseButton.textContent = "战斗中";
            ui.phaseButton.disabled = true;
            ui.shopPanel.setAttribute("aria-hidden", "true");
            break;
        case GamePhase.RESOLVE:
            ui.phaseButton.textContent = "结算中";
            ui.phaseButton.disabled = true;
            break;
        case GamePhase.GAMEOVER:
            ui.phaseButton.textContent = "重新开始";
            ui.phaseButton.disabled = false;
            ui.shopPanel.setAttribute("aria-hidden", "true");
            break;
        default:
            ui.phaseButton.textContent = "准备";
            ui.phaseButton.disabled = true;
            ui.shopPanel.setAttribute("aria-hidden", "true");
            break;
    }
}

function seedRandom(seed) {
    let x = seed || Date.now();
    return function () {
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        return Math.abs(x) / 0x7fffffff;
    };
}

function genShopItems(shopLevel, rngSeed = Date.now()) {
    const pool = lib.config.shopPools[shopLevel] || lib.config.shopPools[1];
    const random = seedRandom(rngSeed + state.round * 31 + state.gold);
    const items = [];
    const available = [...pool];
    while (items.length < 4 && available.length) {
        const index = Math.floor(random() * available.length);
        items.push(getShopItem(available.splice(index, 1)[0]));
    }
    return items;
}

function renderShop() {
    ui.shopBody.innerHTML = "";
    state.shopItems.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "shop-item";
        const header = document.createElement("div");
        header.className = "item-header";
        header.innerHTML = `<span>${item.name}</span><span class="item-type">${item.type === "operator" ? `阶${item.tier}` : item.type === "equip" ? "装备" : "法术"}</span>`;
        const desc = document.createElement("div");
        desc.className = "item-desc";
        desc.textContent = item.desc || `${item.costDP} DP / ${item.costGold}★`;
        const button = document.createElement("button");
        button.textContent = `购买 ${item.costGold}★`;
        button.addEventListener("click", () => buyShopItem(index));
        card.appendChild(header);
        card.appendChild(desc);
        card.appendChild(button);
        ui.shopBody.appendChild(card);
    });
    ui.shopNote.textContent = `调度中心 等级 ${state.shopLevel}，每轮刷新`;
}

function renderHand() {
    ui.handPanel.innerHTML = "";
    state.hand.forEach((card, index) => {
        const item = document.createElement("div");
        item.className = `hand-card${index === state.selectedHandIndex ? " selected" : ""}`;
        item.innerHTML = `<div><strong>${card.name}</strong></div>
            <div class="label">★ ${card.costGold || card.costDP}</div>
            <div class="label">${card.faction || card.type.toUpperCase()}</div>
            <div class="label">${card.type === "operator" ? `阶${card.tier}` : card.type === "equip" ? "装备" : "法术"}</div>`;
        item.style.touchAction = "none";
        item.addEventListener("pointerdown", event => {
            event.preventDefault();
            event.stopPropagation();
            if (!state.phase || state.phase !== GamePhase.PREP) {
                return;
            }
            startHandDrag(index, card);
        });
        ui.handPanel.appendChild(item);
    });
    const promotion = checkPromotionCandidates();
    if (promotion) {
        const tip = document.createElement("div");
        tip.className = "hand-card";
        tip.innerHTML = `<div><strong>可晋升</strong></div><div class="item-desc">${promotion.name} 可晋升</div><button id="promote-button">晋升</button>`;
        ui.handPanel.appendChild(tip);
        tip.querySelector("#promote-button").addEventListener("click", promoteOperator);
    }
}

function renderCovenant() {
    const counts = state.deployed.reduce((map, unit) => {
        map[unit.faction] = (map[unit.faction] || 0) + 1;
        return map;
    }, {});
    const lines = Object.keys(counts).map(faction => {
        const count = counts[faction];
        const need = lib.config.covenantThreshold;
        const active = count >= need;
        return `${faction} ${count}/${need} ${active ? "Active" : "Inactive"}`;
    });
    ui.covenantBar.textContent = lines.length ? `Covenant: ${lines.join(" | ")}` : "Covenant: None";
}

function ensureDragPreview() {
    if (!DB.dragPreview) {
        const preview = document.createElement("div");
        preview.id = "drag-preview";
        preview.className = "drag-preview";
        preview.style.position = "fixed";
        preview.style.pointerEvents = "none";
        preview.style.display = "none";
        preview.style.zIndex = "40";
        preview.style.padding = "10px 14px";
        preview.style.borderRadius = "14px";
        preview.style.background = "rgba(10, 18, 45, 0.9)";
        preview.style.color = "#fff";
        preview.style.fontSize = "13px";
        preview.style.boxShadow = "0 12px 28px rgba(0,0,0,0.28)";
        document.body.appendChild(preview);
        DB.dragPreview = preview;
    }
    return DB.dragPreview;
}

function startHandDrag(index, card) {
    state.selectedHandIndex = index;
    DB.draggingHandIndex = index;
    DB.isDragging = true;
    const preview = ensureDragPreview();
    preview.textContent = card.name;
    preview.style.display = "flex";
    preview.style.left = "0px";
    preview.style.top = "0px";
    renderHand();
}

function updateDragPreview(clientX, clientY) {
    if (!DB.isDragging || !DB.dragPreview) {
        return;
    }
    DB.dragPreview.style.left = `${clientX + 14}px`;
    DB.dragPreview.style.top = `${clientY + 14}px`;
}

function stopDrag(event) {
    if (!DB.isDragging) {
        return;
    }
    DB.isDragging = false;
    if (DB.dragPreview) {
        DB.dragPreview.style.display = "none";
    }
    const canvas = DB.gameCanvas || document.querySelector("#game-container canvas");
    if (!canvas || !DB.currentScene) {
        if (DB.draggingUnit) {
            snapUnitToOrigin(DB.draggingUnit);
        }
        DB.draggingUnit = null;
        DB.draggingHandIndex = null;
        renderHand();
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (DB.gameWidth / rect.width);
    const y = (event.clientY - rect.top) * (DB.gameHeight / rect.height);
    const col = Math.floor((x - DB.gridOffsetX) / DB.gridSize);
    const row = Math.floor((y - DB.gridOffsetY) / DB.gridSize);
    if (DB.draggingHandIndex !== null) {
        const card = state.hand[DB.draggingHandIndex];
        if (card) {
            if (col >= 0 && col < DB.gridCols && row >= 0 && row < DB.gridRows) {
                const occupiedBy = state.deployed.find(unit => unit.col === col && unit.row === row);
                if (card.type === "equip" && occupiedBy) {
                    applyEquipToUnit(occupiedBy, card);
                    state.hand.splice(DB.draggingHandIndex, 1);
                } else if (card.type === "operator" && !occupiedBy) {
                    deploySelectedUnit(col, row, DB.currentScene);
                }
            }
        }
        state.selectedHandIndex = null;
        renderHand();
    } else if (DB.draggingUnit) {
        if (col >= 0 && col < DB.gridCols && row >= 0 && row < DB.gridRows) {
            const occupiedBy = state.deployed.find(unit => unit.col === col && unit.row === row && unit !== DB.draggingUnit);
            if (!occupiedBy) {
                DB.draggingUnit.col = col;
                DB.draggingUnit.row = row;
                const center = getCellCenter(col, row);
                DB.draggingUnit.sprite.setPosition(center.x, center.y);
                if (DB.draggingUnit.sprite.rangeGraphics) {
                    drawRangeForSprite(DB.draggingUnit.sprite);
                }
            } else {
                snapUnitToOrigin(DB.draggingUnit);
            }
        } else {
            snapUnitToOrigin(DB.draggingUnit);
        }
        DB.draggingUnit.sprite.setAlpha(1);
        DB.draggingUnit = null;
    }
}

function startUnitMove(unit, pointer) {
    if (!unit || !unit.sprite) {
        return;
    }
    DB.isDragging = true;
    DB.draggingUnit = unit;
    DB.dragOrigin = { col: unit.col, row: unit.row };
    unit.sprite.setAlpha(0.6);
    showUnitInfo(unit);
    updateDraggedUnit(pointer.clientX, pointer.clientY);
}

function updateDraggedUnit(clientX, clientY) {
    if (!DB.draggingUnit || !DB.draggingUnit.sprite) {
        return;
    }
    const canvas = DB.gameCanvas || document.querySelector("#game-container canvas");
    if (!canvas) {
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (DB.gameWidth / rect.width);
    const y = (clientY - rect.top) * (DB.gameHeight / rect.height);
    DB.draggingUnit.sprite.setPosition(x, y);
    if (DB.draggingUnit.sprite.rangeGraphics) {
        drawRangeForSprite(DB.draggingUnit.sprite);
    }
}

function snapUnitToOrigin(unit) {
    if (!unit || !unit.sprite) {
        return;
    }
    const center = getCellCenter(unit.col, unit.row);
    unit.sprite.setPosition(center.x, center.y);
    if (unit.sprite.rangeGraphics) {
        drawRangeForSprite(unit.sprite);
    }
}

function applyEquipToUnit(unit, equip) {
    if (!unit || !equip) {
        return;
    }
    if (equip.effect.atkMultiplier) {
        unit.atk = Math.round(unit.atk * equip.effect.atkMultiplier);
    }
    if (equip.effect.rangeBonus) {
        unit.range += equip.effect.rangeBonus;
    }
    unit.equips = unit.equips || [];
    unit.equips.push(equip.name);
    showUnitInfo(unit);
    ui.shopNote.textContent = `已将装备应用至 ${unit.name}`;
}

function showUnitInfo(unit) {
    if (!ui.unitInfo) {
        return;
    }
    if (!unit) {
        ui.unitInfo.textContent = "请选择已部署干员以查看属性。";
        return;
    }
    ui.unitInfo.textContent = `${unit.name} · ⚔${unit.atk}  ❤${unit.hp}/${unit.maxHp}  射程${unit.range}${unit.equips && unit.equips.length ? ` · 装:${unit.equips.join(",")}` : ""}`;
}

function checkPromotionCandidates() {
    const counts = {};
    state.hand.forEach(card => {
        if (card.type === "operator" && card.tier === 1) {
            counts[card.id] = (counts[card.id] || 0) + 1;
        }
    });
    const promoId = Object.keys(counts).find(id => counts[id] >= 3);
    if (promoId) {
        return getOperatorDef(promoId, 2);
    }
    return null;
}

function promoteOperator() {
    const promoCandidate = checkPromotionCandidates();
    if (!promoCandidate) {
        return;
    }
    let removed = 0;
    state.hand = state.hand.filter(card => {
        if (removed < 3 && card.type === "operator" && card.id === promoCandidate.id && card.tier === 1) {
            removed += 1;
            return false;
        }
        return true;
    });
    state.hand.push({ ...promoCandidate, type: "operator" });
    state.selectedHandIndex = state.hand.length - 1;
    renderHand();
    buildStatusText();
}

function buyShopItem(index) {
    const item = state.shopItems[index];
    if (!item || state.gold < item.costGold) {
        return;
    }
    state.gold -= item.costGold;
    if (item.type === "operator" || item.type === "equip") {
        state.hand.push({ ...item });
    } else if (item.type === "spell") {
        applySpell(item);
    }
    state.shopItems.splice(index, 1);
    renderShop();
    renderHand();
    buildStatusText();
}

function applySpell(item) {
    if (item.id === "spell_slow") {
        state.battleData.slowMultiplier = 0.8;
        ui.shopNote.textContent = "法术生效：敌人移速降低20%";
    }
    if (item.id === "spell_heal") {
        state.deployed.forEach(unit => {
            unit.hp = Math.min(unit.maxHp, unit.hp + Math.round(unit.maxHp * item.effect.healPercent));
        });
        ui.shopNote.textContent = "法术生效：为已部署干员恢复生命";
    }
}

function refreshShop() {
    if (state.gold < 2) {
        return;
    }
    state.gold -= 2;
    state.shopItems = genShopItems(state.shopLevel);
    renderShop();
    buildStatusText();
}

function upgradeShop() {
    if (state.shopLevel >= 3 || state.gold < 5) {
        return;
    }
    state.gold -= 5;
    state.shopLevel += 1;
    state.shopItems = genShopItems(state.shopLevel);
    renderShop();
    buildStatusText();
}

function initUI(scene) {
    ui.gold = document.getElementById("gold-value");
    ui.dp = document.getElementById("dp-value");
    ui.hp = document.getElementById("hp-value");
    ui.round = document.getElementById("round-value");
    ui.phaseButton = document.getElementById("phase-button");
    ui.shopBody = document.getElementById("shop-body");
    ui.shopNote = document.getElementById("shop-note");
    ui.shopRefresh = document.getElementById("shop-refresh");
    ui.shopUpgrade = document.getElementById("shop-upgrade");
    ui.handPanel = document.getElementById("hand-panel");
    ui.unitInfo = document.getElementById("unit-info");
    ui.covenantBar = document.getElementById("covenant-bar");
    ui.shopPanel = document.getElementById("shop-panel");
    ui.strategyPanel = document.getElementById("strategy-panel") || document.querySelector("#strategy-panel");
    ui.strategyOptions = document.getElementById("strategy-options");
    ui.resultPanel = document.getElementById("result-panel");
    ui.resultText = document.getElementById("result-text");
    ui.resultButton = document.getElementById("result-button");

    ui.phaseButton.addEventListener("click", () => {
        if (state.phase === GamePhase.PREP) {
            if (state.deployed.length === 0) {
                return;
            }
            enterBattle(scene);
        } else if (state.phase === GamePhase.GAMEOVER) {
            resetGame();
        }
    });
    ui.shopRefresh.addEventListener("click", refreshShop);
    ui.shopUpgrade.addEventListener("click", upgradeShop);
    ui.resultButton.addEventListener("click", () => {
        if (state.phase === GamePhase.RESOLVE) {
            hideResult();
            enterPrep();
        } else if (state.phase === GamePhase.GAMEOVER) {
            resetGame();
        }
    });

    const shopToggle = document.getElementById("shop-toggle");
    const shopClose = document.getElementById("shop-close");
    if (shopToggle) {
        shopToggle.addEventListener("click", event => {
            event.stopPropagation();
            const isVisible = ui.shopPanel.classList.toggle("visible");
            ui.shopPanel.setAttribute("aria-hidden", isVisible ? "false" : "true");
        });
    }
    if (shopClose) {
        shopClose.addEventListener("click", event => {
            event.stopPropagation();
            ui.shopPanel.classList.remove("visible");
            ui.shopPanel.setAttribute("aria-hidden", "true");
        });
    }
    document.addEventListener("click", event => {
        if (!ui.shopPanel.classList.contains("visible")) {
            return;
        }
        if (ui.shopPanel.contains(event.target) || (shopToggle && shopToggle.contains(event.target))) {
            return;
        }
        ui.shopPanel.classList.remove("visible");
        ui.shopPanel.setAttribute("aria-hidden", "true");
    });

    document.addEventListener("pointermove", event => {
        if (DB.isDragging) {
            updateDragPreview(event.clientX, event.clientY);
            if (DB.draggingUnit) {
                updateDraggedUnit(event.clientX, event.clientY);
            }
        }
    });
    document.addEventListener("pointerup", stopDrag);

    ui.strategyOptions.innerHTML = "";
    lib.config.strategies.forEach(strategy => {
        const card = document.createElement("div");
        card.className = "strategy-card";
        const desc = typeof strategy.desc === "string" ? strategy.desc.replace(/^PREP\s*/i, "") : "";
        card.innerHTML = `<div><strong>${strategy.name}</strong></div><div class="desc">${desc}</div>`;
        card.addEventListener("click", () => selectStrategy(strategy.id));
        ui.strategyOptions.appendChild(card);
    });
}

function openStrategyPanel() {
    if (!ui.strategyPanel) {
        console.warn("Strategy panel element not found.");
        return;
    }
    ui.strategyPanel.classList.add("visible");
    ui.strategyPanel.setAttribute("aria-hidden", "false");
}

function closeStrategyPanel() {
    if (!ui.strategyPanel) {
        return;
    }
    ui.strategyPanel.classList.remove("visible");
    ui.strategyPanel.setAttribute("aria-hidden", "true");
}

function selectStrategy(id) {
    const strategy = lib.config.strategies.find(item => item.id === id);
    if (!strategy) {
        return;
    }
    state.currentStrategy = strategy;
    closeStrategyPanel();
    enterPrep();
}

function enterPrep() {
    setPhase(GamePhase.PREP);
    const strategy = state.currentStrategy || {};
    state.gold += strategy.bonusGold || 0;
    state.dp = 4 + (strategy.bonusDP || 0);
    state.battleData.slowMultiplier = 1;
    state.battleData.atkMultiplier = strategy.unitAtkMultiplier || 1;
    state.shopItems = genShopItems(state.shopLevel);
    renderShop();
    renderHand();
    buildStatusText();
    renderCovenant();
}

function enterBattle(scene) {
    setPhase(GamePhase.BATTLE);
    ui.shopPanel.setAttribute("aria-hidden", "true");
    state.battleData.waveIndex = 0;
    state.battleData.activeEnemies = [];
    state.battleData.slowMultiplier = state.battleData.slowMultiplier || 1;
    state.battleData.atkMultiplier = state.battleData.atkMultiplier || 1;
    spawnRoundWaves(scene);
}

function enterResolve() {
    const finishedRound = state.round;
    setPhase(GamePhase.RESOLVE);
    let reward = Math.max(3, finishedRound + 1);
    state.gold += reward;
    renderResult(`第${finishedRound}波结束，获得 ${reward}★。`);
}

function enterGameOver(message) {
    setPhase(GamePhase.GAMEOVER);
    renderResult(message);
}

function renderResult(text) {
    ui.resultText.textContent = text;
    ui.resultButton.textContent = state.phase === GamePhase.GAMEOVER ? "重新开始" : "下一回合";
    ui.resultPanel.classList.add("visible");
    ui.resultPanel.setAttribute("aria-hidden", "false");
    buildStatusText();
}

function hideResult() {
    ui.resultPanel.classList.remove("visible");
    ui.resultPanel.setAttribute("aria-hidden", "true");
}

function resetGame() {
    cleanupBattle();
    state.phase = GamePhase.IDLE;
    state.round = 1;
    state.gold = 5;
    state.dp = 3;
    state.hp = 10;
    state.shopLevel = 1;
    state.shopItems = [];
    state.hand = [];
    state.selectedHandIndex = null;
    state.deployed = [];
    state.currentStrategy = null;
    state.battleData = {
        waveIndex: 0,
        activeEnemies: [],
        slowMultiplier: 1,
        atkMultiplier: 1
    };
    state.pendingEquips = [];
    ui.handPanel.innerHTML = "";
    ui.shopBody.innerHTML = "";
    updatePhaseUI();
    hideResult();
    openStrategyPanel();
    buildStatusText();
}

function cleanupBattle() {
    state.deployed.forEach(unit => {
        if (unit.sprite) {
            unit.sprite.destroy();
        }
    });
    state.deployed = [];
    state.battleData.activeEnemies.forEach(enemy => {
        if (enemy.sprite) {
            enemy.sprite.destroy();
        }
    });
    state.battleData.activeEnemies = [];
    DB.sprites.forEach(sprite => {
        if (sprite && sprite.destroy) {
            sprite.destroy();
        }
    });
    DB.sprites = [];
}

function spawnRoundWaves(scene) {
    const roundIndex = Math.min(state.round - 1, lib.config.waves.length - 1);
    const waves = lib.config.waves[roundIndex] || [];
    waves.forEach((wave, index) => {
        scene.time.addEvent({
            delay: 1400 * index,
            callback: () => spawnWave(scene, wave)
        });
    });
}

function spawnWave(scene, wave) {
    wave.forEach(group => {
        for (let i = 0; i < group.count; i += 1) {
            scene.time.addEvent({
                delay: 220 * i,
                callback: () => spawnEnemy(scene, group.type)
            });
        }
    });
    state.battleData.waveIndex += 1;
}

function ensureEnemyTexture(scene, def) {
    const key = `enemy_${def.id}`;
    if (scene.textures.exists(key)) {
        return key;
    }
    const size = Math.max(96, Math.round(DB.gridSize * 0.9));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#111d33";
    ctx.fillRect(0, 0, size, size);
    jdenticon.drawIcon(ctx, def.name, size);
    scene.textures.addCanvas(key, canvas);
    return key;
}

function spawnEnemy(scene, typeId) {
    const def = lib.config.enemyDefs[typeId];
    if (!def) {
        return;
    }
    const start = getCellCenter(lib.config.route[0].x, lib.config.route[0].y);
    const textureKey = ensureEnemyTexture(scene, def);
    const enemySprite = scene.add.image(start.x, start.y, textureKey);
    enemySprite.setDisplaySize(DB.gridSize * 0.9, DB.gridSize * 0.9);
    enemySprite.setDepth(2);
    const enemy = {
        id: def.id,
        name: def.name,
        hp: def.hp,
        maxHp: def.hp,
        atk: def.atk,
        speed: def.speed,
        reward: def.reward,
        sprite: enemySprite,
        routeIndex: 0
    };
    state.battleData.activeEnemies.push(enemy);
    moveEnemyAlongPath(scene, enemy);
}

function moveEnemyAlongPath(scene, enemy) {
    const route = lib.config.route;
    const nextIndex = enemy.routeIndex + 1;
    if (nextIndex >= route.length) {
        return;
    }
    const next = getCellCenter(route[nextIndex].x, route[nextIndex].y);
    const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, next.x, next.y);
    const duration = Math.max(200, distance / (enemy.speed * (state.battleData.slowMultiplier || 1)) * 1000);
    scene.tweens.add({
        targets: enemy.sprite,
        x: next.x,
        y: next.y,
        duration,
        ease: "Linear",
        onComplete: () => {
            enemy.routeIndex = nextIndex;
            if (enemy.routeIndex >= route.length - 1) {
                damagePlayer(1);
                removeEnemy(enemy);
            } else {
                moveEnemyAlongPath(scene, enemy);
            }
        }
    });
}

function removeEnemy(enemy) {
    if (enemy.sprite) {
        enemy.sprite.destroy();
    }
    state.battleData.activeEnemies = state.battleData.activeEnemies.filter(item => item !== enemy);
}

function damagePlayer(amount) {
    state.hp -= amount;
    buildStatusText();
    if (state.hp <= 0) {
        enterGameOver("前线溃败，任务失败。");
    }
}

function attackEnemies(delta) {
    state.deployed.forEach(unit => {
        unit.cooldown -= delta;
        if (unit.cooldown > 0) {
            return;
        }
        const target = state.battleData.activeEnemies.find(enemy => {
            const enemyCol = Math.floor((enemy.sprite.x - DB.gridOffsetX) / DB.gridSize);
            const enemyRow = Math.floor((enemy.sprite.y - DB.gridOffsetY) / DB.gridSize);
            const dx = Math.abs(enemyCol - unit.col);
            const dy = Math.abs(enemyRow - unit.row);
            return dx + dy <= unit.range;
        });
        if (!target) {
            return;
        }
        unit.cooldown = unit.atkSpd;
        target.hp -= Math.round(unit.atk * (state.battleData.atkMultiplier || 1));
        if (target.hp <= 0) {
            state.gold += target.reward;
            buildStatusText();
            removeEnemy(target);
        }
    });
}

function updateBattleEnd() {
    const roundIndex = Math.min(state.round - 1, lib.config.waves.length - 1);
    const waves = lib.config.waves[roundIndex] || [];
    const totalWaveCount = waves.length;
    if (state.battleData.waveIndex >= totalWaveCount && state.battleData.activeEnemies.length === 0) {
        const finishedRound = state.round;
        state.round += 1;
        if (finishedRound >= lib.config.maxRounds) {
            enterGameOver("胜利！你守住了最后一波。");
        } else {
            enterResolve();
        }
    }
}

function deploySelectedUnit(col, row, scene) {
    const card = state.hand[state.selectedHandIndex];
    if (!card || card.type !== "operator") {
        return;
    }
    const already = state.deployed.some(unit => unit.col === col && unit.row === row);
    if (already) {
        return;
    }
    if (state.dp < card.costDP) {
        return;
    }
    state.dp -= card.costDP;
    const center = getCellCenter(col, row);
    const sprite = scene.physics.add.sprite(center.x, center.y, card.id);
    sprite.setDisplaySize(DB.gridSize * 0.9, DB.gridSize * 0.9);
    sprite.setDepth(2);
    createRangeGraphics(scene, sprite);
    DB.sprites.push(sprite);
    let unit = {
        id: card.id,
        name: card.name,
        tier: card.tier,
        costDP: card.costDP,
        atk: card.atk,
        range: card.range,
        atkSpd: card.atkSpd,
        hp: card.hp,
        maxHp: card.hp,
        def: card.def,
        faction: card.faction,
        col,
        row,
        cooldown: card.atkSpd,
        sprite,
        equips: []
    };
    state.deployed.push(unit);
    state.hand.splice(state.selectedHandIndex, 1);
    state.selectedHandIndex = null;
    renderHand();
    buildStatusText();
    renderCovenant();
}

function initCamera(scene) {
    const camera = scene.cameras.main;
    camera.setBounds(DB.gridOffsetX, DB.gridOffsetY, DB.worldWidth, DB.worldHeight);
    camera.setZoom(1);
}

function setupGridInput(scene) {
    const canvas = DB.gameCanvas || scene.sys.game.canvas;
    if (canvas) {
        canvas.style.touchAction = "none";
        canvas.addEventListener("pointerdown", handleCanvasPointerDown);
        canvas.addEventListener("pointermove", handleCanvasPointerMove);
        canvas.addEventListener("pointerup", handleCanvasPointerUp);
        canvas.addEventListener("pointercancel", handleCanvasPointerUp);
    }

    scene.input.on("pointerdown", pointer => {
        if (state.phase !== GamePhase.PREP) {
            return;
        }
        if (Object.keys(DB.pinchPointers).length >= 2) {
            return;
        }
        if (DB.isDragging) {
            return;
        }
        const x = pointer.x;
        const y = pointer.y;
        const clickedUnit = state.deployed.find(unit => {
            const bounds = unit.sprite.getBounds();
            return bounds.contains(x, y);
        });
        if (clickedUnit) {
            startUnitMove(clickedUnit, pointer);
            return;
        }
        const col = Math.floor((x - DB.gridOffsetX) / DB.gridSize);
        const row = Math.floor((y - DB.gridOffsetY) / DB.gridSize);
        if (col < 0 || col >= DB.gridCols || row < 0 || row >= DB.gridRows) {
            return;
        }
        const selectedCard = state.hand[state.selectedHandIndex];
        if (selectedCard && selectedCard.type === "operator") {
            deploySelectedUnit(col, row, scene);
        }
    });
}

function handleCanvasPointerDown(event) {
    if (event.pointerType !== "touch") {
        return;
    }
    DB.pinchPointers[event.pointerId] = { x: event.clientX, y: event.clientY };
    if (Object.keys(DB.pinchPointers).length === 2) {
        const points = Object.values(DB.pinchPointers);
        DB.pinchStartDistance = getDistance(points[0], points[1]);
        DB.pinchStartZoom = DB.currentScene.cameras.main.zoom;
    }
}

function handleCanvasPointerMove(event) {
    if (event.pointerType !== "touch") {
        return;
    }
    if (!(event.pointerId in DB.pinchPointers)) {
        return;
    }
    DB.pinchPointers[event.pointerId] = { x: event.clientX, y: event.clientY };
    if (Object.keys(DB.pinchPointers).length === 2) {
        updatePinchZoom();
    }
}

function handleCanvasPointerUp(event) {
    if (event.pointerType !== "touch") {
        return;
    }
    delete DB.pinchPointers[event.pointerId];
    if (Object.keys(DB.pinchPointers).length < 2) {
        DB.pinchStartDistance = null;
    }
}

function updatePinchZoom() {
    const pointers = Object.values(DB.pinchPointers);
    if (pointers.length !== 2 || DB.pinchStartDistance == null) {
        return;
    }
    const distance = getDistance(pointers[0], pointers[1]);
    const ratio = distance / DB.pinchStartDistance;
    const camera = DB.currentScene.cameras.main;
    const newZoom = Phaser.Math.Clamp(DB.pinchStartZoom * ratio, DB.minZoom, DB.maxZoom);
    camera.setZoom(newZoom);
}

function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function preload() {
    let loadingText = this.add.text(
        this.sys.game.config.width / 2,
        this.sys.game.config.height / 2 - 50,
        "生成头像中...",
        {
            fontSize: "24px",
            fill: "#ffffff",
            fontFamily: "Noto Sans SC, Microsoft YaHei, Arial, sans-serif"
        }
    );
    loadingText.setOrigin(0.5);

    let progressBar = this.add.graphics();
    let progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(
        this.sys.game.config.width / 2 - 160,
        this.sys.game.config.height / 2,
        320,
        30
    );

    const ops = Object.keys(lib.opList);
    const total = ops.length;
    let processed = 0;

    const updateProgress = () => {
        processed++;
        const value = processed / total;
        progressBar.clear();
        progressBar.fillStyle(0xffffff, 1);
        progressBar.fillRect(
            this.sys.game.config.width / 2 - 150,
            this.sys.game.config.height / 2 + 5,
            300 * value,
            20
        );
        loadingText.setText(`加载中... ${Math.floor(value * 100)}%`);
        if (processed >= total) {
            setTimeout(() => {
                progressBar.destroy();
                progressBox.destroy();
                loadingText.destroy();
                this.load.emit("complete");
                document.getElementById("dark").style.opacity = 0;
            }, 0);
        }
    };

    ops.forEach(key => {
        const op = lib.opList[key];
        const canvas = document.createElement("canvas");
        canvas.width = 144;
        canvas.height = 144;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        jdenticon.drawIcon(ctx, op.name, 144);
        const colorThief = new ColorThief();
        op.color = colorThief.getColor(canvas, 8);
        this.textures.addCanvas(key, canvas);
        updateProgress();
    });
}

function drawGridLines(scene) {
    const graphics = scene.add.graphics();
    graphics.lineStyle(4, 0xffffff, 0.7);
    for (let col = 0; col <= DB.gridCols; col++) {
        const x = DB.gridOffsetX + col * DB.gridSize;
        graphics.beginPath();
        graphics.moveTo(x, DB.gridOffsetY);
        graphics.lineTo(x, DB.gridOffsetY + DB.worldHeight);
        graphics.strokePath();
    }
    for (let row = 0; row <= DB.gridRows; row++) {
        const y = DB.gridOffsetY + row * DB.gridSize;
        graphics.beginPath();
        graphics.moveTo(DB.gridOffsetX, y);
        graphics.lineTo(DB.gridOffsetX + DB.worldWidth, y);
        graphics.strokePath();
    }
    graphics.lineStyle(4, 0xffffff, 1);
    graphics.strokeRect(
        DB.gridOffsetX,
        DB.gridOffsetY,
        DB.worldWidth,
        DB.worldHeight
    );
    graphics.setDepth(-1);
    return graphics;
}

function rgbArrayToHex(rgb) {
    if (!Array.isArray(rgb) || rgb.length < 3) {
        return 0xffffff;
    }
    return Phaser.Display.Color.GetColor(rgb[0], rgb[1], rgb[2]);
}

function drawRangeForSprite(sprite) {
    if (!sprite || !sprite.rangeGraphics) {
        return;
    }
    const op = lib.opList[sprite.texture.key];
    if (!op || !Array.isArray(op.range) || op.range.length === 0) {
        sprite.rangeGraphics.clear();
        return;
    }
    const graphics = sprite.rangeGraphics;
    graphics.clear();
    graphics.lineStyle(2, rgbArrayToHex(op.color), 1);
    const centerX = sprite.x;
    const centerY = sprite.y;
    const points = op.range;
    let start = [0, 0];
    let end = [0, 0];
    if (points.length === 1 && Array.isArray(points[0]) && points[0].length === 2) {
        end = points[0];
    } else if (points.length >= 2 && Array.isArray(points[0]) && points[0].length === 2 && Array.isArray(points[1]) && points[1].length === 2) {
        start = points[0];
        end = points[1];
    }
    const minX = Math.min(start[0], end[0]);
    const maxX = Math.max(start[0], end[0]);
    const minY = Math.min(start[1], end[1]);
    const maxY = Math.max(start[1], end[1]);
    let rectX = centerX + minX * DB.gridSize - DB.gridSize / 2;
    let rectY = centerY + minY * DB.gridSize - DB.gridSize / 2;
    let rectW = (maxX - minX + 1) * DB.gridSize;
    let rectH = (maxY - minY + 1) * DB.gridSize;
    const worldLeft = DB.gridOffsetX;
    const worldTop = DB.gridOffsetY;
    const worldRight = DB.gridOffsetX + DB.worldWidth;
    const worldBottom = DB.gridOffsetY + DB.worldHeight;
    const rectRight = rectX + rectW;
    const rectBottom = rectY + rectH;
    if (rectX < worldLeft) {
        rectW -= worldLeft - rectX;
        rectX = worldLeft;
    }
    if (rectY < worldTop) {
        rectH -= worldTop - rectY;
        rectY = worldTop;
    }
    if (rectRight > worldRight) {
        rectW -= rectRight - worldRight;
    }
    if (rectBottom > worldBottom) {
        rectH -= rectBottom - worldBottom;
    }
    if (rectW > 0 && rectH > 0) {
        graphics.fillStyle(rgbArrayToHex(op.color), 0.2);
        graphics.fillRect(rectX, rectY, rectW, rectH);
        graphics.lineStyle(2, rgbArrayToHex(op.color), 0.8);
        graphics.strokeRect(rectX, rectY, rectW, rectH);
    }
}

function createRangeGraphics(scene, sprite) {
    const op = lib.opList[sprite.texture.key];
    if (!op || !Array.isArray(op.range) || op.range.length === 0) {
        return;
    }
    const graphics = scene.add.graphics();
    graphics.setDepth(0);
    sprite.rangeGraphics = graphics;
    drawRangeForSprite(sprite);
}

function create() {
    DB.currentScene = this;
    DB.gameCanvas = this.sys.game.canvas;
    DB.gameWidth = this.sys.game.config.width;
    DB.gameHeight = this.sys.game.config.height;
    DB.gridSize = Math.floor(
        Math.min(
            DB.gameWidth / DB.gridCols,
            DB.gameHeight / DB.gridRows
        )
    );
    DB.worldWidth = DB.gridCols * DB.gridSize;
    DB.worldHeight = DB.gridRows * DB.gridSize;
    DB.gridOffsetX = (DB.gameWidth - DB.worldWidth) / 2;
    DB.gridOffsetY = (DB.gameHeight - DB.worldHeight) / 2;
    this.physics.world.setBounds(
        DB.gridOffsetX,
        DB.gridOffsetY,
        DB.worldWidth,
        DB.worldHeight
    );
    drawGridLines(this);
    initCamera(this);
    initUI(this);
    updatePhaseUI();
    buildStatusText();
    openStrategyPanel();
    setupGridInput(this);
}

function update(time, delta) {
    if (state.phase === GamePhase.BATTLE) {
        attackEnemies(delta);
        updateBattleEnd();
    }
    if (!DB.isDragging) {
        DB.sprites.forEach(sprite => {
            if (sprite.body) {
                if (Math.abs(sprite.body.velocity.x) < 5) {
                    sprite.body.velocity.x = 0;
                }
                if (Math.abs(sprite.body.velocity.y) < 5) {
                    sprite.body.velocity.y = 0;
                }
            }
        });
    }
    DB.sprites.forEach(sprite => {
        if (sprite.rangeGraphics) {
            drawRangeForSprite(sprite);
        }
    });
    timer += delta;
}
