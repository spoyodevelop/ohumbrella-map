declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

// GTM keeps every pushed key until it is overwritten, so clear the last
// event's params before pushing the next one.
const pushedParams = new Set<string>();

// Elements marked data-track="event_name" push that event to GTM on click.
// data-track-foo="bar" attributes become the event's params ({ foo: "bar" }).
export function trackTaggedClicks() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tagged = target.closest<HTMLElement | SVGElement>("[data-track]");
    if (!tagged?.dataset.track) return;

    const params: Record<string, unknown> = {};
    for (const key of pushedParams) params[key] = undefined;
    for (const [key, value] of Object.entries(tagged.dataset)) {
      if (key === "track" || !key.startsWith("track")) continue;
      const name = key[5].toLowerCase() + key.slice(6);
      params[name] = value;
      pushedParams.add(name);
    }
    window.dataLayer ??= [];
    window.dataLayer.push({ event: tagged.dataset.track, ...params });
  });
}
