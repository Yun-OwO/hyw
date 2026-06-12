function copy(data) {
    return JSON.stringify(JSON.parse(data));
}

const lib = {
    opList: {
        jw: {
            name: "近卫",
            atk: 650,
            def: 400,
            sr: 25,
            hp: 2800,
            dp: 18,
            svg: "",
            atkType: "phy",
            bl: 2,
            delay: 750,
            range: [[1, 0]],
        },
        xf: {
            name: "先锋",
            atk: 450,
            def: 300,
            sr: 12,
            hp: 1800,
            dp: 8,
            svg: "",
            atkType: "phy",
            bl: 2,
            delay: 500,
            range: [[1, 0]],
        },
        jj: {
            name: "狙击",
            atk: 550,
            def: 150,
            sr: 5,
            hp: 1200,
            dp: 12,
            svg: "",
            atkType: "phy",
            bl: 0,
            delay: 500,
            range: [[0, 1], [3, -1]]
        },
        ss: {
            name: "术师",
            atk: 600,
            def: 100,
            sr: 8,
            hp: 1100,
            dp: 18,
            svg: "",
            atkType: "spe",
            bl: 0,
            delay: 800,
            range: [[0, 1], [3, -1]]
        },
        tz: {
            name: "特种",
            atk: 550,
            def: 350,
            sr: 35,
            hp: 1500,
            dp: 10,
            svg: "",
            atkType: "spe",
            bl: 1,
            delay: 450,
            range: [[1, 0]]
        },
        zz: {
            name: "重装",
            atk: 350,
            def: 900,
            sr: 10,
            hp: 4000,
            dp: 20,
            svg: "",
            atkType: "phy",
            bl: 3,
            delay: 750,
            range: []
        },
        yl: {
            name: "医疗",
            atk: 350,
            def: 100,
            sr: 0,
            hp: 1500,
            dp: 15,
            svg: "",
            atkType: "tre",
            bl: 0,
            delay: 1400,
            range: [[0,1], [3, -1]]
        }
    },
    resolution: {
        height: innerHeight * devicePixelRatio,
        width: innerWidth * devicePixelRatio
    },
    config: {
        strategies: [
            {
                id: "gold",
                name: "黄金先机",
                desc: "PREP开始获得额外+2 Gold",
                bonusGold: 2,
                bonusDP: 0
            },
            {
                id: "dp",
                name: "部署先行",
                desc: "PREP开始获得额外+2 DP",
                bonusGold: 0,
                bonusDP: 2
            },
            {
                id: "strike",
                name: "突袭准备",
                desc: "所有初始干员攻击+10%",
                bonusGold: 0,
                bonusDP: 0,
                unitAtkMultiplier: 1.1
            }
        ],
        operators: [
            {
                id: "xf",
                name: "先锋",
                tier: 1,
                costGold: 3,
                costDP: 2,
                atk: 450,
                def: 300,
                hp: 1800,
                range: 1,
                atkSpd: 1200,
                faction: "vanguard",
                color: 0x6BB4FF
            },
            {
                id: "jj",
                name: "狙击",
                tier: 1,
                costGold: 4,
                costDP: 3,
                atk: 550,
                def: 150,
                hp: 1200,
                range: 3,
                atkSpd: 1800,
                faction: "sniper",
                color: 0xFFB74D
            },
            {
                id: "ss",
                name: "术师",
                tier: 1,
                costGold: 4,
                costDP: 3,
                atk: 600,
                def: 100,
                hp: 1100,
                range: 3,
                atkSpd: 2000,
                faction: "caster",
                color: 0x9C27B0
            },
            {
                id: "tz",
                name: "特种",
                tier: 1,
                costGold: 5,
                costDP: 3,
                atk: 520,
                def: 350,
                hp: 1500,
                range: 2,
                atkSpd: 1400,
                faction: "special",
                color: 0x4CAF50
            }
        ],
        equips: [
            {
                id: "equip_atk",
                name: "战术强化",
                type: "equip",
                costGold: 4,
                desc: "+20% 攻击，应用于下一名部署干员",
                effect: { atkMultiplier: 1.2 }
            },
            {
                id: "equip_range",
                name: "射程模块",
                type: "equip",
                costGold: 4,
                desc: "+1 攻击范围，应用于下一名部署干员",
                effect: { rangeBonus: 1 }
            }
        ],
        spells: [
            {
                id: "spell_slow",
                name: "区域减速",
                type: "spell",
                costGold: 3,
                desc: "本回合敌人速度降低20%",
                effect: { slow: 0.8 }
            },
            {
                id: "spell_heal",
                name: "急救包",
                type: "spell",
                costGold: 3,
                desc: "立即为部署单位恢复20%生命",
                effect: { healPercent: 0.2 }
            }
        ],
        shopPools: {
            1: ["xf", "jj", "equip_atk", "equip_range"],
            2: ["xf", "jj", "ss", "equip_atk", "equip_range"],
            3: ["xf", "jj", "ss", "tz", "equip_atk", "equip_range", "spell_slow", "spell_heal"]
        },
        enemyDefs: {
            grunt: {
                id: "grunt",
                name: "杂兵",
                hp: 80,
                atk: 10,
                speed: 40,
                reward: 2,
                color: 0xE53935
            },
            fast: {
                id: "fast",
                name: "速攻",
                hp: 60,
                atk: 8,
                speed: 80,
                reward: 2,
                color: 0xFF8F00
            },
            boss: {
                id: "boss",
                name: "首领",
                hp: 220,
                atk: 18,
                speed: 30,
                reward: 6,
                color: 0x8E24AA
            }
        },
        waves: [
            [
                { type: "grunt", count: 3 },
                { type: "fast", count: 2 }
            ],
            [
                { type: "grunt", count: 4 },
                { type: "boss", count: 1 }
            ],
            [
                { type: "grunt", count: 5 },
                { type: "fast", count: 3 },
                { type: "boss", count: 1 }
            ]
        ],
        route: [
            { x: 0, y: 2 },
            { x: 5, y: 2 },
            { x: 5, y: 4 },
            { x: 15, y: 4 }
        ],
        covenantThreshold: 3,
        maxRounds: 3
    }
};

class Op {
    constructor(op) {
        this.defaultAttr = op;
        this.currentAttr = copy(op);
    }

    beHit(op) {
        switch (op.atkType) {
            case "phy":
                this.hp -= Math.round(
                    Math.max(op.atk - this.def, op.atk * 0.05)
                );
                break;
            case "spe":
                this.hp -= Math.round(
                    Math.max((op.atk * (100 - this.sr)) / 100, op.atk * 0.05)
                );
                break;
            case "tre":
                this.hp += Math.round(Math.max(op.atk, 0));
                break;
        }
    }
}
