// 全局配置 Vant
Vue.use(vant);

// 设置 Vant 组件的默认样式
vant.Toast.setDefaultOptions({
    duration: 2000,
    position: "middle",
    forbidClick: true
});

vant.Dialog.setDefaultOptions({
    theme: "round-button",
    confirmButtonColor: "#1989fa"
});

// 创建 Vue 实例
const app = new Vue({
    el: "#app",
    data: function () {
        return {
            // 应用状态数据
            isLoading: false,

            opList: lib.opList
        };
    },
    created() {
        // 初始化逻辑
        this.genSvg();
        console.log("应用已初始化");
    },
    mounted() {
        // DOM 挂载完成
        this.$nextTick(function () {
            // 确保 DOM 更新后执行
            console.log("应用已挂载");
        });
        this.lockLandscape();
    },

    methods: {
        lockLandscape() {
            // 强制横屏显示
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation
                    .lock("landscape")
                    .then(() => {
                        console.log("屏幕方向已锁定为横屏");
                    })
                    .catch(err => {
                        console.log("屏幕方向锁定失败:", err);
                    });
            }

            // 防止页面滚动
            document.body.style.overflow = "hidden";
        },

        toggleDescription(event, key) {
            // 防止事件冒泡
            event.stopPropagation();

            // 获取当前点击的描述框
            const currentOp = event.currentTarget;
            const currentDesc = currentOp.querySelector(".op-description");
            const isShowing = currentDesc.classList.contains("show");

            // 获取所有描述框
            const allDescriptions =
                document.querySelectorAll(".op-description");

            // 隐藏所有描述框
            allDescriptions.forEach(desc => {
                if (desc !== currentDesc) {
                    desc.classList.remove("show");
                }
            });

            // 如果之前没有显示，则显示当前描述框
            if (!isShowing) {
                currentDesc.classList.add("show");
            } else {
                currentDesc.classList.remove("show");
            }

            // 点击其他地方关闭描述框
            const closeOnClickOutside = e => {
                if (
                    !currentOp.contains(e.target) &&
                    !currentDesc.contains(e.target)
                ) {
                    currentDesc.classList.remove("show");
                    document.removeEventListener("click", closeOnClickOutside);
                }
            };

            setTimeout(() => {
                document.addEventListener("click", closeOnClickOutside);
            }, 0);
        },

        genSvg() {
            for (let key in this.opList) {
                const op = this.opList[key];
                this.$set(op, "svg", jdenticon.toSvg(op.name, 144));
            }
        },

        // 工具方法
        showLoading() {
            this.isLoading = true;
        },
        hideLoading() {
            this.isLoading = false;
        },
        // 显示消息提示
        showToast(message) {
            vant.Toast(message);
        },
        // 显示确认对话框
        showConfirm(options) {
            return vant.Dialog.confirm(options);
        },
        // 路由跳转（简化版）
        navigateTo(path) {
            console.log("跳转到:", path);
            document.getElementById("dark").style.opacity = 1;
            setTimeout(() => {
                location.href = path + ".html";
            }, 500);
        },
        
        boot() {
            window.bootTimer = setTimeout(() => {
                this.navigateTo("game");
            }, 1000);
        },
        
        cancel() {
            if(window.bootTimer) clearTimeout(window.bootTimer);
        },
    },
    computed: {
        // 计算属性
        isMobile: function () {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            );
        }
    },
    watch: {
        // 监听器
        isLoading: function (newVal) {
            if (newVal) {
                // 显示加载状态
                console.log("开始加载");
            } else {
                // 隐藏加载状态
                console.log("加载完成");
            }
        }
    },
    // 自定义指令
    directives: {
        // 点击波纹效果
        ripple: {
            inserted: function (el, binding) {
                el.addEventListener("click", function (e) {
                    const ripple = document.createElement("div");
                    const rect = el.getBoundingClientRect();
                    const size = Math.max(rect.width, rect.height);
                    const x = e.clientX - rect.left - size / 2;
                    const y = e.clientY - rect.top - size / 2;

                    ripple.style.cssText = `
                                position: absolute;
                                border-radius: 50%;
                                background: rgba(255, 255, 255, 0.7);
                                transform: scale(0);
                                animation: ripple-animation 0.6s linear;
                                width: ${size}px;
                                height: ${size}px;
                                top: ${y}px;
                                left: ${x}px;
                                pointer-events: none;
                            `;

                    el.style.position = "relative";
                    el.style.overflow = "hidden";
                    el.appendChild(ripple);

                    setTimeout(() => {
                        ripple.remove();
                    }, 600);
                });
            }
        }
    },
    // 混入
    mixins: [
        {
            methods: {
                // 格式化日期
                formatDate: function (date) {
                    if (!date) return "";
                    const d = new Date(date);
                    return (
                        d.getFullYear() +
                        "-" +
                        (d.getMonth() + 1).toString().padStart(2, "0") +
                        "-" +
                        d.getDate().toString().padStart(2, "0")
                    );
                }
            }
        }
    ]
});

// 添加全局 CSS 动画
const style = document.createElement("style");
style.textContent = `
            @keyframes ripple-animation {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .fade-in {
                animation: fade-in 0.3s ease-in;
            }
        `;
document.head.appendChild(style);

// 处理移动端键盘弹起
window.addEventListener("resize", function () {
    if (
        document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA"
    ) {
        window.setTimeout(function () {
            document.activeElement.scrollIntoViewIfNeeded();
        }, 100);
    }
});

// 禁止双击缩放
let lastTouchEnd = 0;
document.addEventListener(
    "touchend",
    function (event) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    },
    false
);
