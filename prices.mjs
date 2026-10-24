// prices.mjs: list prices in US dollars per million tokens, from
// https://platform.claude.com/docs/en/about-claude/pricing on 2026-10-24.
// They only drive the running cost shown while a run is going. The cost a run ends with is the
// Agent SDK's own count (total_cost_usd); your Console bill is the real one.
export const PRICES_CHECKED = '2026-10-24';

export const MODELS = {
  'claude-opus-5-5':   { name: 'Opus 5.5',   alias: 'opus',   in: 4,    write5m: 5,     write1h: 8,    read: 0.20, out: 20 },
  'claude-sonnet-5-5': { name: 'Sonnet 5.5', alias: 'sonnet', in: 2,    write5m: 2.50,  write1h: 4,    read: 0.10, out: 10 },
  'claude-haiku-5-5':  { name: 'Haiku 5.5',  alias: 'haiku',  in: 0.10, write5m: 0.125, write1h: 0.20, read: 0.01, out: 0.50,
                         // prompts over 100K tokens
                         long: { over: 100_000, in: 0.50, write5m: 0.625, write1h: 1, read: 0.05, out: 2.50 } },
  'claude-fable-5-1':  { name: 'Fable 5.1',  alias: 'fable',  in: 10,   write5m: 12.50, write1h: 20,   read: 0.25, out: 50 },
};

export function modelId(nameOrAlias) {
  const hit = Object.entries(MODELS).find(([, m]) => m.alias === nameOrAlias);
  return hit ? hit[0] : nameOrAlias;
}

export const displayName = id => MODELS[id]?.name ?? id;

// What one API response cost, from its usage block (null for a model not in the table)
export function costOf(id, usage) {
  let p = MODELS[id];
  if (!p || !usage) return null;
  const written = usage.cache_creation_input_tokens ?? 0;
  const w1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const w5m = usage.cache_creation ? (usage.cache_creation.ephemeral_5m_input_tokens ?? 0) : written;
  const prompt = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + written;
  if (p.long && prompt > p.long.over) p = p.long;
  return ((usage.input_tokens ?? 0) * p.in + (usage.cache_read_input_tokens ?? 0) * p.read
    + w5m * p.write5m + w1h * p.write1h + (usage.output_tokens ?? 0) * p.out) / 1e6;
}
