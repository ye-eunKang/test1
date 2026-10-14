/* 폰·아이패드·서버가 함께 읽는 설정. 영상 파일명은 여기서 수정하세요. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FishSyncConfig = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  return {
    // Node 서버에서 두 페이지를 열면 빈 문자열 그대로 사용합니다.
    // 기존 Static Site를 유지할 때만 'https://새-중계서버.onrender.com' 입력.
    serverUrl: '',
    pourStartDeg: 8,
    pourSuccessDeg: 45,
    pourHoldMs: 1000,
    returnHomeMs: 4000,
    disconnectGraceMs: 60000,
    fish: {
      fish05: {
        label: '5번 · 해포리고기',
        tdSignal: 'fish05',
        display: {
          walk: 'assets/S1_walk.mp4',
          water: 'assets/S1_water.mp4',
          main: 'assets/S1_main.mp4',
          ending: 'assets/S1_ending.mp4',
        },
      },
      // 추가 게임은 config.js의 id와 같은 키로 이곳에 등록하세요.
      // fish01: { label: '1번', tdSignal: 'fish01', display: { walk: '...', water: '...', main: '...', ending: '...' } },
    },
  };
});
