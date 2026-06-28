//! cc-switch 配置迁移模块：只读识别（preview）+ 探测导入（import）。
//!
//! - `preview`：只读 cc-switch.db，按 app 分支解析 + 跳过规则，返回识别端点列表（不写库、不探测）。
//! - `import`：对勾选项探测模型并写 endpoints，同名加 `(cc-switch)`，写库后由命令层 emit endpoints-changed。
//!
//! 字段映射 / 跳过规则 / URL 规整见 plan-doc/cc-switch-{field-mapping,import-flow}.md
//! 与 tasks/01-cc-switch-migration/research/cc-switch-backend-read.md。

pub mod importer;
pub mod mapper;
pub mod reader;
pub mod url_normalize;

use std::path::PathBuf;

use serde::Serialize;

use crate::error::{AppError, AppResult};

/// 预览项（命令 payload）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewItem {
    pub cc_switch_id: String,
    pub app_type: String,
    pub name: String,
    /// 规整前原始地址（ok 项有值；skipped 项为空）。
    pub api_url: String,
    /// 脱敏密钥：sk-***xxxx（仅展示用）。
    pub api_key_masked: String,
    pub transformer: String,
    pub models_hint: Vec<String>,
    /// "ok" | "skipped"。
    pub status: String,
    pub skip_reason: Option<String>,
}

/// 脱敏 api_key：保留前缀与末 4 位，中间用 *** 代替；过短则全遮。
fn mask_key(key: &str) -> String {
    let k = key.trim();
    if k.is_empty() {
        return String::new();
    }
    if k.len() <= 8 {
        return "***".into();
    }
    let head = &k[..4];
    let tail = &k[k.len() - 4..];
    format!("{head}***{tail}")
}

/// cc-switch.db 默认候选路径：`~/.cc-switch/cc-switch.db`。
pub fn default_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cc-switch")
        .join("cc-switch.db")
}

/// 解析 db_path 参数：传入则用之，否则用默认候选。
pub fn resolve_db_path(db_path: Option<&str>) -> AppResult<PathBuf> {
    if let Some(p) = db_path {
        let trimmed = p.trim();
        if trimmed.is_empty() {
            return Err(AppError::InvalidArgument("cc-switch.db 路径为空".into()));
        }
        return Ok(PathBuf::from(trimmed));
    }
    Ok(default_db_path())
}

/// 预览：只读识别 cc-switch 供应商，不写库、不探测。
pub fn preview(db_path: &std::path::Path) -> AppResult<Vec<PreviewItem>> {
    let rows = reader::read_providers(db_path)?;
    let mut out = Vec::with_capacity(rows.len());
    for row in &rows {
        let m = mapper::map_row(row)?;
        out.push(PreviewItem {
            cc_switch_id: m.cc_switch_id,
            app_type: m.app_type,
            name: m.name,
            api_url: m.raw_url,
            api_key_masked: mask_key(&m.api_key),
            transformer: m.transformer,
            models_hint: m.models_hint,
            status: m.status,
            skip_reason: m.skip_reason,
        });
    }
    Ok(out)
}
