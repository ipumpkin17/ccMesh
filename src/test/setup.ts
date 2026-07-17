import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// mock Tauri IPC，使前端逻辑可在 jsdom 下测试
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation(async (cmd: string) => {
    // 列表类命令返回空数组，避免 React Query 收到 undefined
    if (cmd === 'list_endpoints' || cmd === 'list_archived_endpoints') return []
    return undefined
  }),
}))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

// mock @lobehub/icons：真实包经 @lobehub/ui 间接引入 @emoji-mart/data 的 JSON 导入，
// 在 vitest(Node ESM) 下触发 "needs import attribute type:json" 错误。
// 测试只需图标为可渲染占位组件，不需要真实 SVG。
vi.mock('@lobehub/icons', () => {
  // stub：可调用（当组件渲染）；.Color/.Avatar 等属性访问返回自身，支持 X.Color 形式

  const stub: any = () => null
  stub.Color = stub
  stub.Avatar = stub
  stub.Mono = stub
  stub.Combine = stub
  stub.Text = stub
  // 覆盖 model-icons.tsx / EndpointCard / RequestMonitor 用到的全部品牌名
  const brands = [
    'Anthropic',
    'Aws',
    'Azure',
    'Cerebras',
    'Claude',
    'ClaudeCode',
    'Cloudflare',
    'Cohere',
    'Codex',
    'DeepSeek',
    'Doubao',
    'Fireworks',
    'Gemma',
    'Gemini',
    'Google',
    'Grok',
    'Groq',
    'HuggingFace',
    'Hunyuan',
    'InternLM',
    'Kimi',
    'KwaiKAT',
    'Meta',
    'Microsoft',
    'Minimax',
    'Mistral',
    'Nvidia',
    'Novita',
    'Ollama',
    'OpenAI',
    'OpenCode',
    'OpenRouter',
    'Perplexity',
    'Qwen',
    'Replicate',
    'SambaNova',
    'SiliconCloud',
    'Spark',
    'Stepfun',
    'Together',
    'Volcengine',
    'Wenxin',
    'XiaomiMiMo',
    'Yi',
    'Zhipu',
  ]
  const mod: Record<string, unknown> = {}
  for (const b of brands) mod[b] = stub
  return mod
})
