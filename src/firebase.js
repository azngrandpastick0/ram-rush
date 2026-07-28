// Storage adapter backed by Upstash Redis REST API.
// Upstash free tier: 10K commands/day, no credit card required.
// Env vars: VITE_UPSTASH_URL and VITE_UPSTASH_TOKEN (set in .env locally,
// GitHub repo secrets for the Actions build).

const URL = import.meta.env.VITE_UPSTASH_URL;
const TOKEN = import.meta.env.VITE_UPSTASH_TOKEN;

async function redis(...args) {
  const res = await fetch(`${URL}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

export const storage = {
  async get(key) {
    const value = await redis("get", key);
    if (value === null) throw new Error(`Key not found: ${key}`);
    return { key, value, shared: true };
  },

  async set(key, value) {
    await redis("set", key, value);
    return { key, value, shared: true };
  },

  async delete(key) {
    await redis("del", key);
    return { key, deleted: true, shared: true };
  },

  // SCAN finds all keys matching a prefix — fine at league scale.
  async list(prefix = "") {
    const keys = [];
    let cursor = 0;
    do {
      const result = await redis("scan", cursor, "match", `${prefix}*`, "count", 100);
      cursor = parseInt(result[0]);
      keys.push(...result[1]);
    } while (cursor !== 0);
    return { keys, prefix, shared: true };
  },
};
