import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchIGDailyInsights,
  fetchIGPosts,
  fetchIGStories,
} from "@/lib/social/api";
import type { SocialPost } from "@/lib/social/api";

// Allow up to 5 minutes for the backfill
export const maxDuration = 300;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  const syncSecret = request.headers.get("x-sync-secret") ?? bearer;

  const validSync = process.env.SYNC_SECRET && syncSecret === process.env.SYNC_SECRET;
  const validCron = process.env.CRON_SECRET && bearer === process.env.CRON_SECRET;

  if (!validSync && !validCron) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const dateFrom: string = body.date_from ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const dateTo:   string = body.date_to   ?? dateFrom;

  const supabase = createAdminClient();
  const fallbackToken = process.env.META_ACCESS_TOKEN;

  const { data: accounts, error: accErr } = await supabase
    .from("social_accounts")
    .select(`
      id, platform, platform_account_id, fb_page_id, account_name,
      client:clients(group:groups(tenant:tenants(meta_access_token)))
    `)
    .eq("is_active", true)
    .eq("platform", "instagram"); // Facebook removed — only IG is synced

  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
  if (!accounts?.length) return NextResponse.json({ synced: 0, message: "Nenhuma conta social configurada" });

  // Process all accounts in parallel
  const settled = await Promise.allSettled(
    accounts.map((account) => {
      type ClientJoin = { group: { tenant: { meta_access_token: string | null } } | null } | null;
      const tenantToken = (account.client as unknown as ClientJoin)?.group?.tenant?.meta_access_token;
      const token = tenantToken || fallbackToken;
      if (!token) throw new Error(`Nenhum token Meta configurado para ${account.account_name}`);
      return syncAccount(account, dateFrom, dateTo, token, supabase);
    })
  );

  const results = settled.map((s, i) => {
    const account = accounts[i];
    const label = account.account_name ?? account.platform_account_id;
    if (s.status === "fulfilled") {
      return { account: label, platform: account.platform, ok: true };
    }
    return {
      account: label,
      platform: account.platform,
      ok: false,
      error: s.reason instanceof Error ? s.reason.message : "Erro desconhecido",
    };
  });

  return NextResponse.json({
    synced:    results.filter((r) => r.ok).length,
    failed:    results.filter((r) => !r.ok).length,
    date_from: dateFrom,
    date_to:   dateTo,
    results,
  });
}

// Vercel Cron sends GET
export const GET = POST;

// ─── Per-account sync ─────────────────────────────────────────────────────────

async function syncAccount(
  account: { id: string; platform: string; platform_account_id: string; account_name: string | null },
  dateFrom: string,
  dateTo: string,
  token: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  // All accounts at this point are Instagram-only (FB was removed)
  const igId = account.platform_account_id;

  const [insightsResult, postsResult, storiesResult] = await Promise.allSettled([
    fetchIGDailyInsights(igId, dateFrom, dateTo, token),
    fetchIGPosts(igId, token),
    fetchIGStories(igId, token),
  ]);

  const insights = insightsResult.status === "fulfilled" ? insightsResult.value : [];
  const posts    = postsResult.status    === "fulfilled" ? postsResult.value    : [];
  const stories  = storiesResult.status  === "fulfilled" ? storiesResult.value  : [];

  // Posts/stories errors are surfaced; insights failure is acceptable
  if (postsResult.status === "rejected") {
    throw postsResult.reason;
  }

  // ── Upsert daily insights ─────────────────────────────────────────────────
  if (insights.length > 0) {
    const rows = insights
      .filter((d) => d.date >= dateFrom && d.date <= dateTo)
      .map((d) => ({
        social_account_id: account.id,
        date:              d.date,
        impressions:       d.impressions,
        reach:             d.reach,
        views:             d.views,
        views_organic:     d.views_organic,
        views_paid:        d.views_paid,
        interactions:      d.interactions,
        profile_visits:    d.profile_visits,
        link_clicks:       d.link_clicks,
        followers_gained:  d.followers_gained,
        video_views_3s:    d.video_views_3s,
        watch_time_ms:     d.watch_time_ms,
        unique_viewers:    d.unique_viewers,
        updated_at:        new Date().toISOString(),
      }));

    if (rows.length > 0) {
      const { error: insErr } = await supabase
        .from("social_insights_daily")
        .upsert(rows, { onConflict: "social_account_id,date" });
      if (insErr) throw new Error(`insights upsert: ${insErr.message}`);
    }
  }

  // ── Upsert posts + stories (stories don't get thumbnail uploads) ─────────
  await Promise.allSettled([
    ...posts.map((post) => upsertPost(post, account.id, token, supabase)),
    ...stories.map((story) => upsertPost(story, account.id, token, supabase)),
  ]);
}

async function upsertPost(
  post: SocialPost,
  accountId: string,
  _token: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  let storageUrl: string | null = null;
  if (post.thumbnail_url) {
    try {
      storageUrl = await uploadThumbnail(post.platform_post_id, post.thumbnail_url, supabase);
    } catch { /* non-critical */ }
  }

  await supabase.from("social_posts").upsert(
    {
      social_account_id:     accountId,
      platform_post_id:      post.platform_post_id,
      platform:              post.platform,
      media_type:            post.media_type,
      caption:               post.caption,
      permalink:             post.permalink,
      thumbnail_url:         post.thumbnail_url,
      thumbnail_storage_url: storageUrl,
      published_at:          post.published_at,
      views:                 post.views,
      reach:                 post.reach,
      impressions:           post.impressions,
      likes:                 post.likes,
      comments:              post.comments,
      shares:                post.shares,
      saves:                 post.saves,
      reel_plays:            post.reel_plays,
      engagement_rate:       post.engagement_rate,
      taps_forward:          post.taps_forward,
      taps_back:             post.taps_back,
      exits:                 post.exits,
      replies_count:         post.replies_count,
      updated_at:            new Date().toISOString(),
    },
    { onConflict: "platform_post_id" }
  );
}

// ─── Storage helper ───────────────────────────────────────────────────────────

async function uploadThumbnail(
  postId: string,
  url: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://www.facebook.com/",
    },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const path = `organic/${postId}.jpg`;

  const { error } = await supabase.storage
    .from("thumbnails")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("thumbnails").getPublicUrl(path);
  return data.publicUrl;
}
