/**
 * 是否运行在 macOS。
 * macOS 下窗口使用系统原生红绿灯（tauri.macos.conf.json 的 titleBarStyle: Overlay），
 * 自绘窗口控制按钮需隐藏，标题栏左侧留出红绿灯位置。
 * 用 userAgent 判断，避免引入 @tauri-apps/plugin-os 依赖；非 Tauri 预览环境同样适用。
 */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
