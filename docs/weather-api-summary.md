# 기상청 단기예보 조회서비스 API

## 개요

- API명: `VilageFcstInfoService_2.0`
- 방식: REST `GET`
- 응답 형식: `XML`, `JSON`
- Base URL:

```text
http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0
```

주요 API는 다음 4개다.

| API | Endpoint | 용도 |
|---|---|---|
| 초단기실황 | `getUltraSrtNcst` | 현재 관측값 조회 |
| 초단기예보 | `getUltraSrtFcst` | 최대 6시간 이내 예보 |
| 단기예보 | `getVilageFcst` | 단기 기상예보 조회 |
| 예보버전 | `getFcstVersion` | 수정된 예보 버전 확인 |

---

# 1. 초단기실황

```http
GET /getUltraSrtNcst
```

현재 관측된 기상 정보를 조회한다.

## 요청

```text
serviceKey
numOfRows
pageNo
dataType
base_date
base_time
nx
ny
```

예:

```text
?serviceKey=KEY
&numOfRows=10
&pageNo=1
&dataType=JSON
&base_date=20210628
&base_time=0600
&nx=55
&ny=127
```

### 시간

- 매시간 `30분`에 생성
- `40분 이후` API 호출 권장
- `base_time`은 정시 기준

예:

```text
06:40 이후 → base_time=0600
17:40 이후 → base_time=1700
```

## 주요 응답 Category

| Category | 의미 | 단위 |
|---|---|---|
| `T1H` | 기온 | ℃ |
| `RN1` | 1시간 강수량 | mm |
| `REH` | 습도 | % |
| `PTY` | 강수형태 | 코드 |
| `UUU` | 동서바람성분 | m/s |
| `VVV` | 남북바람성분 | m/s |
| `VEC` | 풍향 | deg |
| `WSD` | 풍속 | m/s |

응답 값은 `obsrValue`에 들어간다.

---

# 2. 초단기예보

```http
GET /getUltraSrtFcst
```

현재 시점을 기준으로 약 6시간 이내의 예보를 조회한다.

## 요청

```text
serviceKey
numOfRows
pageNo
dataType
base_date
base_time
nx
ny
```

### 시간

- 매시간 `30분` 생성
- `45분 이후` API 제공
- `base_time`은 `30분` 기준

예:

```text
06:45 이후 → base_time=0630
17:45 이후 → base_time=1730
```

## 주요 응답

```text
baseDate
baseTime
category
fcstDate
fcstTime
fcstValue
nx
ny
```

### Category

| Category | 의미 |
|---|---|
| `T1H` | 기온 |
| `RN1` | 1시간 강수량 |
| `SKY` | 하늘상태 |
| `REH` | 습도 |
| `PTY` | 강수형태 |
| `LGT` | 낙뢰 |
| `UUU` | 동서바람성분 |
| `VVV` | 남북바람성분 |
| `VEC` | 풍향 |
| `WSD` | 풍속 |

---

# 3. 단기예보

```http
GET /getVilageFcst
```

강수확률(`POP`)을 포함한 단기 예보를 조회한다.

## 요청

```text
serviceKey
numOfRows
pageNo
dataType
base_date
base_time
nx
ny
```

## 발표 시각

하루 8회 제공된다.

```text
0200
0500
0800
1100
1400
1700
2000
2300
```

API 제공 시각:

```text
02:10
05:10
08:10
11:10
14:10
17:10
20:10
23:10
```

즉 예를 들어:

```text
05:10 이후 → base_time=0500
08:10 이후 → base_time=0800
```

## 주요 Category

| Category | 의미 | 단위 |
|---|---|---|
| `POP` | 강수확률 | % |
| `PTY` | 강수형태 | 코드 |
| `PCP` | 1시간 강수량 | 범주 |
| `REH` | 습도 | % |
| `SNO` | 1시간 신적설 | 범주 |
| `SKY` | 하늘상태 | 코드 |
| `TMP` | 1시간 기온 | ℃ |
| `TMN` | 일 최저기온 | ℃ |
| `TMX` | 일 최고기온 | ℃ |
| `UUU` | 동서바람성분 | m/s |
| `VVV` | 남북바람성분 | m/s |
| `VEC` | 풍향 | deg |
| `WSD` | 풍속 | m/s |

---

# 4. 강수 관련 코드

## POP

```text
POP = 강수확률 (%)
```

예:

```text
POP=30 → 강수확률 30%
POP=60 → 강수확률 60%
```

---

## PTY

### 초단기

| 값 | 의미 |
|---:|---|
| 0 | 없음 |
| 1 | 비 |
| 2 | 비/눈 |
| 3 | 눈 |
| 5 | 빗방울 |
| 6 | 빗방울눈날림 |
| 7 | 눈날림 |

### 단기예보

| 값 | 의미 |
|---:|---|
| 0 | 없음 |
| 1 | 비 |
| 2 | 비/눈 |
| 3 | 눈 |
| 4 | 소나기 |

---

# 5. 강수량

초단기예보의 `RN1`, 단기예보의 `PCP`는 범주형으로 제공될 수 있다.

| 범주 | 표시 |
|---|---|
| 1mm 미만 | `1mm 미만` |
| 1~29mm | 실제 정수값 |
| 30~50mm | `30~50mm` |
| 50mm 이상 | `50mm 이상` |

예:

```text
PCP=6
→ 6mm

PCP=30
→ 30~50mm
```

---

# 6. 하늘상태

`SKY`

| 코드 | 상태 |
|---:|---|
| 1 | 맑음 |
| 3 | 구름많음 |
| 4 | 흐림 |

전운량 기준:

```text
맑음      0~5
구름많음  6~8
흐림      9~10
```

---

# 7. 좌표

API는 위도/경도를 직접 사용하는 것이 아니라 기상청 격자 좌표인

```text
nx
ny
```

를 사용한다.

기상청에서 제공하는 Lambert Conformal Conic 변환식을 이용해

```text
위도/경도 ↔ nx/ny
```

변환이 가능하다.

기본 지도 파라미터:

```text
지구반경: 6371.00877 km
격자간격: 5 km

표준위도1: 30°
표준위도2: 60°

기준경도: 126°
기준위도: 38°
```

격자 크기:

```text
X: 1~149
Y: 1~253
```

단기예보 서비스는 남한 지역을 대상으로 제공된다.

---

# 8. Missing 값

```text
+900 이상
-900 이하
```

값은 Missing으로 처리한다.

관측장비가 없거나 관측값이 누락된 경우 등에 사용된다.

---

# 9. API 에러 코드

| 코드 | 의미 |
|---:|---|
| `00` | NORMAL_SERVICE |
| `01` | APPLICATION_ERROR |
| `02` | DB_ERROR |
| `03` | NODATA_ERROR |
| `04` | HTTP_ERROR |
| `05` | SERVICETIME_OUT |
| `10` | INVALID_REQUEST_PARAMETER_ERROR |
| `11` | NO_MANDATORY_REQUEST_PARAMETERS_ERROR |
| `12` | NO_OPENAPI_SERVICE_ERROR |
| `20` | SERVICE_ACCESS_DENIED_ERROR |
| `21` | TEMPORARILY_DISABLE_THE_SERVICEKEY_ERROR |
| `22` | LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR |
| `30` | SERVICE_KEY_IS_NOT_REGISTERED_ERROR |
| `31` | DEADLINE_HAS_EXPIRED_ERROR |
| `32` | UNREGISTERED_IP_ERROR |
| `33` | UNSIGNED_CALL_ERROR |
| `99` | UNKNOWN_ERROR |
