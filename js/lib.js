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
            delay: 750
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
            delay: 500
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
            delay: 500
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
            delay: 800
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
            delay: 450
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
            delay: 750
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
            delay: 1400
        }
    },
    resolution: {
        height: innerHeight * devicePixelRatio,
        width: innerWidth * devicePixelRatio
    },
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
