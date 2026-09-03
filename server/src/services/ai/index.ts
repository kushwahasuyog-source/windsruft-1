import { AppError } from '../../errors';

export interface AiOptions { system: string; prompt: string; maxTokens?: number }
export async function runAi(options: AiOptions): Promise<string> {
  const key = process.env.AI_API_KEY;
  if (!key || !process.env.AI_PROVIDER) throw new AppError('ENGINE_UNAVAILABLE', 503, 'AI provider is not configured on this deployment. Set AI_PROVIDER, AI_API_KEY, AI_BASE_URL, and AI_MODEL.');
  try {
    const response = await fetch(`${(process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.AI_MODEL ?? 'gpt-4o-mini', messages: [{ role: 'system', content: options.system }, { role: 'user', content: options.prompt }], max_tokens: options.maxTokens ?? 2000 }),
    });
    if (!response.ok) throw new Error('provider error');
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    if (!body.choices?.[0]?.message?.content) throw new Error('empty response');
    return body.choices[0].message.content;
  } catch {
    throw new AppError('ENGINE_UNAVAILABLE', 503, 'The configured AI provider could not complete this request.');
  }
}
