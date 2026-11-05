import type {
  SurpriseRainEvent,
  SurpriseRainResponse,
} from "../../api/surpriseRain";
import { formatHour } from "../../lib/formatTime";

export interface RainStory extends SurpriseRainEvent {
  code: string;
  name: string;
}

// Each region supplies its latest 30 records. List the latest observations
// first, breaking ties by rainfall, then region code for stability.
export function getRainStories(
  data: SurpriseRainResponse | null,
  sidos: { code: string; name: string }[] = [],
): RainStory[] {
  if (!data) return [];
  return Object.entries(data.regions)
    .flatMap(([code, region]) =>
      region.events.map((event) => ({
        ...event,
        code,
        name: [
          sidos.find((sido) => sido.code === region.sidoCode)?.name,
          region.name,
        ]
          .filter(Boolean)
          .join(" "),
      })),
    )
    .sort(
      (a, b) =>
        b.time.localeCompare(a.time) ||
        b.rn1 - a.rn1 ||
        a.code.localeCompare(b.code),
    );
}

// KMA calls 3mm or more an hour moderate rain; the hero card features that.
export const FEATURED_MIN_MM = 3;

// Stories are newest first; fall back to the newest record when nothing
// reached FEATURED_MIN_MM.
export function pickFeaturedStory(stories: RainStory[]): RainStory | undefined {
  return stories.find((story) => story.rn1 >= FEATURED_MIN_MM) ?? stories[0];
}

export function StoryNumbers({ story }: { story: RainStory }) {
  return (
    <div className="story-numbers">
      <div>
        <span>예보 강수확률</span>
        <strong>
          {story.pop}
          <small>%</small>
        </strong>
      </div>
      <span className="story-arrow" aria-label="실제로는">
        →
      </span>
      <div>
        <span>관측된 비 · 1시간</span>
        <strong className="rain-number">
          {story.rn1}
          <small>mm</small>
        </strong>
      </div>
    </div>
  );
}

export function RainStories({
  stories,
  errorMessage,
  loading,
  onSelect,
  selectedCode,
}: {
  stories: RainStory[];
  errorMessage: string;
  loading: boolean;
  onSelect: (code: string) => void;
  selectedCode?: string;
}) {
  // Keep the opening list geographically varied, instead of repeating one place.
  const seen = new Set<string>();
  const recent = stories
    .filter((story) => {
      if (seen.has(story.code)) return false;
      seen.add(story.code);
      return true;
    })
    .slice(0, 4);
  return (
    <aside className="rain-stories" aria-label="최근 아니 땐 비 기록">
      <h3>최근 기록</h3>
      <p className="stories-intro">최근 기록을 누르면 그 동네로 이동해요.</p>
      {recent.map((story) => (
        <button
          className="story-card"
          key={`${story.code}-${story.time}`}
          onClick={() => onSelect(story.code)}
          aria-pressed={selectedCode === story.code}
        >
          <span className="story-card-top">
            <strong>{story.name}</strong>
            <span aria-hidden="true">↗</span>
          </span>
          <time dateTime={story.time}>{formatHour(story.time)}</time>
          <StoryNumbers story={story} />
        </button>
      ))}
      {!recent.length && (
        <p role="status" className="empty-record">
          {errorMessage
            ? "기록을 불러오지 못했어요. 잠시 후 새로고침해 주세요."
            : loading
              ? "실제 비 기록을 불러오고 있어요…"
              : "이 기간에는 조건에 맞는 기록이 없어요."}
        </p>
      )}
    </aside>
  );
}
