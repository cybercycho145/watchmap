# Watchmap

시리즈와 영화를 목록 순서대로 배치하는 개인용 시청 일정 계산기입니다. 정적 파일만으로 동작하므로 GitHub Pages에 올릴 수 있습니다.

## 핵심 동작

- TMDb 토큰은 상단 바에서 직접 입력하고 브라우저 `localStorage`에 저장합니다.
- 소스코드에는 TMDb API 키나 토큰을 넣지 않습니다.
- 시리즈는 시즌 0과 스페셜을 제외합니다.
- 에피소드 러닝타임이 없으면 방영된 에피소드에 한해 시리즈 평균 러닝타임을 사용합니다.
- 영화는 TMDb 영화 상세의 러닝타임을 사용합니다.
- 시청 규칙은 시작일, 선택 종료일, 요일별 분 단위로 추가하며 겹치는 날짜는 나중에 시작한 규칙이 대체합니다.
- Dropbox는 App key 기반 PKCE 연결을 사용합니다.

## Dropbox 설정

Dropbox 개발자 콘솔에서 앱의 Redirect URI에 배포 주소를 등록해야 합니다.

예시:

```text
https://사용자명.github.io/저장소명/watchmap/
```

저장 파일 경로는 Dropbox 앱 폴더 기준 `/watch-backlog-scheduler/data.json`입니다.

## 로컬 미리보기

```bash
node dev-server.cjs
```

기본 주소는 `http://127.0.0.1:4177/`입니다.
