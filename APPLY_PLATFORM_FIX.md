# 1번 받침 이미지와 온글잎 뉸재 적용

## 적용

다음 파일을 기존 프로젝트에서 같은 경로에 덮어씁니다.

- index.html
- style.css
- config.js
- interactions/fish01.js

압축의 assets 폴더는 기존 assets 폴더에 합칩니다.
새 파일은 assets/fish01/platform.png, assets/fonts/ownglyph-yooooonjae.woff2 및 폰트 출처 안내입니다.
GitHub Desktop에서 Commit → Push 후 Render 배포가 Live가 되면 새로고침하세요.

## 적용 내용

받침은 첨부한 PNG 원본을 그대로 사용하며, width: 100%, bottom: 0%로 화면 맨 아래에 붙입니다.
접시가 놓이는 높이도 받침 이미지 윗면에 맞춰 화면 크기에 따라 계산합니다.
S1-2_ment1에 해당하는 기존 안내 이미지를 화면에서 제거하고, 꾹 누르기/옮기기/재시도 등 상황에 따라 바뀌는 텍스트만 표시합니다.
안내 텍스트에 온글잎 공식 뉸재 WOFF2 폰트를 적용했습니다. 폰트 파일을 사이트에서 함께 제공하므로 폰에 따로 설치할 필요가 없습니다.

## 수정할 곳

- 받침 위치/크기: style.css 맨 아래 .dish-platform
- 문구 위치/글자 크기/색상: .dish-feedback
- 상황별 문구: interactions/fish01.js의 instruction(), feedback() 호출 부분
- 접시가 받침 위에 놓이는 위치: config.js의 fish01.game.platformSurfaceY / platformInsetPx
- 꾹 누르는 시간: 같은 곳의 pickupHoldMs

폰트 원본은 수정하지 않았습니다. 출처와 사용 안내는 assets/fonts/FONT_SOURCE.txt에 있습니다.

## 확인

세 가지 폰 화면 크기에서 받침과 접시 바닥이 맞는지, 이전 이미지 안내가 제거됐는지, 폰트가 안내문에 연결됐는지 검사했습니다.
상황별 문구에 필요한 한글 67자가 해당 폰트에 포함된 것도 확인했습니다.
꾹 누르기/드래그/실패 후 재시도/접시 3개 성공과 로컬 폰·아이패드 엔딩 연결 테스트를 통과했습니다.
