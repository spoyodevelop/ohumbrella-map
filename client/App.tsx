import { KoreaMap } from "./KoreaMap";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <>
      <KoreaMap />
      <SpeedInsights />
      <Analytics />
    </>
  );
}
