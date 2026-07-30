const GRAPH = "https://graph.facebook.com/v23.0";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocialDailyInsights {
  date: string; // YYYY-MM-DD
  impressions: number;
  reach: number;
  views: number;
  views_organic: number;
  views_paid: number;
  interactions: number;
  profile_visits: number;
  link_clicks: number;
  followers_gained: number;
  video_views_3s: number;
  watch_time_ms: number;
  unique_viewers: number;
}

export interface SocialPost {
  platform_post_id: string;
  platform: "instagram" | "facebook";
  media_type: string | null; // IMAGE | VIDEO | CAROUSEL_ALBUM | REELS | STORY
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  published_at: string; // ISO
  views: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reel_plays: number;
  engagement_rate: number | null;
  // Story-specific (null for non-story posts)
  taps_forward: number;
  taps_back: number;
  exits: number;
  replies_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUnix(dateStr: string): number {
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

function safeNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function daysInRange(dateFrom: string, dateTo: string): string[] {
  const days: string[] = [];
  const cur = new Date(dateFrom + "T00:00:00Z");
  const end = new Date(dateTo + "T00:00:00Z");
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

// ─── Instagram ────────────────────────────────────────────────────────────────
//
// Meta API v23 splits IG insights into two types:
//   - time_series (default): `reach` — supports multi-day range with values[] array
//   - total_value: `views`, `profile_views`, `website_clicks`, `accounts_engaged`,
//     `follower_count` — returns a single aggregate; must be called per day

export async function fetchIGDailyInsights(
  igAccountId: string,
  dateFrom: string,
  dateTo: string,
  token: string
): Promise<SocialDailyInsights[]> {
  const since = toUnix(dateFrom);
  const until = toUnix(dateTo) + 86400;

  // byDate is keyed by end_time date (Meta's convention: one day ahead of the data day)
  const byDate: Record<string, Partial<SocialDailyInsights>> = {};

  // ── Call 1: time-series metrics over the full range ──
  // follower_count is time-series (incompatible with metric_type=total_value)
  const tsUrl =
    `${GRAPH}/${igAccountId}/insights` +
    `?metric=reach,follower_count&period=day&since=${since}&until=${until}` +
    `&access_token=${token}`;

  const tsRes = await fetch(tsUrl, { cache: "no-store" });
  const tsData = await tsRes.json();
  if (tsData.error) throw new Error(`IG insights (${igAccountId}): ${tsData.error.message}`);

  for (const metric of (tsData.data ?? []) as {
    name: string;
    values: { value: number; end_time: string }[];
  }[]) {
    for (const point of metric.values ?? []) {
      const date = point.end_time.slice(0, 10);
      if (!byDate[date]) byDate[date] = { date };
      if (metric.name === "reach") {
        byDate[date].reach = safeNum(point.value);
        byDate[date].unique_viewers = safeNum(point.value);
      } else if (metric.name === "follower_count") {
        byDate[date].followers_gained = safeNum(point.value);
      }
    }
  }

  // ── Calls 2…N: total_value metrics, one call per day ──
  // follower_count excluded — incompatible with metric_type=total_value
  const totalValueMetrics = "views,profile_views,website_clicks,accounts_engaged";

  for (const day of daysInRange(dateFrom, dateTo)) {
    const daySince = toUnix(day);
    const dayUntil = daySince + 86400;

    const tvUrl =
      `${GRAPH}/${igAccountId}/insights` +
      `?metric=${totalValueMetrics}&metric_type=total_value&period=day` +
      `&since=${daySince}&until=${dayUntil}` +
      `&access_token=${token}`;

    const tvRes = await fetch(tvUrl, { cache: "no-store" });
    const tvData = await tvRes.json();

    if (tvData.error) continue; // skip this day silently, reach will still be there

    // Store at the same key as reach (next day = end_time convention)
    const nextDay = new Date(day + "T00:00:00Z");
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const key = nextDay.toISOString().slice(0, 10);

    if (!byDate[key]) byDate[key] = { date: key };
    for (const metric of (tvData.data ?? []) as { name: string; total_value?: { value: number } }[]) {
      const v = safeNum(metric.total_value?.value);
      switch (metric.name) {
        case "views":            byDate[key].impressions    = v; break;
        case "profile_views":    byDate[key].profile_visits = v; break;
        case "website_clicks":   byDate[key].link_clicks    = v; break;
        case "accounts_engaged": byDate[key].interactions   = v; break;
      }
    }
  }

  return Object.values(byDate).map((d) => ({
    date:             d.date             ?? "",
    impressions:      d.impressions      ?? 0,
    reach:            d.reach            ?? 0,
    views:            d.impressions      ?? 0,
    views_organic:    0,
    views_paid:       0,
    interactions:     d.interactions     ?? 0,
    profile_visits:   d.profile_visits   ?? 0,
    link_clicks:      d.link_clicks      ?? 0,
    followers_gained: d.followers_gained ?? 0,
    video_views_3s:   0,
    watch_time_ms:    0,
    unique_viewers:   d.reach            ?? 0,
  }));
}

export async function fetchIGPosts(
  igAccountId: string,
  token: string,
  limit = 30
): Promise<SocialPost[]> {
  const fields = [
    "id",
    "media_type",
    "caption",
    "permalink",
    "thumbnail_url",
    "media_url",
    "timestamp",
    "like_count",
    "comments_count",
    "ig_reels_plays",
  ].join(",");

  const url =
    `${GRAPH}/${igAccountId}/media` +
    `?fields=${fields}&limit=${limit}&access_token=${token}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (data.error) throw new Error(`IG media (${igAccountId}): ${data.error.message}`);

  const mediaItems = (data.data ?? []) as Record<string, unknown>[];

  const posts = await Promise.all(
    mediaItems.map(async (m) => {
      const likes    = safeNum(m.like_count);
      const comments = safeNum(m.comments_count);
      const plays    = safeNum(m.ig_reels_plays);
      // Meta's /media endpoint sometimes returns Reels as media_type='VIDEO';
      // normalize using play count so the reel filter in the UI works correctly.
      const rawType  = (m.media_type as string) ?? null;
      const mediaType = rawType === "VIDEO" && plays > 0 ? "REELS" : rawType;

      let reach = 0, saves = 0, shares = 0;
      try {
        const iRes = await fetch(
          `${GRAPH}/${m.id}/insights?metric=reach,saved,shares&access_token=${token}`,
          { cache: "no-store" }
        );
        const iData = await iRes.json();
        if (!iData.error) {
          for (const metric of (iData.data ?? []) as { name: string; values: { value: number }[] }[]) {
            const v = safeNum(metric.values?.[0]?.value);
            if (metric.name === "reach")  reach  = v;
            if (metric.name === "saved")  saves  = v;
            if (metric.name === "shares") shares = v;
          }
        }
      } catch { /* non-critical */ }

      const engagementRate =
        reach > 0 ? Number(((likes + comments + saves + shares) / reach * 100).toFixed(2)) : null;

      return {
        platform_post_id: String(m.id),
        platform:         "instagram" as const,
        media_type:       mediaType,
        caption:          (m.caption as string | null | undefined)?.slice(0, 500) ?? null,
        permalink:        (m.permalink as string | null) ?? null,
        thumbnail_url:    (m.thumbnail_url ?? m.media_url ?? null) as string | null,
        published_at:     String(m.timestamp),
        views:            plays || reach,
        reach,
        impressions:      reach,
        likes,
        comments,
        shares,
        saves,
        reel_plays:       plays,
        engagement_rate:  engagementRate,
        taps_forward:     0,
        taps_back:        0,
        exits:            0,
        replies_count:    0,
      } satisfies SocialPost;
    })
  );

  return posts;
}

// ─── Instagram Stories ────────────────────────────────────────────────────────
//
// Stories are ephemeral: individual insights expire after 24 h. We fetch them
// daily during the morning sync window and store each story as a row in
// social_posts with media_type = 'STORY'. story-level metrics:
//   reach, impressions, taps_forward, taps_backward, replies, exits

export async function fetchIGStories(
  igAccountId: string,
  token: string
): Promise<SocialPost[]> {
  const fields = ["id", "media_type", "timestamp", "media_url"].join(",");
  const url = `${GRAPH}/${igAccountId}/stories?fields=${fields}&access_token=${token}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  // Pages without stories or insufficient permissions return empty data
  if (data.error || !data.data?.length) return [];

  const storyItems = (data.data ?? []) as Record<string, unknown>[];

  const stories = await Promise.all(
    storyItems.map(async (s) => {
      let reach = 0, impressions = 0, tapsForward = 0, tapsBack = 0, replies = 0, exits = 0;

      try {
        const insRes = await fetch(
          `${GRAPH}/${s.id}/insights` +
          `?metric=reach,impressions,exits,taps_forward,taps_backward,replies` +
          `&access_token=${token}`,
          { cache: "no-store" }
        );
        const insData = await insRes.json();
        if (!insData.error) {
          for (const m of (insData.data ?? []) as { name: string; values: { value: number }[] }[]) {
            const v = safeNum(m.values?.[0]?.value);
            switch (m.name) {
              case "reach":          reach       = v; break;
              case "impressions":    impressions = v; break;
              case "exits":          exits       = v; break;
              case "taps_forward":   tapsForward = v; break;
              case "taps_backward":  tapsBack    = v; break;
              case "replies":        replies     = v; break;
            }
          }
        }
      } catch { /* non-critical — store story with zero metrics */ }

      const completionRate =
        impressions > 0 ? Math.round(((impressions - exits) / impressions) * 100) : 0;

      return {
        platform_post_id: String(s.id),
        platform:         "instagram" as const,
        media_type:       "STORY",
        caption:          null,
        permalink:        null,
        thumbnail_url:    (s.media_url as string | null) ?? null,
        published_at:     String(s.timestamp),
        views:            impressions,
        reach,
        impressions,
        likes:            0,
        comments:         replies,
        shares:           0,
        saves:            0,
        reel_plays:       0,
        engagement_rate:  completionRate > 0 ? completionRate : null,
        taps_forward:     tapsForward,
        taps_back:        tapsBack,
        exits,
        replies_count:    replies,
      } satisfies SocialPost;
    })
  );

  return stories;
}

// ─── Facebook ─────────────────────────────────────────────────────────────────
//
// Valid page-level metrics in v23 (others deprecated in v17+):
//   page_impressions, page_impressions_unique, page_post_engagements

export async function fetchFBDailyInsights(
  pageId: string,
  dateFrom: string,
  dateTo: string,
  token: string
): Promise<SocialDailyInsights[]> {
  const since = toUnix(dateFrom);
  const until = toUnix(dateTo) + 86400;

  // page_post_engagements deprecated in v17+; use only the reliably valid ones
  const metrics = [
    "page_impressions",
    "page_impressions_unique",
  ].join(",");

  const url =
    `${GRAPH}/${pageId}/insights` +
    `?metric=${metrics}&period=day&since=${since}&until=${until}` +
    `&access_token=${token}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  // NPE (New Page Experience) pages silently return empty data; legacy pages may error.
  // Either way return empty so the posts sync can proceed independently.
  if (data.error || !data.data?.length) return [];

  const byDate: Record<string, Partial<SocialDailyInsights>> = {};

  for (const metric of (data.data ?? []) as {
    name: string;
    values: { value: number; end_time: string }[];
  }[]) {
    for (const point of metric.values) {
      const date = point.end_time.slice(0, 10);
      if (!byDate[date]) byDate[date] = { date };
      switch (metric.name) {
        case "page_impressions":        byDate[date].impressions    = safeNum(point.value); break;
        case "page_impressions_unique": byDate[date].unique_viewers = safeNum(point.value); break;
      }
    }
  }

  return Object.values(byDate).map((d) => ({
    date:             d.date          ?? "",
    impressions:      d.impressions   ?? 0,
    reach:            d.unique_viewers ?? 0,
    views:            d.impressions   ?? 0,
    views_organic:    0,
    views_paid:       0,
    interactions:     d.interactions  ?? 0,
    profile_visits:   0,
    link_clicks:      0,
    followers_gained: 0,
    video_views_3s:   0,
    watch_time_ms:    0,
    unique_viewers:   d.unique_viewers ?? 0,
  }));
}

export async function fetchFBPosts(
  pageId: string,
  token: string,
  limit = 25
): Promise<SocialPost[]> {
  // /posts works with pages_read_engagement (page token); /published_posts needs
  // pages_read_user_content which requires Meta App Review — avoid it
  const ptRes = await fetch(
    `${GRAPH}/${pageId}?fields=access_token&access_token=${token}`,
    { cache: "no-store" }
  );
  const ptData = await ptRes.json();
  if (ptData.error) throw new Error(`FB page token (${pageId}): ${ptData.error.message}`);
  const pageToken: string = ptData.access_token ?? token;

  // reactions/comments require pages_read_user_content → omit; shares is fine
  const fields = [
    "id",
    "message",
    "full_picture",
    "permalink_url",
    "created_time",
    "shares",
  ].join(",");

  const url =
    `${GRAPH}/${pageId}/posts` +
    `?fields=${fields}&limit=${limit}&access_token=${pageToken}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (data.error) throw new Error(`FB posts (${pageId}): ${data.error.message}`);

  const fbItems = (data.data ?? []) as Record<string, unknown>[];

  const posts = fbItems.map((p) => {
    const shares = safeNum((p.shares as { count?: number } | undefined)?.count);

    return {
      platform_post_id: String(p.id),
      platform:         "facebook" as const,
      media_type:       p.full_picture ? "IMAGE" : "TEXT",
      caption:          (p.message as string | null | undefined)?.slice(0, 500) ?? null,
      permalink:        (p.permalink_url as string | null) ?? null,
      thumbnail_url:    (p.full_picture as string | null) ?? null,
      published_at:     String(p.created_time),
      views:            0,
      reach:            0,
      impressions:      0,
      likes:            0,
      comments:         0,
      shares,
      saves:            0,
      reel_plays:       0,
      engagement_rate:  null,
      taps_forward:     0,
      taps_back:        0,
      exits:            0,
      replies_count:    0,
    } satisfies SocialPost;
  });

  return posts;
}
