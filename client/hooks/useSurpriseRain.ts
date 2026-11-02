import { useEffect, useState } from "react";
import {
  loadSurpriseRain,
  type SurpriseRainResponse,
} from "../api/surpriseRain";

// 레이어를 처음 켤 때 한 번만 불러온다. 지난 기록이라 자주 바뀌지 않는다.
export function useSurpriseRain(enabled: boolean) {
  const [data, setData] = useState<SurpriseRainResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!enabled || data) return;
    let isEffectActive = true;
    loadSurpriseRain()
      .then((loaded) => {
        if (isEffectActive) {
          setData(loaded);
          setErrorMessage("");
        }
      })
      .catch((reason: unknown) => {
        if (isEffectActive) {
          setErrorMessage(
            reason instanceof Error ? reason.message : String(reason),
          );
        }
      });
    return () => {
      isEffectActive = false;
    };
  }, [enabled, data]);

  return { data, errorMessage };
}
