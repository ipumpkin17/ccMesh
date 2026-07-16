# 快速队列跨协议抢占根因

## 现象

只把一个 `codex` Responses 端点加入快速队列后，Claude Code 请求也使用同一端点，并出现上游找不到模型或协议不匹配错误。

## 根因

`endpoint_repo::list_routable` 在不知道入站协议的情况下，只要数据库存在任意启用快速端点，就丢弃全部普通端点。`handle_proxy` 随后才识别 `/v1/messages`、`/v1/chat/completions` 和 `/v1/responses`，且 Claude 分支原本没有排除 `OpenAiResponses`。

因此，一个 Codex 快速端点会成为 Claude 请求的唯一候选；出站逻辑又只对 `OpenAiChat` 做 Claude 转换，最终把 Claude 路径和请求体原样发送给 Responses 上游。

## 修复边界

协议筛选属于代理选路语义，不应下沉到存储仓储层。仓储层返回全部启用端点，代理层根据当前入站协议形成兼容候选，然后在该候选集合内选择快速子集。

候选集合会继续受模型过滤和熔断状态影响，因此轮换状态不能保存数组下标。轮换器按入站协议保存稳定端点 ID，每次在当前候选中重新定位索引，避免手动切换和跨协议请求互相扰动。
