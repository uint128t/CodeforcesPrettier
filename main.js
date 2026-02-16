// ==UserScript==
// @name         Codeforces 美化
// @namespace    https://github.com/uint128t/LuoguRedirect
// @version      7.0
// @description  基于HSL模型保留色相反转，智能提亮文字，完美支持表格与菜单，替换页眉Logo
// @author       uint128t
// @match        *://*.codeforces.com/*
// @grant        GM_addStyle
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/uint128t/CodeforcesPrettier/refs/heads/main/main.js
// @updateURL https://raw.githubusercontent.com/uint128t/CodeforcesPrettier/refs/heads/main/main.js
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // 第一部分：配置区域
    // ==========================================
    const CONFIG = {
        bgImage: "https://res.cloudinary.com/dtqp1ks3x/image/upload/v1771179253/Purple_Opaline_blurred_ynwenc.png",
        logoImage: "https://res.cloudinary.com/dtqp1ks3x/image/upload/v1771276143/codeforces-transparent_vvaw1j.png",

        // 颜色阈值
        bgThreshold: 0.55,      // 背景亮度高于此值视为"浅色"，需反转
        textLightness: 0.70,    // 彩色文字提亮的目标亮度 (0.0 - 1.0)

        // 硬编码颜色 (表格等关键区域)
        color: {
            tableBg: '#252525',
            tableHeader: '#141414',
            tableDarkRow: '#1e1e1e',
            tableCell: '#141414',
            inputBg: '#2b2b2b',
            codeBg: '#161616',
            menuLava: '#3a3a3a',
            menuCurrent: '#484848' // 菜单当前项亮度
        }
    };

    // ==========================================
    // 第二部分：CSS 样式注入
    // ==========================================
    GM_addStyle(`
        /* 1. 全局背景 */
        body {
            background-image: url('${CONFIG.bgImage}') !important;
            background-size: cover !important;
            background-position: center center !important;
            background-attachment: fixed !important;
            background-repeat: no-repeat !important;
        }

        /* 2. 圆角重构 (移除旧尖角，添加新圆角) */
        .lt, .rt, .lb, .rb, .ilt, .irt,
        .roundbox-lt, .roundbox-rt, .roundbox-lb, .roundbox-rb {
            display: none !important;
        }
        .datatable, .datatable > div, .roundbox {
            border-radius: 6px !important;
            border-color: #444 !important;
        }

        /* 3. 表格硬编码 (解决斑马纹优先级问题) */
        .datatable { background-color: ${CONFIG.color.tableBg} !important; }
        th { background-color: ${CONFIG.color.tableHeader} !important; }
        table td.dark { background-color: ${CONFIG.color.tableDarkRow} !important; }
        table td { background-color: ${CONFIG.color.tableCell} !important; }

        /* 4. 菜单优化 */
        .backLava, .leftLava, .bottomLava, .cornerLava {
            background: ${CONFIG.color.menuLava} !important;
            border-radius: 5px !important;
        }
        /* 提亮当前菜单项的小白条而不影响下方菜单 */
        .menu-box li.current, .second-level-menu li.current {
            background-color: ${CONFIG.color.menuCurrent} !important;
        }
        li.current.selectedLava {
            background-color: transparent !important;
        }

        /* 5. 输入框与代码块 */
        input, textarea, select {
            background-color: ${CONFIG.color.inputBg} !important;
            color: #fff !important;
            border-color: #555 !important;
        }
        pre, code {
            background-color: ${CONFIG.color.codeBg} !important;
            color: #ddd !important;
            border-radius: 4px !important;
        }

        /* 6. 滚动条 */
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        ::-webkit-scrollbar-thumb { background: #555; border-radius: 5px; }
        ::-webkit-scrollbar-thumb:hover { background: #666; }

        /* 7. 页眉 Logo 替换 */
        img[src*="codeforces-sponsored-by-ton.png"] {
            content: url('${CONFIG.logoImage}') !important;
        }
    `);

    // ==========================================
    // 第三部分：颜色处理工具库
    // ==========================================
    const ColorUtils = {
        /**
         * 解析 RGB 字符串
         * @returns {object|null} {r, g, b}
         */
        parseRGB(colorStr) {
            if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            return match ? { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) } : null;
        },

        /**
         * RGB 转 HSL
         * @returns {array} [h, s, l] (0-1 范围)
         */
        rgbToHsl(r, g, b) {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;

            if (max === min) {
                h = s = 0; // 灰度
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            return [h, s, l];
        },

        /**
         * HSL 转 RGB
         * @returns {array} [r, g, b] (0-255 范围)
         */
        hslToRgb(h, s, l) {
            let r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        }
    };

    // ==========================================
    // 第四部分：DOM 处理逻辑
    // ==========================================

    /**
     * 处理单个节点的样式
     */
    const processNode = (node) => {
        if (!node.nodeType || node.nodeType !== 1) return;

        // 优化：跳过表格内部元素 (由 CSS 硬编码控制)
        if (['TR', 'TD', 'TH', 'TABLE', 'TBODY', 'THEAD', 'TFOOT'].includes(node.tagName)) return;
        // 跳过无关标签
        if (['SCRIPT', 'STYLE', 'LINK', 'META', 'BR', 'HR', 'IMG', 'SVG', 'IFRAME', 'CANVAS', 'VIDEO', 'SOURCE'].includes(node.tagName)) return;

        try {
            const style = window.getComputedStyle(node);

            // --- 1. 背景处理 (保留色相的反转) ---
            const bgRGB = ColorUtils.parseRGB(style.backgroundColor);
            if (bgRGB) {
                let [h, s, l] = ColorUtils.rgbToHsl(bgRGB.r, bgRGB.g, bgRGB.b);
                // 如果是浅色背景，反转亮度
                if (l > CONFIG.bgThreshold) {
                    let newL = Math.max(0.08, 1.0 - l); // 反转并设置底限
                    const [r, g, b] = ColorUtils.hslToRgb(h, s, newL);
                    node.style.setProperty('background-color', `rgb(${r}, ${g}, ${b})`, 'important');

                    if (style.backgroundImage !== 'none') node.style.backgroundImage = 'none';
                }
            }

            // --- 2. 边框处理 ---
            const bdRGB = ColorUtils.parseRGB(style.borderColor);
            if (bdRGB) {
                let [h, s, l] = ColorUtils.rgbToHsl(bdRGB.r, bdRGB.g, bdRGB.b);
                if (l > CONFIG.bgThreshold) {
                    let newL = Math.max(0.1, 1.0 - l);
                    const [r, g, b] = ColorUtils.hslToRgb(h, s, newL);
                    node.style.setProperty('border-color', `rgb(${r}, ${g}, ${b})`, 'important');
                }
            }

            // --- 3. 文字处理 (深彩色 -> 浅彩色) ---
            const colorRGB = ColorUtils.parseRGB(style.color);
            if (colorRGB) {
                let [h, s, l] = ColorUtils.rgbToHsl(colorRGB.r, colorRGB.g, colorRGB.b);

                // A. 灰度文字 (饱和度低)：深灰变白
                if (s < 0.15) {
                    if (l < 0.6) node.style.setProperty('color', "#e0e0e0", 'important');
                }
                // B. 彩色文字 (饱和度高)：深色变亮，保留色相
                else {
                    if (l < 0.5) {
                        // 提亮至配置的亮度值
                        const [r, g, b] = ColorUtils.hslToRgb(h, s, CONFIG.textLightness);
                        node.style.setProperty('color', `rgb(${r}, ${g}, ${b})`, 'important');
                    }
                }
            }
        } catch (e) { /* 忽略跨域或其他异常 */ }
    };

    /**
     * 遍历 DOM 树
     */
    const walkDOM = (root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
        let node = walker.currentNode;
        while (node) {
            processNode(node);
            node = walker.nextNode();
        }
    };

    // ==========================================
    // 第五部分：初始化与监听
    // ==========================================
    const init = () => {
        if (document.body) {
            walkDOM(document.body);

            // 监听动态内容变化
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    // 处理新增节点
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            processNode(node);
                            walkDOM(node);
                        }
                    }
                    // 处理属性变化 (如 style 被 JS 修改)
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                         processNode(mutation.target);
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style']
            });

        } else {
            requestAnimationFrame(init);
        }
    };

    init();

})();
