use serde::{Deserialize, Serialize};

/// 自动更新设置。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettings {
    pub auto_check: bool,
    pub check_interval: i64, // 小时；0 表示停止自动检查
    pub skipped_version: String,
    pub last_check_time: String,
}

impl Default for UpdateSettings {
    fn default() -> Self {
        Self {
            auto_check: true,
            check_interval: 24,
            skipped_version: String::new(),
            last_check_time: String::new(),
        }
    }
}

/// WebDAV 同步设置。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebDavConfig {
    pub url: String,
    pub username: String,
    pub password: String,
    pub config_path: String,
    pub stats_path: String,
}

/// 应用配置（key-value 表 `app_config` 组装，缺省回落 [`AppConfig::default`]）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub port: u16,
    pub log_level: String, // trace/debug/info/warn/error
    pub language: String,  // zh/en
    pub theme: String,     // system/light/dark
    pub theme_auto: bool,
    pub auto_light_start: String, // "HH:MM"
    pub auto_dark_start: String,  // "HH:MM"
    pub close_window_behavior: String, // quit/minimize/ask
    pub models_cache_ttl: i64,         // 分钟
    pub update: UpdateSettings,
    pub webdav: WebDavConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            port: 3000,
            log_level: "info".into(),
            language: "zh".into(),
            theme: "system".into(),
            theme_auto: false,
            auto_light_start: "07:00".into(),
            auto_dark_start: "19:00".into(),
            close_window_behavior: "ask".into(),
            models_cache_ttl: 30,
            update: UpdateSettings::default(),
            webdav: WebDavConfig::default(),
        }
    }
}
