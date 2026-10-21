# 1번 접시 게임 추가

2026-10-21 현재 https://test1-e3hn.onrender.com/ 배포 코드를 기준으로 만든 수정 파일입니다.

## 적용

1. 압축을 풀어 나온 파일과 폴더를 기존 프로젝트의 `index.html`이 있는 위치에 복사하고, 같은 이름의 파일은 덮어씁니다.
2. `assets`와 `interactions`는 기존 폴더에 합칩니다. 기존 영상·이미지는 그대로 필요합니다.
3. GitHub Desktop에서 Commit → Push 후 Render의 새 배포가 Live가 될 때까지 기다립니다.
4. 폰과 아이패드를 새로고침합니다. `sync-config.js`에 새 방을 추가했으므로 서버도 새 배포로 재시작되어야 합니다.

## 주소

- 1번 NFC에 기록할 주소: https://test1-e3hn.onrender.com/?fish=fish01&phase=water
- 1번 게임만 바로 확인: https://test1-e3hn.onrender.com/?fish=fish01
- 1번 아이패드: https://test1-e3hn.onrender.com/display.html?fish=fish01
- 기존 5번은 `fish=fish05` 주소를 계속 사용합니다.

NFC 주소는 기존 물 붓기 → S1_water 종료 → S1_main 종료 → 1번 접시 게임 순서로 연결됩니다.
게임만 바로 확인하는 주소는 아이패드를 연결하지 않고 폰 게임을 확인하기 위한 것입니다.
아이패드는 준비할 때 시작 버튼을 한 번 누릅니다.

## 게임

- 안내는 터치로 진행합니다.
- 접시 사진을 누르면 한 장이 나옵니다. 나온 접시를 잡고 아래 그림자까지 천천히 끌어 놓습니다.
- 큰 꽃무늬 접시 → 작은 테두리 접시 → 그릇, 즉 첨부된 `layer1 → layer2 → layer3` 순서입니다. 참고 과정의 원래 번호는 3 → 1 → 2입니다.
- 빠르게 옮기거나 놓는 위치를 벗어나면 지금 접시만 돌아갑니다. 이미 쌓은 접시는 유지됩니다.
- 3개 성공 → 아이패드 S1_ending 재생 → 흰동가리 등장 → 화면 터치로 공통 5_09 안내 → 각도 변화 → 공통 5_10 안내 → 수평 유지 → 말풍선 숨김 → 3초 뒤 폰·아이패드 홈 복귀입니다.
- 마지막 물고기 수영 영상은 현재 5번과 같이 정지 이미지로 대신합니다. 완료 신호는 기존 중계 서버를 통해 `fish01`로 한 번 전송합니다.

## 수정할 곳

| 원하는 변경 | 파일 / 설정 |
| --- | --- |
| 안내·접시 사진·하단 그림자 위치 | `fish01.css` |
| 접시 이동 최소 시간 | `config.js`의 fish01.game.minCarryMs (현재 1100ms) |
| 허용 이동 속도 | fish01.game.maxSpeed (현재 화면 높이의 0.95배/초, 크게 하면 쉬워짐) |
| 쌓은 접시 크기 / 높이 | fish01.game.plateWidths / plateLifts / floor |
| 5_09 각도 변화 / 확인 시간 | common.revealChangeDeg / revealChangeHoldMs (현재 20도 / 200ms) |
| 5_10 수평 오차 / 유지 시간 | common.levelTolerance / levelHoldMs (현재 12도 미만 / 900ms) |
| 말풍선이 사라진 뒤 홈 복귀 | common.finishReturnMs (현재 3000ms) |
| 아이패드 1번 영상 | `sync-config.js`의 fish.fish01.display |
| 1번 이미지 경로 | `config.js`의 fish01.assets |

`assets/fish01/rays.png`는 기존 `1_end_rays.png`를 폰에서 쓰기 좋게 줄인 사본입니다. 원본 에셋은 변경하지 않았습니다.
5번 rays 경로도 실제 배포본에 있는 `assets/web/5_end_rays.png`로 맞췄습니다.
5_09 / 5_10 기울기 조건은 1번과 5번이 같은 공통 코드를 사용합니다.

## 확인

접시 순서·속도 판정·잘못 놓기·중단 후 재시작, 공통 기울기 조건과 3초 타이머를 자동 검사했습니다.
로컬 중계 서버에서 1번과 기존 5번의 NFC → 영상 → 게임 → 엔딩 → 홈 복귀 및 TD 신호 1회 전송도 확인했습니다.
실제 버디3·아이패드의 손가락 조작과 센서 감도는 배포 후 기기에서 확인해주세요.
