const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreNode = document.getElementById("score");
const missesNode = document.getElementById("misses");
const timeNode = document.getElementById("time");

const game = {
  width: canvas.width,
  height: canvas.height,
  status: "ready",
  score: 0,
  misses: 0,
  maxMisses: 8,
  roundDuration: 120,
  timeLeft: 120,
  elapsed: 0,
  spawnTimer: 0,
  spawnDelay: 1.4,
  keys: new Set(),
  crosshair: {
    x: 180,
    y: 280,
    speed: 260,
    radius: 24
  },
  torpedoes: [],
  targets: [],
  ripples: [],
  audio: {
    context: null,
    master: null,
    enabled: false
  },
  lastTime: 0
};

function resetGame() {
  game.status = "running";
  game.score = 0;
  game.misses = 0;
  game.timeLeft = game.roundDuration;
  game.elapsed = 0;
  game.spawnTimer = 0;
  game.spawnDelay = 1.35;
  game.crosshair.y = game.height * 0.52;
  game.torpedoes = [];
  game.targets = [];
  game.ripples = [];
  syncHud();
}

function syncHud() {
  scoreNode.textContent = String(game.score).padStart(4, "0");
  missesNode.textContent = `${game.misses} / ${game.maxMisses}`;
  timeNode.textContent = Math.max(0, Math.ceil(game.timeLeft));
}

function ensureAudio() {
  if (game.audio.context) {
    if (game.audio.context.state === "suspended") {
      game.audio.context.resume().catch(() => {});
    }
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0.05;
  master.connect(context.destination);

  game.audio.context = context;
  game.audio.master = master;
  game.audio.enabled = true;
}

function playTone({ frequency, duration, type, volume, slideTo }) {
  if (!game.audio.enabled || !game.audio.context || !game.audio.master) {
    return;
  }

  const { context, master } = game.audio;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playSound(kind) {
  ensureAudio();
  if (!game.audio.enabled) {
    return;
  }

  if (kind === "fire") {
    playTone({ frequency: 180, duration: 0.16, type: "square", volume: 0.22, slideTo: 120 });
    return;
  }

  if (kind === "hit") {
    playTone({ frequency: 420, duration: 0.08, type: "triangle", volume: 0.2, slideTo: 640 });
    setTimeout(() => playTone({ frequency: 620, duration: 0.1, type: "triangle", volume: 0.15, slideTo: 860 }), 40);
    return;
  }

  if (kind === "miss") {
    playTone({ frequency: 150, duration: 0.2, type: "sawtooth", volume: 0.16, slideTo: 90 });
    return;
  }

  if (kind === "start") {
    playTone({ frequency: 260, duration: 0.08, type: "square", volume: 0.18, slideTo: 360 });
    setTimeout(() => playTone({ frequency: 360, duration: 0.1, type: "square", volume: 0.16, slideTo: 520 }), 70);
    return;
  }

  if (kind === "gameover") {
    playTone({ frequency: 260, duration: 0.14, type: "sawtooth", volume: 0.18, slideTo: 180 });
    setTimeout(() => playTone({ frequency: 180, duration: 0.18, type: "sawtooth", volume: 0.16, slideTo: 110 }), 120);
  }
}

function fireTorpedo() {
  if (game.status !== "running") {
    return;
  }

  const last = game.torpedoes[game.torpedoes.length - 1];
  if (last && last.x < 320) {
    return;
  }

  game.torpedoes.push({
    x: 90,
    y: game.crosshair.y,
    speed: 540,
    radius: 6,
    active: true
  });

  playSound("fire");
}

function spawnTarget() {
  const laneTop = 110;
  const laneHeight = 200;
  const size = 48 + Math.random() * 34;
  const speed = 95 + Math.random() * 75 + (game.roundDuration - game.timeLeft) * 0.8;
  const y = laneTop + Math.random() * laneHeight;

  game.targets.push({
    x: game.width + size,
    y,
    w: size * 1.65,
    h: size * 0.55,
    speed,
    bob: Math.random() * Math.PI * 2,
    bobSpeed: 1.8 + Math.random() * 1.6,
    value: size < 62 ? 200 : 100
  });
}

function createRipple(x, y, color) {
  game.ripples.push({
    x,
    y,
    radius: 10,
    alpha: 1,
    color
  });
}

function update(dt) {
  if (game.status !== "running") {
    return;
  }

  game.elapsed += dt;
  game.timeLeft -= dt;
  game.spawnTimer += dt;

  if (game.spawnTimer >= game.spawnDelay) {
    spawnTarget();
    game.spawnTimer = 0;
    game.spawnDelay = Math.max(0.7, 1.35 - game.elapsed * 0.004);
  }

  if (game.keys.has("ArrowUp") || game.keys.has("KeyW")) {
    game.crosshair.y -= game.crosshair.speed * dt;
  }
  if (game.keys.has("ArrowDown") || game.keys.has("KeyS")) {
    game.crosshair.y += game.crosshair.speed * dt;
  }

  game.crosshair.y = Math.max(70, Math.min(game.height - 80, game.crosshair.y));

  game.torpedoes.forEach((torpedo) => {
    torpedo.x += torpedo.speed * dt;
  });
  game.torpedoes = game.torpedoes.filter((torpedo) => torpedo.x < game.width + 40 && torpedo.active);

  game.targets.forEach((target) => {
    target.x -= target.speed * dt;
    target.bob += target.bobSpeed * dt;
  });

  for (const torpedo of game.torpedoes) {
    for (const target of game.targets) {
      if (
        torpedo.x + torpedo.radius > target.x &&
        torpedo.x - torpedo.radius < target.x + target.w &&
        torpedo.y + torpedo.radius > target.y &&
        torpedo.y - torpedo.radius < target.y + target.h
      ) {
        torpedo.active = false;
        target.hit = true;
        game.score += target.value;
        createRipple(target.x + target.w * 0.5, target.y + target.h * 0.5, "rgba(245, 213, 71, 1)");
        playSound("hit");
      }
    }
  }

  const escaped = game.targets.filter((target) => target.x + target.w < 0 && !target.hit);
  if (escaped.length > 0) {
    game.misses += escaped.length;
    escaped.forEach((target) => createRipple(target.x + target.w, target.y + target.h * 0.5, "rgba(255, 124, 99, 1)"));
    playSound("miss");
  }

  game.targets = game.targets.filter((target) => target.x + target.w > -80 && !target.hit);

  game.ripples.forEach((ripple) => {
    ripple.radius += 90 * dt;
    ripple.alpha -= 1.5 * dt;
  });
  game.ripples = game.ripples.filter((ripple) => ripple.alpha > 0);

  if (game.timeLeft <= 0 || game.misses >= game.maxMisses) {
    game.status = "gameover";
    playSound("gameover");
  }

  syncHud();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
  gradient.addColorStop(0, "#1e5a3b");
  gradient.addColorStop(0.35, "#14462d");
  gradient.addColorStop(0.36, "#0e3625");
  gradient.addColorStop(1, "#082319");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, game.width, game.height);

  ctx.fillStyle = "rgba(4, 14, 10, 0.3)";
  for (let i = 0; i < 6; i += 1) {
    const y = 120 + i * 36;
    ctx.fillRect(0, y, game.width, 3);
  }

  ctx.strokeStyle = "rgba(148, 255, 192, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i += 1) {
    const y = 90 + i * 55;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(game.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(8, 22, 16, 0.8)";
  ctx.fillRect(0, game.height - 115, game.width, 115);

  ctx.fillStyle = "rgba(17, 77, 50, 0.6)";
  ctx.beginPath();
  ctx.moveTo(0, game.height - 72);
  for (let x = 0; x <= game.width; x += 36) {
    const y = game.height - 72 + Math.sin(x * 0.018 + game.elapsed * 2.1) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(game.width, game.height);
  ctx.lineTo(0, game.height);
  ctx.closePath();
  ctx.fill();
}

function drawSubmarineHud() {
  ctx.strokeStyle = "rgba(47, 224, 135, 0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(70, game.height - 60, 46, Math.PI, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(70, game.height - 106);
  ctx.lineTo(70, game.height - 138);
  ctx.stroke();
}

function drawTarget(target) {
  const bobY = Math.sin(target.bob) * 4;
  const x = target.x;
  const y = target.y + bobY;

  ctx.fillStyle = "rgba(222, 255, 229, 0.86)";
  ctx.fillRect(x, y + target.h * 0.2, target.w, target.h * 0.38);

  ctx.beginPath();
  ctx.moveTo(x + target.w * 0.18, y + target.h * 0.2);
  ctx.lineTo(x + target.w * 0.34, y);
  ctx.lineTo(x + target.w * 0.68, y);
  ctx.lineTo(x + target.w * 0.82, y + target.h * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(47, 224, 135, 0.18)";
  ctx.fillRect(x + 10, y + target.h * 0.02, target.w * 0.15, target.h * 0.18);
}

function drawTorpedo(torpedo) {
  ctx.fillStyle = "#d8fff0";
  ctx.beginPath();
  ctx.arc(torpedo.x, torpedo.y, torpedo.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(216, 255, 240, 0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(torpedo.x - 18, torpedo.y);
  ctx.lineTo(torpedo.x - 4, torpedo.y);
  ctx.stroke();
}

function drawCrosshair() {
  const { x, y, radius } = game.crosshair;
  ctx.strokeStyle = "#2fe087";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - radius - 18, y);
  ctx.lineTo(x + radius + 18, y);
  ctx.moveTo(x, y - radius - 18);
  ctx.lineTo(x, y + radius + 18);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#2fe087";
  ctx.fill();
}

function drawRipples() {
  game.ripples.forEach((ripple) => {
    ctx.strokeStyle = ripple.color.replace("1)", `${Math.max(0, ripple.alpha)})`);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawMessage() {
  if (game.status === "running") {
    return;
  }

  ctx.fillStyle = "rgba(1, 8, 5, 0.62)";
  ctx.fillRect(150, 150, game.width - 300, 220);

  ctx.strokeStyle = "rgba(47, 224, 135, 0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(150, 150, game.width - 300, 220);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e9fff2";
  ctx.font = "bold 38px Trebuchet MS";
  ctx.fillText(game.status === "ready" ? "RETRO SEA BATTLE" : "РАУНД ЗАВЕРШЕН", game.width / 2, 220);

  ctx.fillStyle = "#2fe087";
  ctx.font = "22px Trebuchet MS";
  if (game.status === "ready") {
    ctx.fillText("Нажми Enter, чтобы начать", game.width / 2, 268);
    ctx.font = "18px Trebuchet MS";
    ctx.fillText("W / S или стрелки вверх / вниз двигают прицел", game.width / 2, 306);
    ctx.fillText("Пробел стреляет. Enter запускает новый раунд.", game.width / 2, 338);
  } else {
    ctx.fillText(`Счет: ${String(game.score).padStart(4, "0")}`, game.width / 2, 270);
    ctx.font = "18px Trebuchet MS";
    ctx.fillText("Нажми Enter для нового раунда", game.width / 2, 308);
  }

  ctx.textAlign = "left";
}

function render() {
  ctx.clearRect(0, 0, game.width, game.height);
  drawBackground();
  drawSubmarineHud();
  game.targets.forEach(drawTarget);
  game.torpedoes.forEach(drawTorpedo);
  drawRipples();
  drawCrosshair();
  drawMessage();
}

function loop(timestamp) {
  if (!game.lastTime) {
    game.lastTime = timestamp;
  }
  const dt = Math.min(0.033, (timestamp - game.lastTime) / 1000);
  game.lastTime = timestamp;

  update(dt);
  render();
  requestAnimationFrame(loop);
}

document.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "KeyW", "KeyS", "Space", "Enter"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "Enter") {
    ensureAudio();
    if (game.status !== "running") {
      resetGame();
      playSound("start");
    }
    return;
  }

  if (event.code === "Space") {
    ensureAudio();
    fireTorpedo();
    return;
  }

  game.keys.add(event.code);
});

document.addEventListener("keyup", (event) => {
  game.keys.delete(event.code);
});

syncHud();
requestAnimationFrame(loop);
