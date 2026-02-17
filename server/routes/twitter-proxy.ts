import type { FastifyRequest, FastifyReply } from "fastify";
import { store } from "../storage";

// Twitter's public web client bearer token (same for all users)
const TWITTER_BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const USER_AGENT = "attestfor.me/1.0 (+https://attestfor.me)";

async function ensureGuestToken(): Promise<string | null> {
  const cacheKey = "twitter:guest_token";

  // Check cache
  const cached = await store.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      "https://api.twitter.com/1.1/guest/activate.json",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
          "User-Agent": USER_AGENT,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.guest_token) {
      // Cache for 1 hour
      await store.set(cacheKey, data.guest_token, 60 * 60);
      return data.guest_token;
    }

    return null;
  } catch {
    return null;
  }
}

// GraphQL query parameters for TweetResultByRestId
const GRAPHQL_VARIABLES = (tweetId: string) => ({
  tweetId,
  withCommunity: false,
  includePromotedContent: false,
  withVoice: false,
});

const GRAPHQL_FEATURES = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: false,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: false,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

const GRAPHQL_FIELD_TOGGLES = {
  withArticleRichContentState: true,
  withArticlePlainText: false,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false,
};

export async function proxyTwitterGraphQL(
  req: FastifyRequest<{ Querystring: { tweetId: string } }>,
  reply: FastifyReply,
) {
  const { tweetId } = req.query;

  if (!tweetId || !/^\d+$/.test(tweetId)) {
    return reply.status(400).send({ error: "Invalid or missing tweetId" });
  }

  const cacheKey = `tweet:${tweetId}`;

  // Check cache
  const cached = await store.get(cacheKey);
  if (cached) {
    return reply.send(JSON.parse(cached));
  }

  const guestToken = await ensureGuestToken();

  if (!guestToken) {
    return reply.status(500).send({ error: "Failed to obtain guest token" });
  }

  try {
    const url = new URL(
      "https://api.x.com/graphql/d6YKjvQ920F-D4Y1PruO-A/TweetResultByRestId",
    );
    url.searchParams.set(
      "variables",
      JSON.stringify(GRAPHQL_VARIABLES(tweetId)),
    );
    url.searchParams.set("features", JSON.stringify(GRAPHQL_FEATURES));
    url.searchParams.set("fieldToggles", JSON.stringify(GRAPHQL_FIELD_TOGGLES));

    const response = await fetch(url.toString(), {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
        "content-type": "application/json",
        "x-guest-token": guestToken,
        "x-twitter-active-user": "yes",
        "x-twitter-client-language": "en",
        "User-Agent": USER_AGENT,
      },
    });

    const data = await response.json();

    // Cache for 1 minute
    await store.set(cacheKey, JSON.stringify(data), 60);

    return reply.status(response.status).send(data);
  } catch (error) {
    console.error("Error proxying GraphQL request:", error);
    return reply.status(500).send({
      error: "Internal server error",
    });
  }
}
