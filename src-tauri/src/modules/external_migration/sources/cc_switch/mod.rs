//! cc-switch 源适配器：只读 db → MappedEndpoint。

mod mapper;
mod reader;

use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::modules::external_migration::types::MappedEndpoint;

/// 冲突重命名后缀（仅本源使用）。
pub const NAME_SUFFIX: &str = "cc-switch";

/// 默认候选路径：`~/.cc-switch/cc-switch.db`。
pub fn default_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cc-switch")
        .join("cc-switch.db")
}

/// 解析路径参数：传入则用之，否则用默认候选。
pub fn resolve_path(path: Option<&str>) -> AppResult<PathBuf> {
    match path.map(str::trim).filter(|p| !p.is_empty()) {
        Some(p) => Ok(PathBuf::from(p)),
        None if path.is_some() => Err(AppError::InvalidArgument("cc-switch.db 路径为空".into())),
        None => Ok(default_path()),
    }
}

/// 读取并映射为公共候选列表。
pub fn load(path: &Path) -> AppResult<Vec<MappedEndpoint>> {
    let rows = reader::read_providers(path)?;
    Ok(rows.iter().map(mapper::map_row).collect())
}
