//! 读取 CPA YAML 配置为弱类型 JSON Value。

use std::path::Path;

use serde_json::Value;

use crate::error::{AppError, AppResult};

/// 读取并解析 CPA 配置文件（yaml / yml / conf）。
pub fn read_config(path: &Path) -> AppResult<Value> {
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "未找到 CLI Proxy API 配置文件: {}",
            path.display()
        )));
    }

    let text = std::fs::read_to_string(path)?;
    parse_yaml(&text)
}

fn parse_yaml(text: &str) -> AppResult<Value> {
    let yaml: serde_yaml::Value = serde_yaml::from_str(text).map_err(|e| {
        AppError::InvalidArgument(format!("解析 CLI Proxy API YAML 失败: {e}"))
    })?;
    serde_json::to_value(yaml).map_err(|e| {
        AppError::InvalidArgument(format!("转换 CLI Proxy API 配置失败: {e}"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("ccmesh-cpa-read-{nanos}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn reads_yaml_openai_and_codex_sections() {
        let dir = temp_dir();
        let path = dir.join("config.yaml");
        let mut file = std::fs::File::create(&path).unwrap();
        write!(
            file,
            r#"
openai-compatibility:
  - name: demo
    base-url: https://example.com/v1
    api-key-entries:
      - api-key: sk-demo
codex-api-key:
  - api-key: sk-codex
    base-url: https://codex.example.com
"#
        )
        .unwrap();

        let root = read_config(&path).unwrap();
        assert!(root.get("openai-compatibility").is_some());
        assert!(root.get("codex-api-key").is_some());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn parse_yaml_rejects_invalid_text() {
        let err = parse_yaml(":\n  - broken").unwrap_err();
        assert!(err.to_string().contains("解析 CLI Proxy API YAML 失败"));
    }

    #[test]
    fn missing_file_is_not_found() {
        let path = std::env::temp_dir().join("ccmesh-cpa-missing-xyz.yaml");
        let _ = std::fs::remove_file(&path);
        let err = read_config(&path).unwrap_err();
        assert!(err.to_string().contains("未找到 CLI Proxy API 配置文件"));
    }
}
