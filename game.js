(() => {
  'use strict';
  const canvas = document.getElementById('pong');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const W = 960, H = 500, paddleHeight = 94, paddleWidth = 14, radius = 19;
  const settings = { easy: { speed: 230, follow: 2.6 }, normal: { speed: 330, follow: 3.8 }, hard: { speed: 440, follow: 5.4 } };
  const keys = new Set();
  const player = { y: H / 2, score: 0 };
  const computer = { y: H / 2, score: 0 };
  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  let state = 'ready', lastTime = 0, serveDelay = 0, rally = 0, sound = false, audio;
  let particles = [], trail = [];
  const replayFrames = [];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function tone(frequency, duration = 0.08) {
    if (!sound || !audio) return;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.055, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + duration);
  }
  function overlay(eyebrow, title, copy, action) {
    $('game-overlay').hidden = false;
    $('overlay-eyebrow').textContent = eyebrow;
    $('overlay-title').textContent = title;
    $('overlay-copy').textContent = copy;
    $('start-game').textContent = action;
  }
  function serve(direction) {
    ball.x = W / 2; ball.y = H / 2;
    const angle = (Math.random() - 0.5) * 0.85;
    ball.vx = direction * 370 * Math.cos(angle); ball.vy = 370 * Math.sin(angle);
    serveDelay = 0.85; rally = 0; trail = [];
  }
  function start() {
    if (state !== 'paused') {
      player.score = computer.score = 0;
      player.y = computer.y = H / 2;
      $('player-score').textContent = $('computer-score').textContent = '0';
      particles = []; serve(Math.random() < 0.5 ? -1 : 1);
    }
    state = 'playing'; $('game-overlay').hidden = true;
    $('pause-game').disabled = false; $('pause-game').textContent = 'Pause';
    $('game-status').textContent = `Keep that little glow going. First to ${$('winning-score').value}!`;
    canvas.focus({ preventScroll: true });
  }
  function pause() {
    if (state === 'paused') { start(); return; }
    if (state !== 'playing') return;
    state = 'paused'; keys.clear(); $('pause-game').textContent = 'Resume';
    $('game-status').textContent = 'Taking a little breather.';
    overlay('A MOMENT OF CALM', 'Just floating.', 'Your rally will be right here.', 'Back to the glow →');
  }
  function point(winner) {
    winner.score++;
    $('player-score').textContent = player.score;
    $('computer-score').textContent = computer.score;
    tone(winner === player ? 660 : 180, 0.22);
    const winningScore = Number($('winning-score').value);
    if (winner.score > winningScore) {
      state = 'over'; $('pause-game').disabled = true;
      const won = winner === player;
      $('game-status').textContent = `${won ? 'You win!' : 'The Deep wins!'} Final score: ${player.score}–${computer.score}.`;
      overlay(won ? 'LOOK AT YOU GLOW!' : 'THE TIDE TURNS', won ? 'You’re making waves.' : 'The Deep takes this one.', `Final score ${player.score}–${computer.score}. ${won ? 'Eight arms up for the champion.' : 'Another tide, another chance.'}`, 'Play again →');
      $('start-game').focus({ preventScroll: true });
    } else {
      $('game-status').textContent = winner === player ? 'A point for you. Brilliant!' : 'A point for The Deep. You’ve got this.';
      serve(winner === player ? -1 : 1);
    }
  }
  function hit(paddle, direction) {
    const offset = clamp((ball.y - paddle.y) / (paddleHeight / 2), -1, 1);
    // Every paddle hit preserves the original serve speed of 370 pixels per second.
    const speed = Math.min(760, Math.hypot(ball.vx, ball.vy) + 25);
    ball.vx = direction * speed * Math.cos(offset * 1.02);
    ball.vy = speed * Math.sin(offset * 1.02);
    ball.x = direction > 0 ? 44 + paddleWidth + radius : W - 44 - paddleWidth - radius;
    rally++; tone(330 + Math.min(rally, 12) * 25);
    if (!reducedMotion) for (let i = 0; i < 9; i++) particles.push({ x: ball.x, y: ball.y, vx: (Math.random() - 0.5) * 180, vy: (Math.random() - 0.5) * 180, life: 0.5 });
    $('game-status').textContent = rally > 2 ? `${rally} hits. Now that’s a glow-up.` : 'Nice catch. Keep it glowing!';
  }
  function update(dt) {
    const move = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
    player.y = clamp(player.y + move * 520 * dt, paddleHeight / 2, H - paddleHeight / 2);
    const level = settings[$('difficulty').value];
    const target = ball.vx > 0 ? ball.y : H / 2;
    computer.y = clamp(computer.y + clamp((target - computer.y) * level.follow, -level.speed, level.speed) * dt, paddleHeight / 2, H - paddleHeight / 2);
    if (serveDelay > 0) { serveDelay -= dt; return; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.y < radius || ball.y > H - radius) {
      ball.y = clamp(ball.y, radius, H - radius); ball.vy *= -1; tone(220);
    }
    if (ball.vx < 0 && ball.x - radius <= 44 + paddleWidth && ball.x >= 44 && Math.abs(ball.y - player.y) < paddleHeight / 2 + radius * 0.75) hit(player, 1);
    if (ball.vx > 0 && ball.x + radius >= W - 44 - paddleWidth && ball.x <= W - 44 && Math.abs(ball.y - computer.y) < paddleHeight / 2 + radius * 0.75) hit(computer, -1);
    if (ball.x < -radius * 2) point(computer);
    else if (ball.x > W + radius * 2) point(player);
    if (!reducedMotion) { trail.push({ x: ball.x, y: ball.y }); if (trail.length > 12) trail.shift(); }
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    particles = particles.filter(p => p.life > 0);
  }
  function octo(x, y, time) {
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = '#ffcf7e'; ctx.shadowBlur = 28;
    ctx.strokeStyle = '#eea17e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const tx = (i - 3.5) * 4.7;
      const wave = reducedMotion ? 0 : Math.sin(time * 6 + i) * 3;
      ctx.beginPath(); ctx.moveTo(tx * 0.65, 7);
      ctx.bezierCurveTo(tx, 25 + wave, tx + 9, 24 + wave, tx + 5, 13 + wave); ctx.stroke();
    }
    const glow = ctx.createRadialGradient(-5, -9, 1, 0, 0, 22);
    glow.addColorStop(0, '#fff3ba'); glow.addColorStop(0.55, '#f9d185'); glow.addColorStop(1, '#e69870');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(0, -3, 18, 21, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#533d30';
    for (const eye of [-6, 6]) { ctx.beginPath(); ctx.ellipse(eye, 2, 1.8, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#533d30'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 6, 3, 0, Math.PI); ctx.stroke(); ctx.restore();
  }
  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#96bca314'; ctx.lineWidth = 1;
    for (let x = 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 30; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = '#a5c1ad35'; ctx.setLineDash([5, 12]); ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 66, 0, Math.PI * 2); ctx.stroke();
    [player, computer].forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#f1b48b' : '#b2c6a0'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.roundRect(i === 0 ? 44 : W - 44 - paddleWidth, p.y - paddleHeight / 2, paddleWidth, paddleHeight, 7); ctx.fill();
    });
    ctx.shadowBlur = 0;
    trail.forEach((p, i) => { ctx.fillStyle = `rgba(249,209,133,${i / trail.length * 0.16})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + i * 0.6, 0, Math.PI * 2); ctx.fill(); });
    particles.forEach(p => { ctx.fillStyle = `rgba(255,218,152,${p.life * 2})`; ctx.fillRect(p.x, p.y, 3, 3); });
    octo(ball.x, ball.y, time);
  }
  function frame(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.033); lastTime = timestamp;
    if (state === 'playing') update(dt);
    draw(state === 'playing' ? timestamp / 1000 : 0);
    replayFrames.push(canvas.toDataURL('image/png'));
    requestAnimationFrame(frame);
  }
  canvas.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'w', 's', ' '].includes(key)) {
      event.preventDefault();
      if (key === ' ' && !event.repeat) pause();
      else keys.add(key);
    }
  });
  window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  function movePointer(event) {
    if (state !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    player.y = clamp(event.clientY - rect.top, paddleHeight / 2, H - paddleHeight / 2);
  }
  canvas.addEventListener('pointerdown', event => { canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId); movePointer(event); });
  canvas.addEventListener('pointermove', movePointer);
  canvas.addEventListener('blur', () => keys.clear());
  window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
  $('start-game').addEventListener('click', start);
  $('pause-game').addEventListener('click', pause);
  $('restart-game').addEventListener('click', start);
  $('difficulty').addEventListener('change', () => { $('game-status').textContent = 'Current changed. Start or resume when you’re ready.'; });
  $('sound-game').addEventListener('click', () => {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      audio.resume(); sound = !sound;
      $('sound-game').textContent = `Sound: ${sound ? 'on' : 'off'}`;
      $('sound-game').setAttribute('aria-pressed', String(sound));
      tone(440);
    } catch { $('sound-game').textContent = 'Sound unavailable'; }
  });
  requestAnimationFrame(frame);
})();
