import { Route, Routes } from "react-router";
import { CommutePage } from "./CommutePage";
import { KoreaMap } from "./KoreaMap";
import { AboutPage } from "./components/site/AboutPage";
import { SiteNav } from "./components/site/SiteNav";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <>
      <SiteNav />
      <Routes>
        <Route path="/commute" element={<CommutePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<KoreaMap />} />
      </Routes>
      <SpeedInsights />
      <Analytics />
    </>
  );
}
