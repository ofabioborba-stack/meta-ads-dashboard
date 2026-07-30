import { createClient } from "@/lib/supabase/server";
import {
  Eye,
  Heart,
  MousePointerClick,
  UserPlus,
  Play,
  Bookmark,
  Share2,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import DeltaBadge from "./DeltaBadge";
import { formatNumber } from "@/lib/utils";
import SocialSyncToggle from "./SocialSyncToggle";
import Image from "next/image";

function IgIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

interface Props {
  clientId: string;
  dateFrom: string;
  dateTo: string;
  prevFrom: string;
  prevTo: string;
}

interface InsightRow {
  social_account_id: string;
  date: string;
  impressions: number;
  reach: number;
  views: number;
  views_organic: number;
  interactions: number;
  profile_visits: number;
  link_clicks: number;
  followers_gained: number;
  video_views_3s: number;
  unique_viewers: number;
}

interface PostRow {
  platform_post_id: string;
  platform: string;
  media_type: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_storage_url: string | null;
  thumbnail_url: string | null;
  published_at: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reel_plays: number;
  engagement_rate: number | null;
  taps_forward: number;
  taps_back: number;
  exits: number;
  replies_count: number;
}

interface SocialAccountRow {
  id: string;
  platform: string;
  account_name: string | null;
}

function sumInsights(rows: InsightRow[]) {
  return rows.reduce(
    (acc, r) => ({
      impressions:      acc.impressions      + (r.impressions      ?? 0),
      reach:            acc.reach            + (r.reach            ?? 0),
      views:            acc.views            + (r.views            ?? 0),
      views_organic:    acc.views_organic    + (r.views_organic    ?? 0),
      interactions:     acc.interactions     + (r.interactions     ?? 0),
      profile_visits:   acc.profile_visits   + (r.profile_visits   ?? 0),
      link_clicks:      acc.link_clicks      + (r.link_clicks      ?? 0),
      followers_gained: acc.followers_gained + (r.followers_gained ?? 0),
      unique_viewers:   acc.unique_viewers   + (r.unique_viewers   ?? 0),
    }),
    { impressions: 0, reach: 0, views: 0, views_organic: 0, interactions: 0, profile_visits: 0, link_clicks: 0, followers_gained: 0, unique_viewers: 0 }
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  current,
  previous,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  current: number;
  previous: number;
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={14} />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-xl font-bold">{value}</span>
      <DeltaBadge current={current} previous={previous || null} />
    </div>
  );
}

function MiniStat({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted">
      <Icon size={11} />
      <span>{value}</span>
    </div>
  );
}

function PostCard({ post, isPeriodOnly = false }: { post: PostRow; isPeriodOnly?: boolean }) {
  const isReel = post.media_type === "REELS";
  const thumb  = post.thumbnail_storage_url || post.thumbnail_url;
  const plays  = post.reel_plays || post.views;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden flex flex-col">
      <div className="relative aspect-[4/5] bg-card-hover">
        {thumb ? (
          <Image
            src={thumb}
            alt={post.caption?.slice(0, 50) ?? "Post"}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted/40">
            <IgIcon size={28} />
          </div>
        )}
        {isReel && (
          <span className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            <Play size={9} fill="white" className="shrink-0" />
            Reel
          </span>
        )}
        {isPeriodOnly && (
          <span className="absolute bottom-2 left-2 bg-pink-500/90 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
            novo
          </span>
        )}
        <IgIcon size={13} className="absolute top-2 right-2 text-white drop-shadow" />
      </div>

      <div className="p-2.5 flex flex-col gap-2 flex-1">
        {post.caption && (
          <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">{post.caption}</p>
        )}

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-auto">
          {isReel ? (
            <>
              <MiniStat icon={Play}     value={formatNumber(plays)} />
              <MiniStat icon={Eye}      value={formatNumber(post.reach)} />
              <MiniStat icon={Heart}    value={formatNumber(post.likes)} />
              <MiniStat icon={Bookmark} value={formatNumber(post.saves)} />
            </>
          ) : (
            <>
              <MiniStat icon={Eye}          value={formatNumber(post.reach)} />
              <MiniStat icon={Heart}        value={formatNumber(post.likes)} />
              <MiniStat icon={MessageCircle}value={formatNumber(post.comments)} />
              <MiniStat icon={Bookmark}     value={formatNumber(post.saves)} />
            </>
          )}
        </div>

        {post.engagement_rate !== null && post.engagement_rate > 0 && (
          <span className="text-[10px] text-accent font-medium">
            {post.engagement_rate.toFixed(1)}% engajamento
          </span>
        )}

        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            Ver post <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

function StoryCard({ story }: { story: PostRow }) {
  const thumb = story.thumbnail_storage_url || story.thumbnail_url;
  const completion = story.views > 0
    ? Math.round(((story.views - (story.exits || 0)) / story.views) * 100)
    : 0;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden flex flex-col">
      <div className="relative aspect-[9/16] bg-card-hover">
        {thumb ? (
          <Image src={thumb} alt="Story" fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted/40">
            <IgIcon size={20} />
          </div>
        )}
        {completion > 0 && (
          <span className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] font-semibold text-white drop-shadow">
            {completion}% concluído
          </span>
        )}
      </div>
      <div className="p-2 space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span className="flex items-center gap-0.5"><Eye size={9} /> {formatNumber(story.reach)}</span>
          <span className="flex items-center gap-0.5"><MessageCircle size={9} /> {formatNumber(story.replies_count || 0)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span className="flex items-center gap-0.5"><ChevronRight size={9} /> {formatNumber(story.taps_forward || 0)}</span>
          <span className="flex items-center gap-0.5"><LogOut size={9} /> {formatNumber(story.exits || 0)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryBar({
  items,
}: {
  items: { label: string; value: string; icon: React.ElementType }[];
}) {
  return (
    <div className="flex flex-wrap gap-4 rounded-xl bg-card-hover border border-border px-4 py-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-sm">
          <item.icon size={14} className="text-muted shrink-0" />
          <span className="text-muted text-xs">{item.label}</span>
          <span className="font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function SocialOrganicSection({ clientId, dateFrom, dateTo, prevFrom, prevTo }: Props) {
  const supabase = await createClient();

  const { data: allAccounts } = await supabase
    .from("social_accounts")
    .select("id, platform, account_name, is_active")
    .eq("client_id", clientId)
    .eq("platform", "instagram");

  if (!allAccounts?.length) {
    return (
      <p className="rounded-xl bg-card border border-border p-5 text-sm text-muted">
        Nenhuma conta do Instagram configurada para este cliente.
      </p>
    );
  }

  const toggleAccount = allAccounts[0];
  const accounts = allAccounts.filter((a) => a.is_active);

  if (!accounts.length) {
    return (
      <div className="space-y-3">
        <SocialSyncToggle
          accountId={toggleAccount.id}
          accountName={toggleAccount.account_name}
          initialActive={false}
        />
        <p className="rounded-xl bg-card border border-border p-5 text-sm text-muted">
          Sync desativado. Ative acima para começar a coletar dados orgânicos.
        </p>
      </div>
    );
  }

  const ids = accounts.map((a) => a.id);
  const POSTS_COLS =
    "platform_post_id,platform,media_type,caption,permalink,thumbnail_storage_url,thumbnail_url,published_at,views,reach,likes,comments,shares,saves,reel_plays,engagement_rate,taps_forward,taps_back,exits,replies_count";

  const [insightsRes, prevInsightsRes, topReelsRes, periodReelsRes, feedRes, storiesRes] = await Promise.all([
    supabase
      .from("social_insights_daily")
      .select("social_account_id,date,impressions,reach,views,views_organic,interactions,profile_visits,link_clicks,followers_gained,video_views_3s,unique_viewers")
      .in("social_account_id", ids)
      .gte("date", dateFrom)
      .lte("date", dateTo),
    supabase
      .from("social_insights_daily")
      .select("social_account_id,date,impressions,reach,views,views_organic,interactions,profile_visits,link_clicks,followers_gained,video_views_3s,unique_viewers")
      .in("social_account_id", ids)
      .gte("date", prevFrom)
      .lte("date", prevTo),
    // Top 10 reels all-time by plays
    supabase
      .from("social_posts")
      .select(POSTS_COLS)
      .in("social_account_id", ids)
      .eq("media_type", "REELS")
      .order("views", { ascending: false })
      .limit(10),
    // Reels published in the selected period (may not be in top 10 yet)
    supabase
      .from("social_posts")
      .select(POSTS_COLS)
      .in("social_account_id", ids)
      .eq("media_type", "REELS")
      .gte("published_at", dateFrom)
      .lte("published_at", dateTo + "T99")
      .order("published_at", { ascending: false })
      .limit(20),
    // Feed posts: most recent 60, will be filtered client-side by period (Option A)
    supabase
      .from("social_posts")
      .select(POSTS_COLS)
      .in("social_account_id", ids)
      .neq("media_type", "REELS")
      .neq("media_type", "STORY")
      .order("published_at", { ascending: false })
      .limit(60),
    supabase
      .from("social_posts")
      .select(POSTS_COLS)
      .in("social_account_id", ids)
      .eq("media_type", "STORY")
      .order("published_at", { ascending: false })
      .limit(30),
  ]);

  const insights     = (insightsRes.data     ?? []) as InsightRow[];
  const prevInsights = (prevInsightsRes.data ?? []) as InsightRow[];
  const topReels     = (topReelsRes.data     ?? []) as PostRow[];
  const periodReels  = (periodReelsRes.data  ?? []) as PostRow[];
  const allFeedPosts = (feedRes.data         ?? []) as PostRow[];
  const stories      = (storiesRes.data      ?? []) as PostRow[];

  const current  = sumInsights(insights);
  const previous = sumInsights(prevInsights);

  // Merge: top 10 + any period reels not already in the top list
  const topIds = new Set(topReels.map((r) => r.platform_post_id));
  const periodOnlyReels = periodReels.filter((r) => !topIds.has(r.platform_post_id));
  const reels = [...topReels, ...periodOnlyReels];
  // Track which post IDs are "period entries" (not in top 10) so we can badge them
  const periodOnlyIds = new Set(periodOnlyReels.map((r) => r.platform_post_id));

  // Filter feed posts to the selected period (published_at slice is safe regardless of timezone suffix)
  const feed = allFeedPosts.filter((p) => {
    const d = p.published_at.slice(0, 10);
    return d >= dateFrom && d <= dateTo;
  });

  const hasData = insights.length > 0 || topReels.length > 0 || allFeedPosts.length > 0 || stories.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-3">
        <SocialSyncToggle
          accountId={toggleAccount.id}
          accountName={toggleAccount.account_name}
          initialActive={true}
        />
        <p className="rounded-xl bg-card border border-border p-5 text-sm text-muted">
          Sem dados orgânicos para o período selecionado. O sync roda diariamente às 9h15.
        </p>
      </div>
    );
  }

  const accountName =
    (accounts as SocialAccountRow[]).map((a) => a.account_name).filter(Boolean).join(", ") || "Instagram";

  // Reels aggregates
  const totalReelPlays   = reels.reduce((s, p) => s + (p.reel_plays || p.views || 0), 0);
  const totalReelReach   = reels.reduce((s, p) => s + p.reach, 0);
  const avgReelReach     = reels.length > 0 ? Math.round(totalReelReach / reels.length) : 0;
  const totalReelSaves   = reels.reduce((s, p) => s + p.saves, 0);
  const totalReelShares  = reels.reduce((s, p) => s + p.shares, 0);

  // Stories aggregates
  const totalStoryReach  = stories.reduce((s, p) => s + p.reach, 0);
  const totalStoryImpr   = stories.reduce((s, p) => s + (p.views || 0), 0);
  const totalStoryReplies = stories.reduce((s, p) => s + (p.replies_count || 0), 0);
  const totalStoryExits  = stories.reduce((s, p) => s + (p.exits || 0), 0);
  const avgCompletion    = totalStoryImpr > 0
    ? Math.round(((totalStoryImpr - totalStoryExits) / totalStoryImpr) * 100)
    : 0;

  const metricCards = [
    { icon: Eye,              label: "Visualizações",     value: formatNumber(current.views || current.impressions), current: current.views || current.impressions, previous: previous.views || previous.impressions },
    { icon: Eye,              label: "Alcance",           value: formatNumber(current.reach),            current: current.reach,            previous: previous.reach            },
    { icon: Heart,            label: "Interações",        value: formatNumber(current.interactions),     current: current.interactions,     previous: previous.interactions     },
    { icon: UserPlus,         label: "Novos seguidores",  value: formatNumber(current.followers_gained), current: current.followers_gained, previous: previous.followers_gained },
    { icon: Eye,              label: "Visitas ao perfil", value: formatNumber(current.profile_visits),   current: current.profile_visits,   previous: previous.profile_visits   },
    { icon: MousePointerClick,label: "Cliques no link",   value: formatNumber(current.link_clicks),      current: current.link_clicks,      previous: previous.link_clicks      },
  ];

  return (
    <div className="space-y-8">
      {/* Sync toggle */}
      <SocialSyncToggle
        accountId={toggleAccount.id}
        accountName={toggleAccount.account_name}
        initialActive={true}
      />

      {/* Header */}
      <div className="flex items-center gap-2">
        <IgIcon size={18} className="text-pink-400" />
        <h3 className="font-semibold text-sm text-pink-400">{accountName}</h3>
      </div>

      {/* Account metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metricCards.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Reels */}
      {reels.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Play size={15} className="text-pink-400" fill="currentColor" />
            <h4 className="font-semibold text-sm">Reels</h4>
            <span className="text-xs text-muted">
              Top 10 por plays
              {periodOnlyReels.length > 0 && ` · +${periodOnlyReels.length} do período`}
            </span>
          </div>

          <SummaryBar
            items={[
              { icon: Play,     label: "Plays totais",   value: formatNumber(totalReelPlays)  },
              { icon: Eye,      label: "Alcance médio",  value: formatNumber(avgReelReach)    },
              { icon: Bookmark, label: "Salvos totais",  value: formatNumber(totalReelSaves)  },
              { icon: Share2,   label: "Shares totais",  value: formatNumber(totalReelShares) },
            ]}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {reels.map((p) => (
              <PostCard
                key={p.platform_post_id}
                post={p}
                isPeriodOnly={periodOnlyIds.has(p.platform_post_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stories */}
      {stories.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-pink-400">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
            </svg>
            <h4 className="font-semibold text-sm">Stories</h4>
            <span className="text-xs text-muted">({stories.length} ativos)</span>
          </div>

          <SummaryBar
            items={[
              { icon: Eye,          label: "Alcance total",      value: formatNumber(totalStoryReach)   },
              { icon: Eye,          label: "Impressões totais",  value: formatNumber(totalStoryImpr)    },
              { icon: MessageCircle,label: "Respostas",          value: formatNumber(totalStoryReplies) },
              { icon: LogOut,       label: "Saídas",             value: formatNumber(totalStoryExits)   },
              { icon: Play,         label: "Taxa de conclusão",  value: `${avgCompletion}%`            },
            ]}
          />

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {stories.slice(0, 12).map((p) => (
              <StoryCard key={p.platform_post_id} story={p} />
            ))}
          </div>
        </div>
      )}

      {/* Feed posts */}
      {feed.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <IgIcon size={15} className="text-pink-400" />
            <h4 className="font-semibold text-sm">Posts</h4>
            <span className="text-xs text-muted">({feed.length} no período)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {feed.slice(0, 10).map((p) => (
              <PostCard key={p.platform_post_id} post={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
