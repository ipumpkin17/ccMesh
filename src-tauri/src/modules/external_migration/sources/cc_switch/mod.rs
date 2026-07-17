//! CC Switch 源适配器：只读 db → MappedEndpoint。
//!
//! 默认路径、读库、字段映射与跳过规则均属本源；探测写库走公共 importer。
//! 未指定路径时按常见安装位置自动探测数据库。

mod mapper;
mod reader;

use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::modules::external_migration::types::MappedEndpoint;

/// 冲突重命名后缀（仅本源使用）。
pub const NAME_SUFFIX: &str = "cc-switch";

/// 默认/候选数据库路径（按优先级）。
pub fn candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join(".cc-switch").join("cc-switch.db"));
        // 部分环境 HOME 与 USERPROFILE 不一致时的兼容
        paths.push(home.join("cc-switch").join("cc-switch.db"));
    }
    #[cfg(windows)]
    {
        if let Ok(profile) = std::env::var("USERPROFILE") {
            let p = PathBuf::from(profile).join(".cc-switch").join("cc-switch.db");
            if !paths.contains(&p) {
                paths.push(p);
            }
        }
    }
    paths
}

/// 自动探测：返回第一个存在的候选路径。
pub fn discover_path() -> Option<PathBuf> {
    candidate_paths().into_iter().find(|p| p.is_file())
}

/// 解析路径参数：显式路径优先；否则自动探测。
pub fn resolve_path(path: Option<&str>) -> AppResult<PathBuf> {
    if let Some(p) = path.map(str::trim).filter(|p| !p.is_empty()) {
        return Ok(PathBuf::from(p));
    }
    if path.is_some() {
        return Err(AppError::InvalidArgument("CC Switch 数据库路径为空".into()));
    }
    discover_path().ok_or_else(|| {
        let tried = candidate_paths()
            .into_iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
            .join("; ");
        AppError::NotFound(format!(
            "未找到 CC Switch 配置数据库（已探测: {tried}）"
        ))
    })
}

/// 读取并映射为公共候选列表。
pub fn load(path: &Path) -> AppResult<Vec<MappedEndpoint>> {
    let rows = reader::read_providers(path)?;
    Ok(rows.iter().map(mapper::map_row).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidates_include_dot_cc_switch() {
        let paths = candidate_paths();
        assert!(paths.iter().any(|p| {
            p.ends_with(Path::new(".cc-switch/cc-switch.db"))
        }));
    }

    #[test]
    fn resolve_explicit_path() {
        let p = resolve_path(Some("/tmp/custom.db")).unwrap();
        assert_eq!(p, PathBuf::from("/tmp/custom.db"));
    }
}
