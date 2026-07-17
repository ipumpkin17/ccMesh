//! cc-switch 供应商行 → 公共 MappedEndpoint。

use serde_json::Value;

use crate::modules::external_migration::sources::cc_switch::reader::ProviderRow;
use crate::modules::external_migration::types::MappedEndpoint;

/// 解析单行为 MappedEndpoint。
pub fn map_row(row: &ProviderRow) -> MappedEndpoint {
    let settings: Value = serde_json::from_str(&row.settings_config).unwrap_or(Value::Null);
    let meta: Value = serde_json::from_str(&row.meta).unwrap_or(Value::Null);
    let source_id = selection_id(row);
    let remark = build_remark(row);
    let transformer = transformer_from(&meta, &row.app_type);

    if let Some(reason) = oauth_or_managed_skip(&meta) {
        return MappedEndpoint::skipped(
            source_id,
            row.app_type.clone(),
            row.name.clone(),
            transformer,
            remark,
            reason,
        );
    }

    let parsed = match row.app_type.as_str() {
        "claude" => parse_claude(&settings),
        "codex" => parse_codex(&settings),
        other => {
            return MappedEndpoint::skipped(
                source_id,
                row.app_type.clone(),
                row.name.clone(),
                transformer,
                remark,
                format!("unsupported_app:{other}"),
            );
        }
    };

    if let Some(reason) = credential_skip(&parsed) {
        return MappedEndpoint::skipped(
            source_id,
            row.app_type.clone(),
            row.name.clone(),
            transformer,
            remark,
            reason,
        );
    }

    MappedEndpoint::ready(
        source_id,
        row.app_type.clone(),
        row.name.clone(),
        parsed.raw_url,
        parsed.api_key,
        transformer,
        parsed.models_hint,
        remark,
    )
}

struct ParsedCredentials {
    raw_url: String,
    api_key: String,
    models_hint: Vec<String>,
}

fn selection_id(row: &ProviderRow) -> String {
    format!("{}:{}", row.app_type, row.id)
}

fn build_remark(row: &ProviderRow) -> String {
    let notes = row.notes.as_deref().unwrap_or("").trim();
    let tag = format!("[cc-switch:id={};app={}]", row.id, row.app_type);
    if notes.is_empty() {
        tag
    } else {
        format!("{notes} {tag}")
    }
}

/// 占位/无效密钥：OAuth/托管账号会写入这些占位值。
fn is_placeholder_key(key: &str) -> bool {
    let k = key.trim();
    k.is_empty() || k == "PROXY_MANAGED" || k.starts_with("${")
}

fn first_non_empty(obj: Option<&Value>, keys: &[&str]) -> String {
    let Some(map) = obj.and_then(Value::as_object) else {
        return String::new();
    };
    keys.iter()
        .filter_map(|k| map.get(*k).and_then(Value::as_str))
        .map(str::trim)
        .find(|s| !s.is_empty())
        .unwrap_or("")
        .to_string()
}

fn parse_claude(settings: &Value) -> ParsedCredentials {
    let env = settings.get("env");
    let raw_url = env
        .and_then(|e| e.get("ANTHROPIC_BASE_URL"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim_end_matches('/')
        .to_string();

    let top_key = settings
        .get("apiKey")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let api_key = if !top_key.is_empty() {
        top_key.to_string()
    } else {
        first_non_empty(env, &["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY"])
    };

    let models_hint = [
        "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        "ANTHROPIC_MODEL",
    ]
    .iter()
    .filter_map(|k| {
        env.and_then(|e| e.get(*k))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(String::from)
    })
    .collect();

    ParsedCredentials {
        raw_url,
        api_key,
        models_hint,
    }
}

fn parse_codex(settings: &Value) -> ParsedCredentials {
    let api_key = first_non_empty(settings.get("auth"), &["OPENAI_API_KEY"]);
    let config = settings
        .get("config")
        .and_then(Value::as_str)
        .unwrap_or("");
    let raw_url = codex_base_url_from_toml(config)
        .trim_end_matches('/')
        .to_string();

    let models_hint = toml::from_str::<toml::Value>(config)
        .ok()
        .and_then(|doc| {
            doc.get("model")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|m| vec![m.to_string()])
        })
        .unwrap_or_default();

    ParsedCredentials {
        raw_url,
        api_key,
        models_hint,
    }
}

/// 优先 active `model_providers.<name>.base_url`，回退顶层 `base_url`。
fn codex_base_url_from_toml(config: &str) -> String {
    let Ok(doc) = toml::from_str::<toml::Value>(config) else {
        return String::new();
    };
    let Ok(doc) = serde_json::to_value(doc) else {
        return String::new();
    };

    if let Some(active) = doc.get("model_provider").and_then(Value::as_str) {
        if let Some(base) = doc
            .get("model_providers")
            .and_then(|p| p.get(active))
            .and_then(|provider| provider.get("base_url"))
            .and_then(Value::as_str)
        {
            return base.to_string();
        }
    }
    doc.get("base_url")
        .and_then(Value::as_str)
        .map(String::from)
        .unwrap_or_default()
}

fn transformer_from(meta: &Value, app_type: &str) -> String {
    match meta.get("apiFormat").and_then(Value::as_str).unwrap_or("") {
        "anthropic" | "gemini_native" => "claude".into(),
        "openai_chat" | "openai_responses" => "openai".into(),
        _ if app_type == "codex" => "openai".into(),
        _ => "claude".into(),
    }
}

fn oauth_or_managed_skip(meta: &Value) -> Option<String> {
    if let Some(pt) = meta.get("providerType").and_then(Value::as_str) {
        if pt == "github_copilot" || pt == "codex_oauth" {
            return Some(format!("oauth:{pt}"));
        }
    }
    let managed = meta
        .get("authBinding")
        .and_then(|b| b.get("source"))
        .and_then(Value::as_str)
        == Some("managed_account");
    managed.then(|| "managed_account".into())
}

fn credential_skip(parsed: &ParsedCredentials) -> Option<String> {
    if parsed.raw_url.trim().is_empty() {
        Some("no_url".into())
    } else if is_placeholder_key(&parsed.api_key) {
        Some("no_key".into())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::external_migration::sources::cc_switch::reader::ProviderRow;

    fn row(app: &str, settings: &str, meta: &str) -> ProviderRow {
        ProviderRow {
            id: "p1".into(),
            app_type: app.into(),
            name: "Test".into(),
            settings_config: settings.into(),
            meta: meta.into(),
            notes: Some("自用".into()),
        }
    }

    #[test]
    fn claude_picks_auth_token_first() {
        let settings = r#"{"env":{"ANTHROPIC_BASE_URL":"https://api.x.com/v1/","ANTHROPIC_AUTH_TOKEN":"sk-auth","ANTHROPIC_API_KEY":"sk-key","ANTHROPIC_DEFAULT_SONNET_MODEL":"sonnet-x"}}"#;
        let m = map_row(&row("claude", settings, r#"{"apiFormat":"anthropic"}"#));
        assert_eq!(m.status, "ok");
        assert_eq!(m.raw_url, "https://api.x.com/v1");
        assert_eq!(m.api_key, "sk-auth");
        assert_eq!(m.transformer, "claude");
        assert_eq!(m.models_hint, vec!["sonnet-x".to_string()]);
        assert!(m.remark.contains("[cc-switch:id=p1;app=claude]"));
        assert_eq!(m.source_id, "claude:p1");
        assert_eq!(m.category, "claude");
    }

    #[test]
    fn claude_falls_back_to_api_key() {
        let settings =
            r#"{"env":{"ANTHROPIC_BASE_URL":"https://api.x.com","ANTHROPIC_API_KEY":"sk-key"}}"#;
        let m = map_row(&row("claude", settings, "{}"));
        assert_eq!(m.api_key, "sk-key");
        assert_eq!(m.transformer, "claude");
    }

    #[test]
    fn claude_top_apikey_preferred() {
        let settings = r#"{"env":{"ANTHROPIC_BASE_URL":"https://api.x.com","ANTHROPIC_AUTH_TOKEN":"sk-env"},"apiKey":"sk-top"}"#;
        let m = map_row(&row("claude", settings, "{}"));
        assert_eq!(m.api_key, "sk-top");
    }

    #[test]
    fn codex_parses_toml_active_provider() {
        let settings = r#"{"auth":{"OPENAI_API_KEY":"sk-or"},"config":"model_provider = \"OpenRouter\"\nmodel = \"gpt-5-codex\"\n[model_providers.OpenRouter]\nbase_url = \"https://openrouter.ai/api/v1\""}"#;
        let m = map_row(&row(
            "codex",
            settings,
            r#"{"apiFormat":"openai_responses"}"#,
        ));
        assert_eq!(m.status, "ok");
        assert_eq!(m.api_key, "sk-or");
        assert_eq!(m.raw_url, "https://openrouter.ai/api/v1");
        assert_eq!(m.transformer, "openai");
        assert_eq!(m.models_hint, vec!["gpt-5-codex".to_string()]);
    }

    #[test]
    fn codex_base_url_top_level_fallback() {
        let settings =
            r#"{"auth":{"OPENAI_API_KEY":"sk"},"config":"base_url = \"https://api.o.com/v1\""}"#;
        let m = map_row(&row("codex", settings, "{}"));
        assert_eq!(m.raw_url, "https://api.o.com/v1");
        assert_eq!(m.transformer, "openai");
    }

    #[test]
    fn skip_oauth_provider_type() {
        let m = map_row(&row("claude", "{}", r#"{"providerType":"github_copilot"}"#));
        assert_eq!(m.status, "skipped");
        assert_eq!(m.skip_reason.as_deref(), Some("oauth:github_copilot"));
    }

    #[test]
    fn skip_managed_account() {
        let m = map_row(&row(
            "claude",
            "{}",
            r#"{"authBinding":{"source":"managed_account"}}"#,
        ));
        assert_eq!(m.status, "skipped");
        assert_eq!(m.skip_reason.as_deref(), Some("managed_account"));
    }

    #[test]
    fn skip_no_url() {
        let settings = r#"{"env":{"ANTHROPIC_AUTH_TOKEN":"sk"}}"#;
        let m = map_row(&row("claude", settings, "{}"));
        assert_eq!(m.status, "skipped");
        assert_eq!(m.skip_reason.as_deref(), Some("no_url"));
    }

    #[test]
    fn skip_placeholder_key() {
        let settings =
            r#"{"env":{"ANTHROPIC_BASE_URL":"https://x.com","ANTHROPIC_API_KEY":"PROXY_MANAGED"}}"#;
        let m = map_row(&row("claude", settings, "{}"));
        assert_eq!(m.status, "skipped");
        assert_eq!(m.skip_reason.as_deref(), Some("no_key"));
    }

    #[test]
    fn skip_template_var_key() {
        let settings = r#"{"env":{"ANTHROPIC_BASE_URL":"https://x.com","ANTHROPIC_AUTH_TOKEN":"${CC_TOKEN}"}}"#;
        let m = map_row(&row("claude", settings, "{}"));
        assert_eq!(m.status, "skipped");
        assert_eq!(m.skip_reason.as_deref(), Some("no_key"));
    }

    #[test]
    fn selection_id_is_app_type_scoped() {
        let claude = row(
            "claude",
            r#"{"env":{"ANTHROPIC_BASE_URL":"https://a.com","ANTHROPIC_API_KEY":"sk-a"}}"#,
            "{}",
        );
        let codex = row(
            "codex",
            r#"{"auth":{"OPENAI_API_KEY":"sk-b"},"config":"base_url = \"https://b.com/v1\""}"#,
            "{}",
        );
        let m1 = map_row(&claude);
        let m2 = map_row(&codex);
        assert_eq!(m1.source_id, "claude:p1");
        assert_eq!(m2.source_id, "codex:p1");
        assert_ne!(m1.source_id, m2.source_id);
    }

    #[test]
    fn remark_without_notes() {
        let mut r = row(
            "claude",
            r#"{"env":{"ANTHROPIC_BASE_URL":"https://a.com","ANTHROPIC_API_KEY":"sk"}}"#,
            "{}",
        );
        r.notes = None;
        let m = map_row(&r);
        assert_eq!(m.remark, "[cc-switch:id=p1;app=claude]");
    }
}
