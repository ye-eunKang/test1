/* 폰·아이패드·서버가 함께 읽는 설정. 영상 파일명은 여기서 수정하세요. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FishSyncConfig = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  return {
    // Node 서버에서 두 페이지를 열면 빈 문자열 그대로 사용합니다.
    // 기존 Static Site를 유지할 때만 'https://새-중계서버.onrender.com' 입력.
    serverUrl: 'https://test1-e3hn.onrender.com/',
    pourStartDeg: 8,
    pourSuccessDeg: 45,
    pourHoldMs: 1000,
    returnHomeMs: 4000,
    disconnectGraceMs: 60000,
    fish: {
      fish02:{
        label:'2번 · 도루묵', tdSignal:'fish02',
        // 2번 전용 영상이 제공되기 전까지 S1 영상을 테스트용으로 공유합니다.
        // 전용 영상 준비 후 이 네 경로를 S2_walk/water/main/ending.mp4로 바꾸세요.
        display:{walk:'assets/S1_walk.mp4',water:'assets/S1_water.mp4',
          main:'assets/S1_main.mp4',ending:'assets/S1_ending_web.mp4'},
      },
      fish01: {
        label: '1번 · 흰동가리', tdSignal: 'fish01',
        display: {
          walk: 'assets/S1_walk.mp4', water: 'assets/S1_water.mp4',
          main: 'assets/S1_main.mp4',
          // 접시를 옮기는 동안 첫 프레임에서 대기하고, 3개 성공 후 한 번 재생합니다.
          game: 'assets/S1_gamevideo_downgrade.mp4',
          // 게임 MP4 종료 후 재생하며, 이 영상까지 끝나야 폰의 물고기가 등장합니다.
          ending: 'assets/S1_ending_web.mp4',
          gameLayers: {
            background: 'assets/S1_game_back.gif',
            foreground: 'assets/S1_game_back_graphic.gif',
          },
        },
      },
      fish05: {
        label: '5번 · 해포리고기',
        tdSignal: 'fish05',
        display: {
          walk: 'assets/S1_walk.mp4',
          water: 'assets/S1_water.mp4',
          main: 'assets/S1_main.mp4',
          ending: 'assets/S1_ending_web.mp4',
        },
      },
      // 추가 게임은 config.js의 id와 같은 키로 이곳에 등록하세요.
      // fish02: { label: '2번', tdSignal: 'fish02', display: { walk: '...', water: '...', main: '...', ending: '...' } },
    },
  };
});
