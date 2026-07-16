//! 可用性探测时模拟真实官方客户端的 User-Agent。
//!
//! 网关主动发起的探测请求（端点连通性测试、模型候选拉取）默认没有客户端 UA。
//! 部分上游会对「无 UA / 非官方客户端」拦截（如 Cloudflare 对空 UA 返回 403），
//! 故按上游格式模拟对应官方 CLI 的 UA：
//! - Claude 端点 → Claude CLI：`claude-cli/<version> (external, sdk-cli)`。
//! - OpenAI 端点 → Codex CLI：`codex_cli_rs/<version> (<OS>; <arch>) vscode/<version>`，并附 `originator: codex_cli_rs` 头。

/// 模拟 Claude CLI 的 UA（版本号随发布更新，此处先固定一个近期版本）。
pub const CLAUDE_PROBE_UA: &str = "claude-cli/2.1.185 (external, sdk-cli)";
pub const CODEX_VSCODE_VERSION: &str = "1.111.0";

/// Codex CLI 的 originator 头值，后端据此识别真实客户端。
pub const CODEX_ORIGINATOR: &str = "codex_cli_rs";

/// 模拟 Codex CLI 的 UA：`codex_cli_rs/<version> (<OS>; <arch>) vscode/<version>`，OS/arch 取运行环境。
pub fn codex_probe_ua() -> String {
    codex_ua_for_version("0.114.0")
}

/// 使用本机 Codex CLI 的版本构造转发 UA，平台信息始终取代理运行环境。
pub fn codex_ua_for_version(version: &str) -> String {
    format!(
        "codex_cli_rs/{version} ({}; {}) vscode/{CODEX_VSCODE_VERSION}",
        std::env::consts::OS,
        std::env::consts::ARCH
    )
}

/// 使用本机 Claude Code 的版本构造转发 UA。
pub fn claude_ua_for_version(version: &str) -> String {
    format!("claude-cli/{version} (external, sdk-cli)")
}
