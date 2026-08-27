(() => {
  'use strict';

  const root = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const STORE_KEY = 'ryoppy-encounter-v0.2';
  const CHARACTER_ID = 'christian-moerlein';
  const SPOT_ID = 'findlay-market';
  const POSES = {
    idle: './assets/characters/christian/idle.png',
    talk: './assets/characters/christian/talk.png',
    celebrate: './assets/characters/christian/celebrate.png',
  };

  const saved = loadSaved();
  const state = {
    data: null,
    character: null,
    spot: null,
    view: 'boot',
    revealed: false,
    storyIndex: 0,
    selectedQuestion: null,
    mode: saved.mode || 'demo',
    location: null,
    locationBusy: false,
    error: '',
    unlocked: Array.isArray(saved.unlocked) ? saved.unlocked : [],
    nodes: Array.isArray(saved.nodes) ? saved.nodes : [],
    revealTimer: 0,
  };

  const storyBeats = [
    'ようこそ、相棒！ 私はクリスチャン・モーライン。',
    'バイエルンからシンシナティへ渡り、鍛冶の腕と商売勘を元手に醸造所を始めた。',
    '私の成功には、この街の移民、鉄道、そして大勢の乾いた喉が詰まっている。さあ、街の続きを見よう！',
  ];

  const shortAnswers = {
    'moerlein-money': '鍛冶で働いて腕と評判をつくり、1853年に自分の醸造所を始めた。職人技、量産、流通。この三つで樽を大きな商売へ育てたのさ！',
    'moerlein-otr': 'Over-the-Rhineには働き手も客も仲間もいた。私はドイツ系移民が集まる街の熱気を、そのまま醸造所の勢いへ変えた。',
    'moerlein-collapse': '禁酒法で市場そのものが止まり、ビール帝国も動けなくなった。それでも名前と物語は街に残り、後の時代にブランドが復活した！',
  };

  const nodeLabels = {
    'brewing-industry': 'シンシナティの醸造産業',
    'immigrant-enterprise': '移民技能からの起業',
    'german-otr': 'ドイツ系移民のOTR',
    'findlay-market-node': 'Findlay Market',
    prohibition: '禁酒法',
    'brand-revival': '歴史ブランドの復活',
  };

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      mode: state.mode,
      unlocked: state.unlocked,
      nodes: state.nodes,
    }));
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function radians(value) {
    return value * Math.PI / 180;
  }

  function distanceMeters(a, b) {
    if (!a || !b) return null;
    const radius = 6371000;
    const dLat = radians(b.latitude - a.latitude);
    const dLon = radians(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(h));
  }

  function currentDistance() {
    if (state.mode === 'demo') return 18;
    return distanceMeters(state.location, state.spot);
  }

  function formatDistance(value) {
    if (value == null) return '距離を測定していません';
    if (value < 1000) return `約${Math.max(1, Math.round(value / 10) * 10)}m`;
    return `約${(value / 1000).toFixed(1)}km`;
  }

  function signalStatus() {
    const distance = currentDistance();
    const ready = state.mode === 'demo' || (distance != null && distance <= state.spot.radiusM);
    const strength = ready ? 96 : distance == null ? 18 : clamp(Math.round(100 - distance / 35), 8, 88);
    return { distance, ready, strength };
  }

  function isUnlocked() {
    return state.unlocked.includes(CHARACTER_ID);
  }

  function topbar(back = false) {
    return `
      <header class="topbar">
        ${back
          ? '<button class="round-button" data-action="back-to-scan" aria-label="探索へ戻る">←</button>'
          : '<span class="brand">RYOPPY<span>!</span></span>'}
        <span class="scene-location">${esc(state.spot?.name || 'Cincinnati')}</span>
        <span class="collection-count" aria-label="図鑑登録数">${isUnlocked() ? '1' : '0'} / 3</span>
      </header>`;
  }

  function particles() {
    return Array.from({ length: 14 }, (_, index) => {
      const x = 5 + ((index * 17) % 91);
      const y = 8 + ((index * 29) % 78);
      const delay = ((index * 7) % 19) / 10;
      const size = 5 + (index % 4) * 3;
      return `<i style="--x:${x}%;--y:${y}%;--delay:${delay}s;--size:${size}px"></i>`;
    }).join('');
  }

  function scanTemplate() {
    const status = signalStatus();
    const returning = isUnlocked();
    const headline = returning ? 'あの人物の気配が、戻ってきた。' : '誰かが、すぐ近くにいる。';
    const buttonLabel = returning ? 'もう一度、会いに行く' : 'この気配に触れる';
    const locationLabel = state.mode === 'demo'
      ? `位置デモ・${state.spot.name}`
      : state.location
        ? `現在地・${formatDistance(status.distance)}`
        : '現在地を待っています';

    return `
      <section class="experience scan-experience">
        <div class="ambient ambient-one"></div>
        <div class="ambient ambient-two"></div>
        <div class="world-grid" aria-hidden="true"></div>
        ${topbar(false)}

        <main class="scan-main">
          <div class="scan-copy">
            <p class="signal-label">SIGNAL 01 · OTR</p>
            <h1>${headline}</h1>
            <p>Findlay Marketの方角から、19世紀の誰かの気配がする。近づくほど信号が強くなる。</p>
          </div>

          <div class="radar-wrap" aria-label="信号強度 ${status.strength}%">
            <div class="radar-ring ring-three"></div>
            <div class="radar-ring ring-two"></div>
            <div class="radar-ring ring-one"></div>
            <div class="radar-sweep"></div>
            <div class="signal-core">
              <span>${status.strength}</span>
              <small>信号強度</small>
            </div>
          </div>

          <section class="scan-panel">
            <div class="signal-readout">
              <span class="live-dot"></span>
              <div>
                <strong>${esc(locationLabel)}</strong>
                <span>${status.ready ? '遭遇できる距離です' : '信号の近くへ移動してください'}</span>
              </div>
            </div>
            <button class="primary-action" data-action="start-encounter" ${status.ready ? '' : 'disabled'}>
              ${buttonLabel}
            </button>
            <button class="text-action" data-action="use-gps" ${state.locationBusy ? 'disabled' : ''}>
              ${state.locationBusy ? '現在地を取得中…' : '実際の現在地で探す'}
            </button>
            ${state.mode === 'gps' ? '<button class="text-action quiet" data-action="use-demo">位置デモへ戻る</button>' : ''}
            ${state.error ? `<p class="error-message">${esc(state.error)}</p>` : ''}
          </section>
        </main>
      </section>`;
  }

  function poseForView() {
    if (state.view === 'reward') return 'celebrate';
    if (['story', 'questions', 'answer'].includes(state.view)) return 'talk';
    return 'idle';
  }

  function revealPanel() {
    if (!state.revealed) {
      return `
        <section class="dialogue-panel compact-panel analyzing" aria-live="assertive">
          <p class="panel-kicker">古い通信を復元中</p>
          <h1>人物の輪郭が見えてきた…</h1>
          <div class="loading-line"><span></span></div>
        </section>`;
    }
    return `
      <section class="dialogue-panel compact-panel reveal-panel">
        <p class="panel-kicker">初遭遇</p>
        <h1>${esc(state.character.nameJa)}</h1>
        <p class="character-years">${esc(state.character.years)} · ${esc(state.character.subtitle)}</p>
        <blockquote>「${esc(state.character.voice.catchphrase)}」</blockquote>
        <button class="primary-action" data-action="start-story">話しかける</button>
      </section>`;
  }

  function storyPanel() {
    const last = state.storyIndex === storyBeats.length - 1;
    const dots = storyBeats.map((_, index) => `<span class="${index === state.storyIndex ? 'active' : ''}"></span>`).join('');
    return `
      <section class="dialogue-panel story-panel">
        <div class="story-head">
          <div>
            <p class="panel-kicker">クリスチャン</p>
            <div class="story-progress" aria-label="${state.storyIndex + 1} / ${storyBeats.length}">${dots}</div>
          </div>
          <button class="voice-button" data-action="speak" aria-label="この台詞を読み上げる">▶ 聞く</button>
        </div>
        <p class="story-text">${esc(storyBeats[state.storyIndex])}</p>
        <button class="primary-action" data-action="next-story">${last ? 'もっと聞いてみる' : '次の話へ'}</button>
      </section>`;
  }

  function questionsPanel() {
    return `
      <section class="dialogue-panel question-panel">
        <p class="panel-kicker">本人へ質問する</p>
        <h1>何を聞いてみる？</h1>
        <div class="question-list">
          ${state.character.questions.map((question, index) => `
            <button data-action="choose-question" data-question="${esc(question.id)}">
              <span>0${index + 1}</span>${esc(question.question)}
            </button>`).join('')}
        </div>
      </section>`;
  }

  function answerPanel() {
    const question = state.character.questions.find(item => item.id === state.selectedQuestion);
    const unlockedNodes = question.unlockNodeIds
      .map(id => state.data.relationNodes.find(node => node.id === id))
      .filter(Boolean);
    return `
      <section class="dialogue-panel answer-panel">
        <div class="story-head">
          <p class="panel-kicker">${esc(question.question)}</p>
          <button class="voice-button" data-action="speak" aria-label="答えを読み上げる">▶ 聞く</button>
        </div>
        <p class="answer-text">${esc(shortAnswers[question.id] || question.answer)}</p>
        <div class="connection-preview">
          <span>つながりを発見</span>
          ${unlockedNodes.map(node => `<strong>${esc(nodeLabels[node.id] || node.title)}</strong>`).join('')}
        </div>
        <button class="primary-action" data-action="unlock-character">図鑑に記録する</button>
      </section>`;
  }

  function rewardPanel() {
    const question = state.character.questions.find(item => item.id === state.selectedQuestion)
      || state.character.questions[0];
    const node = state.data.relationNodes.find(item => item.id === question.unlockNodeIds[0]);
    return `
      <section class="dialogue-panel reward-panel">
        <p class="panel-kicker">図鑑に新しく記録</p>
        <h1>${esc(state.character.nameJa)}</h1>
        <p>街をつくった人物と、ひとつの歴史がつながった。</p>
        <div class="reward-chip"><span>獲得</span>${esc(nodeLabels[node?.id] || node?.title || 'Cincinnatiの歴史')}</div>
        <button class="primary-action" data-action="back-to-scan">次の信号を探す</button>
      </section>`;
  }

  function panelForView() {
    if (state.view === 'reveal') return revealPanel();
    if (state.view === 'story') return storyPanel();
    if (state.view === 'questions') return questionsPanel();
    if (state.view === 'answer') return answerPanel();
    return rewardPanel();
  }

  function encounterTemplate() {
    const pose = poseForView();
    const silhouette = state.view === 'reveal' && !state.revealed;
    return `
      <section class="experience encounter-experience view-${state.view} ${state.revealed ? 'is-revealed' : ''}">
        <div class="encounter-burst" aria-hidden="true"></div>
        <div class="particle-field" aria-hidden="true">${particles()}</div>
        ${topbar(true)}
        <p class="encounter-signal">SIGNAL 01 · ${esc(state.spot.name)}</p>

        <main class="character-stage">
          <div class="character-drift ${state.view === 'reward' ? 'reward-drift' : ''}">
            <div class="character-breathe">
              <img class="character-image ${silhouette ? 'silhouette' : ''}" src="${POSES[pose]}" alt="${silhouette ? 'まだ正体の分からない人物' : esc(state.character.nameJa)}">
            </div>
          </div>
          <div class="character-shadow" aria-hidden="true"></div>
        </main>

        ${panelForView()}
      </section>`;
  }

  function render() {
    root.innerHTML = state.view === 'scan' ? scanTemplate() : encounterTemplate();
    document.body.dataset.view = state.view;
    requestAnimationFrame(() => {
      startCharacterDrift();
      root.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    });
  }

  function startCharacterDrift() {
    const element = root.querySelector('.character-drift');
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const drift = () => {
      if (!element.isConnected) return;
      const x = Math.round((Math.random() - 0.5) * 28);
      const y = Math.round((Math.random() - 0.5) * 34);
      const rotate = (Math.random() - 0.5) * 3.4;
      const duration = 3800 + Math.random() * 2800;
      const currentTransform = getComputedStyle(element).transform;
      const animation = element.animate([
        { transform: currentTransform === 'none' ? 'translate3d(0,0,0)' : currentTransform },
        { transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)` },
      ], {
        duration,
        easing: 'ease-in-out',
        fill: 'forwards',
      });
      animation.finished.then(drift).catch(() => {});
    };
    drift();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function startEncounter() {
    clearTimeout(state.revealTimer);
    state.view = 'reveal';
    state.revealed = false;
    state.storyIndex = 0;
    state.selectedQuestion = null;
    navigator.vibrate?.([35, 65, 55]);
    render();
    state.revealTimer = setTimeout(() => {
      if (state.view !== 'reveal') return;
      state.revealed = true;
      render();
    }, 1250);
  }

  function speakCurrent() {
    if (!window.speechSynthesis) {
      showToast('このブラウザは読み上げに対応していません。');
      return;
    }
    let text = storyBeats[state.storyIndex];
    if (state.view === 'answer') {
      const question = state.character.questions.find(item => item.id === state.selectedQuestion);
      text = shortAnswers[question?.id] || question?.answer || text;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = state.character.voice.ttsRate;
    utterance.pitch = state.character.voice.ttsPitch;
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith('ja'));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      state.error = 'この端末では現在地を取得できません。';
      render();
      return;
    }
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      state.error = '現在地の利用にはHTTPSが必要です。';
      render();
      return;
    }
    state.locationBusy = true;
    state.error = '';
    render();
    navigator.geolocation.getCurrentPosition(position => {
      state.location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      state.mode = 'gps';
      state.locationBusy = false;
      save();
      render();
    }, error => {
      state.locationBusy = false;
      state.error = error.code === 1
        ? '現在地が許可されていません。位置デモならすぐ試せます。'
        : '現在地を取得できませんでした。';
      render();
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    });
  }

  function unlockCharacter() {
    const question = state.character.questions.find(item => item.id === state.selectedQuestion)
      || state.character.questions[0];
    if (!state.unlocked.includes(CHARACTER_ID)) state.unlocked.push(CHARACTER_ID);
    for (const node of question.unlockNodeIds) {
      if (!state.nodes.includes(node)) state.nodes.push(node);
    }
    save();
    state.view = 'reward';
    navigator.vibrate?.([55, 45, 90]);
    render();
  }

  async function handleAction(button) {
    const action = button.dataset.action;
    if (action === 'start-encounter') startEncounter();
    else if (action === 'start-story') {
      state.view = 'story';
      state.storyIndex = 0;
      render();
    } else if (action === 'next-story') {
      if (state.storyIndex < storyBeats.length - 1) state.storyIndex += 1;
      else state.view = 'questions';
      render();
    } else if (action === 'choose-question') {
      state.selectedQuestion = button.dataset.question;
      state.view = 'answer';
      render();
    } else if (action === 'unlock-character') unlockCharacter();
    else if (action === 'back-to-scan') {
      clearTimeout(state.revealTimer);
      window.speechSynthesis?.cancel();
      state.view = 'scan';
      render();
    } else if (action === 'speak') speakCurrent();
    else if (action === 'use-gps') useCurrentLocation();
    else if (action === 'use-demo') {
      state.mode = 'demo';
      state.location = null;
      state.error = '';
      save();
      render();
    }
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button && !button.disabled) void handleAction(button);
  });

  async function init() {
    try {
      const response = await fetch('./data/cincinnati-alpha.json');
      if (!response.ok) throw new Error(`data ${response.status}`);
      state.data = await response.json();
      state.character = state.data.characters.find(item => item.id === CHARACTER_ID);
      state.spot = state.data.spots.find(item => item.id === SPOT_ID);
      if (!state.character || !state.spot) throw new Error('encounter data missing');
      state.view = 'scan';
      render();
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.warn);
    } catch (error) {
      console.error(error);
      root.innerHTML = `
        <section class="fatal-error">
          <strong>街の信号を読み込めませんでした。</strong>
          <button class="primary-action" onclick="location.reload()">もう一度試す</button>
        </section>`;
    }
  }

  void init();
})();
