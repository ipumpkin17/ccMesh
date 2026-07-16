use reqwest_dav::list_cmd::ListEntity;
use reqwest_dav::{Auth, ClientBuilder, Depth};

use crate::error::{AppError, AppResult};
use crate::models::config::WebDavConfig;
use crate::models::webdav::BackupFile;

const DEFAULT_BASE_DIR: &str = "ccMesh";

/// reqwest_dav 客户端封装：连接、目录确保、上传/下载/列举/删除。
pub struct WebDavClient {
    client: reqwest_dav::Client,
    base_dir: String,
}

impl WebDavClient {
    pub fn connect(cfg: &WebDavConfig) -> AppResult<Self> {
        if cfg.url.trim().is_empty() {
            return Err(AppError::WebDav("WebDAV URL 未配置".into()));
        }
        let auth = if cfg.username.is_empty() {
            Auth::Anonymous
        } else {
            Auth::Basic(cfg.username.clone(), cfg.password.clone())
        };
        let client = ClientBuilder::new()
            .set_host(cfg.url.trim_end_matches('/').to_string())
            .set_auth(auth)
            .build()
            .map_err(|e| AppError::WebDav(format!("WebDAV 客户端构建失败: {e}")))?;
        Ok(Self {
            client,
            base_dir: normalize_base_dir(&cfg.config_path)?,
        })
    }

    pub async fn test(&self) -> AppResult<()> {
        self.client
            .list("/", Depth::Number(0))
            .await
            .map_err(|e| AppError::WebDav(format!("连接失败: {e}")))?;
        Ok(())
    }

    async fn ensure_dir(&self) {
        // 按层级建目录，已存在时 mkcol 返回错误，忽略。
        let mut path = String::new();
        for segment in self.base_dir.split('/') {
            path.push('/');
            path.push_str(segment);
            let _ = self.client.mkcol(&path).await;
        }
    }

    fn backup_path(&self, name: &str) -> String {
        format!("/{}/{name}", self.base_dir)
    }

    pub async fn put(&self, name: &str, body: Vec<u8>) -> AppResult<()> {
        self.ensure_dir().await;
        self.client
            .put(&self.backup_path(name), body)
            .await
            .map_err(|e| AppError::WebDav(format!("上传失败: {e}")))
    }

    pub async fn get(&self, name: &str) -> AppResult<Vec<u8>> {
        let resp = self
            .client
            .get(&self.backup_path(name))
            .await
            .map_err(|e| AppError::WebDav(format!("下载失败: {e}")))?;
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| AppError::WebDav(format!("读取响应失败: {e}")))?;
        Ok(bytes.to_vec())
    }

    pub async fn delete(&self, name: &str) -> AppResult<()> {
        self.client
            .delete(&self.backup_path(name))
            .await
            .map_err(|e| AppError::WebDav(format!("删除失败: {e}")))
    }

    /// 列出 `.db` 备份（按修改时间倒序）。目录不存在时返回空列表。
    pub async fn list_backups(&self) -> AppResult<Vec<BackupFile>> {
        let entries = match self
            .client
            .list(&format!("/{}", self.base_dir), Depth::Number(1))
            .await
        {
            Ok(e) => e,
            Err(_) => return Ok(vec![]),
        };
        let mut out = Vec::new();
        for e in entries {
            if let ListEntity::File(f) = e {
                let name = f
                    .href
                    .rsplit('/')
                    .find(|s| !s.is_empty())
                    .unwrap_or("")
                    .to_string();
                if name.ends_with(".db") {
                    out.push(BackupFile {
                        filename: name,
                        size: f.content_length,
                        mod_time: f.last_modified.to_rfc3339(),
                    });
                }
            }
        }
        out.sort_by(|a, b| b.mod_time.cmp(&a.mod_time));
        Ok(out)
    }
}

fn normalize_base_dir(value: &str) -> AppResult<String> {
    let path = value.trim().trim_matches('/');
    if path.is_empty() {
        return Ok(DEFAULT_BASE_DIR.to_string());
    }

    let segments = path.split('/').collect::<Vec<_>>();
    if segments
        .iter()
        .any(|segment| segment.trim().is_empty() || *segment == "." || *segment == "..")
    {
        return Err(AppError::WebDav("备份路径不能包含空目录、. 或 ..".into()));
    }
    Ok(segments.join("/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_empty_path_to_ccmesh_directory() {
        assert_eq!(normalize_base_dir(" ").unwrap(), "ccMesh");
    }

    #[test]
    fn trims_surrounding_slashes() {
        assert_eq!(
            normalize_base_dir("/backups/ccmesh/").unwrap(),
            "backups/ccmesh"
        );
    }

    #[test]
    fn rejects_relative_segments() {
        assert!(normalize_base_dir("backups/../ccmesh").is_err());
    }
}
