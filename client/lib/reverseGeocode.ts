export type GeoRegion = {
  sidoName: string;
  sigunguName: string;
};

export async function reverseGeocode(): Promise<GeoRegion> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10_000,
      maximumAge: 60_000,
    }),
  );

  const { latitude, longitude } = position.coords;
  const url =
    `/api/gc?coords=${longitude},${latitude}&output=json&orders=admcode`;

  const data = await fetchJson<NaverGeoResponse>(url);
  const result = data.results?.[0];
  if (!result) throw new Error("위치를 행정구역으로 변환할 수 없습니다.");

  return {
    sidoName: result.region.area1.name,
    sigunguName: result.region.area2.name,
  };
}

type NaverGeoResponse = {
  status: { code: number; name: string };
  results: Array<{
    name: string;
    region: {
      area1: { name: string };
      area2: { name: string };
      area3: { name: string };
    };
  }>;
};
import { fetchJson } from "./http";
