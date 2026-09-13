import type { Post } from "./types";

// KV レイアウト
//   post:<id>        -> Post (JSON)
//   index:all        -> string[] (id)
//   index:<author>   -> string[] (id)
// Workers 外（KV binding が無い環境）ではプロセス内メモリにフォールバックする

type KVLike = {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
};

const memory = new Map<string, string>();
const memoryKV: KVLike = {
  async get(key) {
    const v = memory.get(key);
    return v === undefined ? null : JSON.parse(v);
  },
  async put(key, value) {
    memory.set(key, value);
  },
};

let warned = false;

export async function getEnv(): Promise<Record<string, unknown>> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx.env ?? {}) as unknown as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function kv(): Promise<KVLike> {
  const env = await getEnv();
  const binding = env.POSTS as KVLike | undefined;
  if (binding) return binding;
  if (!warned) {
    warned = true;
    console.warn("[store] KV binding POSTS が無いため、メモリに保存します（プロセス終了で消えます）");
  }
  return memoryKV;
}

async function readIndex(store: KVLike, key: string): Promise<string[]> {
  const v = (await store.get(key, "json")) as string[] | null;
  return Array.isArray(v) ? v : [];
}

export async function putPosts(posts: Post[], reset = false): Promise<number> {
  const store = await kv();
  const all = reset ? [] : await readIndex(store, "index:all");
  const byAuthor = new Map<string, string[]>();
  for (const p of posts) {
    await store.put(`post:${p.id}`, JSON.stringify(p));
    if (!all.includes(p.id)) all.push(p.id);
    if (!byAuthor.has(p.author)) {
      byAuthor.set(p.author, reset ? [] : await readIndex(store, `index:${p.author}`));
    }
    const ids = byAuthor.get(p.author)!;
    if (!ids.includes(p.id)) ids.push(p.id);
  }
  await store.put("index:all", JSON.stringify(all));
  for (const [author, ids] of byAuthor) {
    await store.put(`index:${author}`, JSON.stringify(ids));
  }
  return posts.length;
}

export async function putPost(post: Post): Promise<Post> {
  await putPosts([post]);
  return post;
}

export async function getPost(id: string): Promise<Post | null> {
  const store = await kv();
  return ((await store.get(`post:${id}`, "json")) as Post | null) ?? null;
}

export async function listPosts(author?: string): Promise<Post[]> {
  const store = await kv();
  const ids = await readIndex(store, author ? `index:${author}` : "index:all");
  const posts = await Promise.all(ids.map((id) => store.get(`post:${id}`, "json")));
  return (posts.filter(Boolean) as Post[]).sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}
