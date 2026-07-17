//! CLI Proxy API 源适配器：YAML 配置 → MappedEndpoint。
//!
//! 仅迁移上游凭证区块：
//! - `openai-compatibility`
//! - `codex-api-key`
//! - `claude-api-key`
//!
//! 一条 API Key = 一个端点候选；模型列表由导入阶段探测补全。
//! 未指定路径时按常见安装位置自动探测配置文件。

mod mapper;
mod reader;

use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::modules::external_migration::types::MappedEndpoint;

/// 冲突重命名后缀（仅本源使用）。
pub const NAME_SUFFIX: &str = "cpa";

/// 默认/候选配置路径（按优先级）。
/// 覆盖：用户目录、Homebrew（Apple Silicon / Intel）、系统 etc。
pub fn candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(home) = dirs::home_dir() {
        let base = home.join(".cli-proxy-api");
        paths.push(base.join("config.yaml"));
        paths.push(base.join("config.yml"));
        paths.push(base.join("cliproxyapi.conf"));
        paths.push(base.join("config.conf"));
        paths.push(home.join("cliproxyapi.conf"));
        paths.push(home.join("cliproxyapi.yaml"));
    }
    // Homebrew
    paths.push(PathBuf::from("/opt/homebrew/etc/cliproxyapi.conf"));
    paths.push(PathBuf::from("/opt/homebrew/etc/cli-proxy-api/config.yaml"));
    paths.push(PathBuf::from("/usr/local/etc/cliproxyapi.conf"));
    paths.push(PathBuf::from("/usr/local/etc/cli-proxy-api/config.yaml"));
    // 系统级
    paths.push(PathBuf::from("/etc/cliproxyapi.conf"));
    paths.push(PathBuf::from("/etc/cli-proxy-api/config.yaml"));
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
        return Err(AppError::InvalidArgument(
            "CLI Proxy API 配置文件路径为空".into(),
        ));
    }
    discover_path().ok_or_else(|| {
        let tried = candidate_paths()
            .into_iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
            .join("; ");
        AppError::NotFound(format!(
            "未找到 CLI Proxy API 配置文件（已探测: {tried}）"
        ))
    })
}

/// 读取并映射为公共候选列表。
pub fn load(path: &Path) -> AppResult<Vec<MappedEndpoint>> {
    let root = reader::read_config(path)?;
    Ok(mapper::map_config(&root))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidates_include_homebrew_path() {
        let paths = candidate_paths();
        assert!(paths.iter().any(|p| {
            p == Path::new("/opt/homebrew/etc/cliproxyapi.conf")
        }));
        assert!(paths.iter().any(|p| {
            p.ends_with(Path::new(".cli-proxy-api/config.yaml"))
        }));
    }

    #[test]
    fn resolve_explicit_path() {
        let p = resolve_path(Some("/tmp/custom.yaml")).unwrap();
        assert_eq!(p, PathBuf::from("/tmp/custom.yaml"));
    }

    #[test]
    fn resolve_empty_path_errors() {
        assert!(resolve_path(Some("  ")).is_err());
    }
}
