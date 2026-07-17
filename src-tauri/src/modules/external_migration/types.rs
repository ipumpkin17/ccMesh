//! 外部迁移公共类型：与具体来源无关。

use serde::Serialize;

/// 适配器产出的端点候选（内部结构，非命令 payload）。
#[derive(Debug, Clone)]
pub struct MappedEndpoint {
    /// 勾选 / 导入用的稳定主键（来源内唯一）。
    pub source_id: String,
    /// 筛选维度（如 claude/codex；由各来源自定义）。
    pub category: String,
    pub name: String,
    /// 规整前的原始上游地址（导入阶段再 normalize）。
    pub raw_url: String,
    pub api_key: String,
    pub transformer: String,
    pub models_hint: Vec<String>,
    pub remark: String,
    /// `"ok"` | `"skipped"`。
    pub status: String,
    pub skip_reason: Option<String>,
}

impl MappedEndpoint {
    pub fn is_importable(&self) -> bool {
        self.status == "ok"
    }

    /// 可导入候选。
    pub fn ready(
        source_id: impl Into<String>,
        category: impl Into<String>,
        name: impl Into<String>,
        raw_url: impl Into<String>,
        api_key: impl Into<String>,
        transformer: impl Into<String>,
        models_hint: Vec<String>,
        remark: impl Into<String>,
    ) -> Self {
        Self {
            source_id: source_id.into(),
            category: category.into(),
            name: name.into(),
            raw_url: raw_url.into(),
            api_key: api_key.into(),
            transformer: transformer.into(),
            models_hint,
            remark: remark.into(),
            status: "ok".into(),
            skip_reason: None,
        }
    }

    /// 预览阶段即跳过的候选。
    pub fn skipped(
        source_id: impl Into<String>,
        category: impl Into<String>,
        name: impl Into<String>,
        transformer: impl Into<String>,
        remark: impl Into<String>,
        reason: impl Into<String>,
    ) -> Self {
        Self {
            source_id: source_id.into(),
            category: category.into(),
            name: name.into(),
            raw_url: String::new(),
            api_key: String::new(),
            transformer: transformer.into(),
            models_hint: vec![],
            remark: remark.into(),
            status: "skipped".into(),
            skip_reason: Some(reason.into()),
        }
    }
}

/// 预览项（命令 payload）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewItem {
    pub source_id: String,
    pub category: String,
    pub name: String,
    /// 规整前原始地址（ok 项有值；skipped 项为空）。
    pub api_url: String,
    /// 脱敏密钥：sk-***xxxx（仅展示用）。
    pub api_key_masked: String,
    pub transformer: String,
    pub models_hint: Vec<String>,
    /// `"ok"` | `"skipped"`。
    pub status: String,
    pub skip_reason: Option<String>,
}

impl PreviewItem {
    pub fn from_mapped(m: MappedEndpoint, api_key_masked: String) -> Self {
        Self {
            source_id: m.source_id,
            category: m.category,
            name: m.name,
            api_url: m.raw_url,
            api_key_masked,
            transformer: m.transformer,
            models_hint: m.models_hint,
            status: m.status,
            skip_reason: m.skip_reason,
        }
    }
}

/// 一条导入结果（命令 payload 项）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportItem {
    pub name: String,
    /// `"imported"` | `"skipped"`。
    pub status: String,
    pub model_count: usize,
    pub enabled: bool,
    pub skip_reason: Option<String>,
}

impl ImportItem {
    pub fn imported(name: impl Into<String>, model_count: usize, enabled: bool) -> Self {
        Self {
            name: name.into(),
            status: "imported".into(),
            model_count,
            enabled,
            skip_reason: None,
        }
    }

    pub fn skipped(name: impl Into<String>, reason: Option<String>) -> Self {
        Self {
            name: name.into(),
            status: "skipped".into(),
            model_count: 0,
            enabled: false,
            skip_reason: reason,
        }
    }
}

/// 导入摘要（命令 payload）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub total: usize,
    pub imported: usize,
    pub enabled_count: usize,
    pub disabled_no_models: usize,
    pub skipped: usize,
    pub items: Vec<ImportItem>,
}
