// Phaser游戏配置
const config = {
    type: Phaser.AUTO,
    parent: "game-container",
    width: lib.resolution.width,
    height: lib.resolution.height,
    backgroundColor: "#000000", // 纯黑色背景
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

// 创建游戏实例
let game = new Phaser.Game(config);

// 游戏变量
let timer = 0;
let DB = {
    sprites: [],
    isDragging: false,
    dragStartPos: { x: 0, y: 0 },
    gridSize: 144, // 网格尺寸
    gridCols: 16, // 网格列数
    gridRows: 6, // 网格行数（修正为9，以匹配计算）
    worldWidth: 0, // 物理世界宽度
    worldHeight: 0, // 物理世界高度（修正为gridRows）
    gridOffsetX: 0, // 网格水平偏移量（居中）
    gridOffsetY: 0 // 网格垂直偏移量（居中）
};

// 预加载资源
function preload() {
    // 显示加载状态
    let loadingText = this.add.text(
        this.sys.game.config.width / 2,
        this.sys.game.config.height / 2 - 50,
        "生成头像中...",
        {
            fontSize: "24px",
            fill: "#ffffff",
            fontFamily: "Arial, sans-serif"
        }
    );
    loadingText.setOrigin(0.5);

    // 进度条
    let progressBar = this.add.graphics();
    let progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(
        this.sys.game.config.width / 2 - 160,
        this.sys.game.config.height / 2,
        320,
        30
    );

    // 获取所有操作员
    const ops = Object.keys(lib.opList);
    const total = ops.length;
    let processed = 0;

    // 更新进度
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

        loadingText.setText(`生成中... ${Math.floor(value * 100)}%`);

        // 完成
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

    // 使用Canvas生成纹理（同步，性能更好）
    ops.forEach(key => {
        const op = lib.opList[key];

        // 创建Canvas
        const canvas = document.createElement("canvas");
        canvas.width = 144;
        canvas.height = 144;
        const ctx = canvas.getContext("2d");

        // 绘制jdenticon
        jdenticon.drawIcon(ctx, op.name, 144);

        const colorThief = new ColorThief();
        op.color = colorThief.getColor(canvas, 8);

        // 添加到Phaser纹理
        this.textures.addCanvas(key, canvas);

        // 更新进度
        updateProgress();
    });
}

// 绘制网格边界线
function drawGridLines(scene) {
    const graphics = scene.add.graphics();

    // 设置线条样式
    graphics.lineStyle(4, 0xffffff, 0.7);

    // 绘制网格线
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

    // 绘制网格区域边框
    graphics.lineStyle(4, 0xffffff, 1);
    graphics.strokeRect(
        DB.gridOffsetX,
        DB.gridOffsetY,
        DB.worldWidth,
        DB.worldHeight
    );

    // 设置网格线在底层显示
    graphics.setDepth(-1);

    return graphics;
}

// 计算网格吸附位置（吸附到格内正中央）
function snapToGrid(x, y) {
    // 计算相对于网格起始位置的坐标
    const relativeX = x - DB.gridOffsetX;
    const relativeY = y - DB.gridOffsetY;

    // 计算网格索引
    const gridCol = Math.floor(relativeX / DB.gridSize);
    const gridRow = Math.floor(relativeY / DB.gridSize);

    // 确保在网格范围内
    const clampedCol = Phaser.Math.Clamp(gridCol, 0, DB.gridCols - 1);
    const clampedRow = Phaser.Math.Clamp(gridRow, 0, DB.gridRows - 1);

    // 计算网格中心点坐标
    const gridCenterX =
        DB.gridOffsetX + clampedCol * DB.gridSize + DB.gridSize / 2;
    const gridCenterY =
        DB.gridOffsetY + clampedRow * DB.gridSize + DB.gridSize / 2;

    return { x: gridCenterX, y: gridCenterY };
}

// 创建游戏对象
function create() {
    DB.worldWidth = DB.gridCols * DB.gridSize;
    DB.worldHeight = DB.gridRows * DB.gridSize;

    // 计算网格区域在物理世界中的居中偏移
    DB.gridOffsetX = (lib.resolution.width - DB.worldWidth) / 2;
    DB.gridOffsetY = (lib.resolution.height - DB.worldHeight) / 2;

    // 设置物理世界边界
    this.physics.world.setBounds(
        DB.gridOffsetX,
        DB.gridOffsetY,
        DB.worldWidth,
        DB.worldHeight
    );

    // 绘制网格线
    drawGridLines(this);

    // 计算第一个网格的中心位置
    const firstGridCenterX = DB.gridOffsetX + DB.gridSize / 2;
    const firstGridCenterY = DB.gridOffsetY + DB.gridSize / 2;

    // 创建精灵并启用物理，初始位置在第一个网格中心
    let sprite = this.physics.add.sprite(
        firstGridCenterX,
        firstGridCenterY,
        "jj"
    );
    sprite.setCollideWorldBounds(true); // 启用物理边界碰撞
    sprite.setBounce(0.3, 0.3); // 设置反弹系数

    // 设置精灵深度
    sprite.setDepth(1);

    // 添加拖动功能
    sprite.setInteractive({ draggable: true });

    // 监听拖动事件
    sprite.on("drag", (pointer, dragX, dragY) => {
        DB.isDragging = true;

        // 计算物理力，使拖动更平滑
        const forceX = (dragX - sprite.x) * 0.2;
        const forceY = (dragY - sprite.y) * 0.2;

        // 应用物理力而不是直接设置位置
        sprite.setVelocity(forceX * 25, forceY * 25);
    });

    // 监听拖动开始事件
    sprite.on("dragstart", pointer => {
        DB.dragStartPos.x = sprite.x;
        DB.dragStartPos.y = sprite.y;
    });

    // 监听拖动结束事件
    sprite.on("dragend", pointer => {
        DB.isDragging = false;

        // 网格吸附
        const snappedPos = snapToGrid(sprite.x, sprite.y);

        // 使用补间动画进行平滑吸附
        this.tweens.add({
            targets: sprite,
            x: snappedPos.x,
            y: snappedPos.y,
            duration: 150, // 吸附动画持续时间
            ease: "Back.easeOut", // 回弹效果
            onComplete: () => {
                // 吸附完成后停止运动
                sprite.setVelocity(0, 0);
            }
        });
    });

    DB.sprites.push(sprite);

    // 启用物理调试（按需开启）
    // this.physics.world.drawDebug = true;
    // this.physics.world.debugGraphic.clear();
}

// 更新游戏逻辑
function update(time, delta) {
    // 如果未在拖动中，应用物理约束
    if (!DB.isDragging) {
        // 轻微阻力，使运动更平滑
        DB.sprites.forEach(sprite => {
            if (sprite.body) {
                // 当速度很小时停止运动
                if (Math.abs(sprite.body.velocity.x) < 5) {
                    sprite.body.velocity.x = 0;
                }
                if (Math.abs(sprite.body.velocity.y) < 5) {
                    sprite.body.velocity.y = 0;
                }
            }
        });
    }

    // 更新计时器
    timer += delta;
}
