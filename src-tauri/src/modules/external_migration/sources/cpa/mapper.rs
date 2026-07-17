//! CPA YAML 根对象 → 公共 MappedEndpoint 列表。

use std::collections::HashMap;

use serde_json::Value;

use crate::modules::external_migration::types::MappedEndpoint;

const CAT_OPENAI: &str = "openai-compat";
const CAT_CODEX: &str = "codex";
const CAT_CLAUDE: &str = "claude";

/// 将 CPA 配置根节点展开为候选端点（一条 key 一项）。
pub fn map_config(root: &Value) -> Vec<MappedEndpoint> {
    let mut out = Vec::new();
    out.extend(map_openai_compatibility(root.get("openai-compatibility")));
    out.extend(map_keyed_providers(
        root.get("codex-api-key"),
        CAT_CODEX,
        "openai",
        "codex",
    ));
    out.extend(map_keyed_providers(
        root.get("claude-api-key"),
        CAT_CLAUDE,
        "claude",
        "claude",
    ));
    out
}

/// 映射用的凭证草稿；校验后转为 `MappedEndpoint`。
struct CredentialDraft {
    source_id: String,
    category: &'static str,
    name: String,
    raw_url: String,
    api_key: String,
    transformer: &'static str,
    remark: String,
}

impl CredentialDraft {
    fn into_endpoint(self) -> MappedEndpoint {
        if self.raw_url.trim().is_empty() {
            return MappedEndpoint::skipped(
                self.source_id,
                self.category,
                self.name,
                self.transformer,
                self.remark,
                "no_url",
            );
        }
        if self.api_key.trim().is_empty() {
            return MappedEndpoint::skipped(
                self.source_id,
                self.category,
                self.name,
                self.transformer,
                self.remark,
                "no_key",
            );
        }
        MappedEndpoint::ready(
            self.source_id,
            self.category,
            self.name,
            self.raw_url.trim_end_matches('/').to_string(),
            self.api_key,
            self.transformer,
            vec![],
            self.remark,
        )
    }
}

fn map_openai_compatibility(node: Option<&Value>) -> Vec<MappedEndpoint> {
    let Some(providers) = node.and_then(Value::as_array) else {
        return Vec::new();
    };

    let mut out = Vec::new();
    for (provider_idx, provider) in providers.iter().enumerate() {
        let display_name = non_empty_str(provider, "name")
            .unwrap_or_else(|| format!("OpenAI 兼容 {provider_idx}"));
        let base_url = first_str(provider, &["base-url", "base_url"]);
        let keys = collect_openai_keys(provider);

        if keys.is_empty() {
            out.push(
                CredentialDraft {
                    source_id: format!("openai-compat:{provider_idx}:0"),
                    category: CAT_OPENAI,
                    name: display_name.clone(),
                    raw_url: base_url,
                    api_key: String::new(),
                    transformer: "openai",
                    remark: format!("[cpa:openai-compat:name={display_name}]"),
                }
                .into_endpoint(),
            );
            continue;
        }

        let key_count = keys.len();
        for (key_idx, api_key) in keys.into_iter().enumerate() {
            out.push(
                CredentialDraft {
                    source_id: format!("openai-compat:{provider_idx}:{key_idx}"),
                    category: CAT_OPENAI,
                    name: numbered_name(&display_name, key_idx, key_count),
                    raw_url: base_url.clone(),
                    api_key,
                    transformer: "openai",
                    remark: format!(
                        "[cpa:openai-compat:name={display_name};key={key_idx}]"
                    ),
                }
                .into_endpoint(),
            );
        }
    }
    out
}

/// `codex-api-key` / `claude-api-key` 列表：每项一把 key。
fn map_keyed_providers(
    node: Option<&Value>,
    category: &'static str,
    transformer: &'static str,
    source_tag: &str,
) -> Vec<MappedEndpoint> {
    let Some(entries) = node.and_then(Value::as_array) else {
        return Vec::new();
    };

    let mut used_names: HashMap<String, usize> = HashMap::new();
    let mut out = Vec::new();

    for (idx, entry) in entries.iter().enumerate() {
        let base_url = first_str(entry, &["base-url", "base_url"]);
        let api_key = first_str(entry, &["api-key", "api_key"]);
        let preferred_name = non_empty_str(entry, "name")
            .or_else(|| host_label(&base_url))
            .unwrap_or_else(|| format!("{source_tag} {idx}"));
        let name = allocate_unique_name(preferred_name, &mut used_names);

        out.push(
            CredentialDraft {
                source_id: format!("{source_tag}:{idx}"),
                category,
                name,
                raw_url: base_url.clone(),
                api_key,
                transformer,
                remark: format!("[cpa:{source_tag}:base={base_url};idx={idx}]"),
            }
            .into_endpoint(),
        );
    }
    out
}

/// 同一批导入内：首次用原名，后续 `name #2`、`name #3`…
fn allocate_unique_name(base: String, used: &mut HashMap<String, usize>) -> String {
    let count = used.entry(base.clone()).or_insert(0);
    let name = if *count == 0 {
        base
    } else {
        format!("{base} #{}", *count + 1)
    };
    *count += 1;
    name
}

fn collect_openai_keys(provider: &Value) -> Vec<String> {
    if let Some(keys) = keys_from_entries(provider) {
        if !keys.is_empty() {
            return keys;
        }
    }
    if let Some(key) = non_empty_str(provider, "api-key").or_else(|| non_empty_str(provider, "api_key"))
    {
        return vec![key];
    }
    string_array(provider, &["api-keys", "api_keys"])
}

fn keys_from_entries(provider: &Value) -> Option<Vec<String>> {
    let entries = provider
        .get("api-key-entries")
        .or_else(|| provider.get("api_key_entries"))?
        .as_array()?;
    Some(
        entries
            .iter()
            .map(|e| first_str(e, &["api-key", "api_key"]))
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty())
            .collect(),
    )
}

fn string_array(obj: &Value, keys: &[&str]) -> Vec<String> {
    keys.iter()
        .find_map(|k| obj.get(*k).and_then(Value::as_array))
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect()
        })
        .unwrap_or_default()
}

fn numbered_name(base: &str, key_idx: usize, total_keys: usize) -> String {
    if total_keys <= 1 || key_idx == 0 {
        base.to_string()
    } else {
        format!("{base} #{}", key_idx + 1)
    }
}

fn host_label(raw_url: &str) -> Option<String> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return None;
    }
    let rest = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);
    let hostport = rest.split('/').next().unwrap_or(rest);
    let host = hostport
        .rsplit('@')
        .next()
        .unwrap_or(hostport)
        .split(':')
        .next()
        .unwrap_or(hostport)
        .trim();
    if host.is_empty() {
        None
    } else {
        Some(host.to_string())
    }
}

fn non_empty_str(obj: &Value, key: &str) -> Option<String> {
    obj.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
}

fn first_str(obj: &Value, keys: &[&str]) -> String {
    keys.iter()
        .find_map(|k| non_empty_str(obj, k))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn openai_compat_splits_keys_and_names() {
        let root = json!({
            "openai-compatibility": [{
                "name": "黑与白",
                "base-url": "https://ai.hybgzs.com/v1",
                "api-key-entries": [
                    {"api-key": "sk-a"},
                    {"api-key": "sk-b"}
                ]
            }]
        });
        let items = map_config(&root);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "黑与白");
        assert_eq!(items[1].name, "黑与白 #2");
        assert_eq!(items[0].category, CAT_OPENAI);
        assert_eq!(items[0].transformer, "openai");
        assert_eq!(items[0].raw_url, "https://ai.hybgzs.com/v1");
        assert_eq!(items[0].api_key, "sk-a");
        assert!(items[0].is_importable());
        assert!(items[0].remark.contains("[cpa:openai-compat:"));
        assert!(items[0].remark.contains("key=0"));
    }

    #[test]
    fn openai_compat_skips_missing_key() {
        let root = json!({
            "openai-compatibility": [{
                "name": "empty",
                "base-url": "https://x.com/v1",
                "api-key-entries": []
            }]
        });
        let items = map_config(&root);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].status, "skipped");
        assert_eq!(items[0].skip_reason.as_deref(), Some("no_key"));
    }

    #[test]
    fn codex_uses_host_and_numbers_duplicates() {
        let root = json!({
            "codex-api-key": [
                {"api-key": "sk-1", "base-url": "https://api.ark717.com"},
                {"api-key": "sk-2", "base-url": "https://api.ark717.com/v1"},
                {"api-key": "sk-3", "base-url": "https://runanytime.hxi.me"}
            ]
        });
        let items = map_config(&root);
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].name, "api.ark717.com");
        assert_eq!(items[1].name, "api.ark717.com #2");
        assert_eq!(items[2].name, "runanytime.hxi.me");
        assert_eq!(items[0].category, CAT_CODEX);
        assert_eq!(items[0].transformer, "openai");
        assert!(items[0].models_hint.is_empty());
    }

    #[test]
    fn claude_maps_transformer() {
        let root = json!({
            "claude-api-key": [{
                "api-key": "sk-c",
                "base-url": "https://api.anthropic.com",
                "name": "官方"
            }]
        });
        let items = map_config(&root);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "官方");
        assert_eq!(items[0].category, CAT_CLAUDE);
        assert_eq!(items[0].transformer, "claude");
        assert_eq!(items[0].source_id, "claude:0");
    }

    #[test]
    fn ignores_unrelated_sections() {
        let root = json!({
            "port": 8317,
            "routing": {"strategy": "round-robin"},
            "gemini-api-key": [{"api-key": "x", "base-url": "https://g.com"}]
        });
        assert!(map_config(&root).is_empty());
    }

    #[test]
    fn host_label_strips_path() {
        assert_eq!(
            host_label("https://api.example.com/v1").as_deref(),
            Some("api.example.com")
        );
    }
}
