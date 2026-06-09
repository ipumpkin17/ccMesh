# metadata 透传问题评估（是不是 bug）

> 结论：**不是 bug**。Claude→OpenAI 转换时丢弃 `metadata` 是**正确且有意**的行为，与参考实现 cc-switch 的刻意设计一致。需求文档 `metadata-passthrough-requirement.txt` 的推断链有误。

## 1. 事实确认（我方代码）

`src-tauri/src/modules/transform/claude_openai.rs::claude_request_to_openai` 只产出：
model / max_tokens→max_completion_tokens / temperature / stream(+stream_options) / messages / tools+tool_choice。
**确实不复制 `metadata`** —— 这点需求文档说对了。

## 2. 参考实现 cc-switch 怎么做（决定性证据）

`E:\myCode\cc-switch\src-tauri\src\proxy\providers\transform.rs::anthropic_to_openai_with_reasoning_content`（:115-235）
是 cc-switch 的 Claude→OpenAI 顶层请求构建器。它只复制：
model / messages / max_tokens(或 max_completion_tokens) / temperature / top_p / stop(from stop_sequences) / stream / reasoning_effort / tools / tool_choice。
**同样不转发 `metadata`**。且函数 docstring 明确写：
> "默认转换保持通用 OpenAI-compatible 请求体，**避免向严格后端发送未知字段**。"
还有专门测试 `test_anthropic_to_openai_does_not_inject_prompt_cache_key`（:1190）守护"不要注入额外字段"。

cc-switch 里 `metadata.user_id/session_id` 的所有使用（forwarder.rs:1186-1205、copilot_optimizer.rs:352、session.rs）
都是**读取入站 body 的 metadata 供自己做会话追踪/子代理识别**，**不是**把 metadata 转发给上游 OpenAI。
→ 需求文档把"cc-switch 读入站 metadata 做日志"误当成"下游需要被转发 metadata"，是概念混淆。

## 3. OpenAI 语义

- OpenAI Chat Completions 的 `metadata` 是配合 `store:true` 的用户自定义标签（≤16 键、值为字符串），**不做会话固定**。
- Anthropic 的 `metadata.user_id` 是滥用监控用途，OpenAI 兼容后端**不消费**它做会话管理。
- 把 Anthropic 风格 metadata 塞进 OpenAI 请求，对严格后端反而有**被拒未知字段**的风险——正是 cc-switch 要规避的。

## 4. 需求文档推断链的漏洞

1. **概念混淆**：把"读入站 metadata"当成"需转发 metadata"（见 §2）。
2. **下游对象错位**：文档列的下游 sub2api/cc-switch 是 **Claude 格式**代理；走 Claude→OpenAI 转换时上游是 **OpenAI 后端**，根本不是它们。而 Claude→Claude 直通路径 metadata 本就 `body.clone()` 保留、不丢。
3. **会话标识已有通道**：文档自己 §2.1 已说明 `session_id/x-session-id/conversation_id` 等**头部已自动透传**；需要会话标识的下游读头部即可，body.metadata 对 OpenAI 路径是冗余且非标准的通道。

## 5. 结论与建议

- **不是 bug，建议不改**：保持与 cc-switch 一致（不向 OpenAI 转发未知字段），避免严格后端兼容问题。
- **唯一可能要改的特例**：用户的下游是一个**非标准、会读 body.metadata.user_id 做会话固定的 OpenAI 兼容中转**。此种情况才考虑加**可选/带开关**的透传；默认仍不开，以免裹挟其它后端。
- 若用户确认无此特例 → 将本任务标记 rejected（not-a-bug），不动代码。
