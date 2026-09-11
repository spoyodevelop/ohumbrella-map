# Oh Umbrella Map

대한민국 시도/시군구 경계를 라이브러리 없이 SVG DOM으로 그리는 React 프로토타입입니다.

## 데이터 흐름

1. `map-source/`에는 원본 TopoJSON만 보관합니다. 이 폴더는 웹에 배포되지 않습니다.
2. `npm run map:build`가 원본을 브라우저에서 바로 그릴 수 있는 SVG path JSON으로 변환합니다.
3. 생성 결과는 `public/map/`에서 같은 사이트의 정적 파일로 서빙됩니다.
4. 첫 화면은 `sido.json`만 읽고 17개 시도를 표시합니다.
5. 시도를 가리키거나 선택하면 해당 `sigungu/{시도코드}.json`만 미리 읽고 캐시합니다.

외부 지도 API나 런타임 TopoJSON 라이브러리는 사용하지 않습니다.

## 코드 구조

- `src/App.tsx` — `KoreaMap` 하나만 배치
- `src/features/korea-map/KoreaMap.tsx` — 화면 마크업
- `src/features/korea-map/useKoreaMap.ts` — 줌, 드래그, 핀치, LOD 상태
- `src/features/korea-map/useMapData.ts` — React 데이터 로딩 상태
- `src/features/korea-map/mapData.ts` — 정적 JSON 요청과 캐시
- `scripts/build-map-data.mjs` — TopoJSON을 SVG path로 사전 변환

## 명령어

```sh
npm run dev
npm run build
npm run lint
```

`dev`와 `build` 실행 전 지도 데이터가 자동으로 다시 생성됩니다.
