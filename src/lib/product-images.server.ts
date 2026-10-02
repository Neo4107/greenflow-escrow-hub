import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "product-images";
const TTL_SECONDS = 60 * 60 * 24; // 1 day

/**
 * Product `images` hold either full URLs (legacy) or storage paths inside the
 * private product-images bucket. Swap storage paths for signed URLs.
 */
export async function resolveProductImages<T extends { images: string[] | null }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  products: T[],
): Promise<T[]> {
  const paths = [
    ...new Set(products.flatMap((p) => (p.images ?? []).filter((i) => !/^https?:\/\//.test(i)))),
  ];
  if (paths.length === 0) return products;

  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, TTL_SECONDS);
  const map = new Map<string, string>();
  for (const row of data ?? []) if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);

  return products.map((p) => ({
    ...p,
    images: (p.images ?? [])
      .map((i) => (/^https?:\/\//.test(i) ? i : map.get(i)))
      .filter((i): i is string => Boolean(i)),
  }));
}
