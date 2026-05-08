// 跑酷游戏（Canvas） - 人物头上跟随文字“孙雨豪”
// Controls: Space / ArrowUp = jump, ArrowDown = slide (短时降低高度). Touch/tap to jump.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const stateEl = document.getElementById('state');
const restartBtn = document.getElementById('restart');

let best = parseInt(localStorage.getItem('runner_best') || '0', 10);
bestEl.textContent = best;

const GROUND_Y = H - 80;
const GRAVITY = 0.9;

let keys = {};
let lastTime = null;
let running = true;
let gameOver = false;
let score = 0;
let speed = 6;
let spawnTimer = 0;
let obstacles = [];
let bgOffset = 0;

// Label tracking position (for smoothing)
let labelPos = {x: 0, y: 0};

// Player
const player = {
  x: 140,
  y: GROUND_Y,
  w: 44,
  h: 72,
  vy: 0,
  onGround: true,
  sliding: false,
  slideTimer: 0
};

// Utility
function randRange(a,b){ return a + Math.random()*(b-a); }
function rectIntersect(a,b){
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }
function playClick(){ try{ const ac = new (window.AudioContext||window.webkitAudioContext)(); const o = ac.createOscillator(); const g = ac.createGain(); o.type='sine'; o.frequency.value=900; o.connect(g); g.connect(ac.destination); g.gain.value=0.001; const t=ac.currentTime; g.gain.linearRampToValueAtTime(0.12,t+0.002); o.start(t); g.gain.exponentialRampToValueAtTime(0.001,t+0.08); o.stop(t+0.1);}catch(e){} }

// Input
window.addEventListener('keydown', e=>{
  keys[e.key] = true;
  // prevent arrow scroll
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e=>{ keys[e.key] = false; });

// Touch: tap to jump, touch and hold downward for slide not implemented (simple tap)
canvas.addEventListener('touchstart', e=>{
  e.preventDefault();
  if(gameOver) return;
  doJump();
});
canvas.addEventListener('mousedown', e=>{
  // left click to jump (also helps resume audio)
  if(gameOver) return;
  doJump();
});

restartBtn.addEventListener('click', restart);

// Game actions
function doJump(){
  if(!player.onGround) return;
  player.vy = -16;
  player.onGround = false;
  player.sliding = false;
  playClick();
}

function doSlide(){
  if(!player.onGround || player.sliding) return;
  player.sliding = true;
  player.slideTimer = 28; // frames
  player.h = 40;
  // lower center
}

function spawnObstacle(){
  const type = Math.random() < 0.25 ? 'low' : 'high'; // low: need jump, high: slide under
  if(type === 'low'){
    const h = Math.floor(randRange(28,48));
    obstacles.push({
      x: W + 20,
      y: GROUND_Y - h,
      w: Math.floor(randRange(34,62)),
      h: h,
      vx: -speed
    });
  } else {
    // tall barrier leaving small gap under (slide)
    const h = Math.floor(randRange(60,110));
    obstacles.push({
      x: W + 20,
      y: GROUND_Y - h,
      w: Math.floor(randRange(28,48)),
      h: h,
      vx: -speed
    });
  }
}

// Reset
function restart(){
  obstacles = [];
  score = 0;
  speed = 6;
  spawnTimer = 0;
  gameOver = false;
  running = true;
  player.x = 140; player.y = GROUND_Y; player.vy = 0; player.onGround = true; player.h = 72; player.sliding = false;
  lastTime = null;
  stateEl.textContent = '';
  labelPos = {x: player.x, y: player.y - player.h - 12};
  requestAnimationFrame(loop);
}

// Update
function update(dt){
  if(gameOver) return;
  // controls
  if((keys[' '] || keys['ArrowUp'] || keys['w']) && player.onGround){
    doJump();
  }
  if((keys['ArrowDown'] || keys['s']) && player.onGround){
    doSlide();
  }

  // physics
  player.vy += GRAVITY;
  player.y += player.vy;
  if(player.y > GROUND_Y){
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
  } else player.onGround = false;

  // slide timer
  if(player.sliding){
    player.slideTimer--;
    if(player.slideTimer <= 0){
      player.sliding = false;
      player.h = 72;
    }
  }

  // obstacles movement
  for(let i = obstacles.length - 1; i >= 0; i--){
    const o = obstacles[i];
    o.x += o.vx;
    // off-screen remove
    if(o.x + o.w < -50) obstacles.splice(i,1);
  }

  // spawn logic (speed increases slowly)
  spawnTimer -= dt;
  if(spawnTimer <= 0){
    spawnObstacle();
    spawnTimer = randRange(60 - Math.min(30, score/10), 140 - Math.min(60, score/8)); // frames
  }

  // gradually increase speed with score
  speed = 6 + Math.floor(score/100) * 0.6;
  obstacles.forEach(o => o.vx = -speed);

  // score
  score += dt * 0.06 * (speed/6) * 60; // scaled per frame
  score = Math.floor(score);

  // collision
  const pbox = {x: player.x - 22, y: player.y - player.h, w: 44, h: player.h};
  for(const o of obstacles){
    const obox = {x: o.x, y: o.y, w: o.w, h: o.h};
    if(rectIntersect(pbox, obox)){
      // consider sliding: if obstacle tall and player is sliding under, allow
      const playerBottom = player.y;
      const obstacleBottom = o.y + o.h;
      // if player top is above obstacle top, it's a hit (simple)
      // More robust: if overlap and not enough clearance -> hit
      const clearance = (player.sliding ? 16 : 32);
      if(!(player.sliding && (player.y - (player.h/2) > o.y + o.h - clearance))){
        // hit
        endGame();
        break;
      }
    }
  }

  // label tracking target above player's head
  const targetX = player.x;
  const targetY = player.y - player.h - 14;
  labelPos.x = lerp(labelPos.x, targetX, 0.22);
  labelPos.y = lerp(labelPos.y, targetY, 0.22);
}

// End game
function endGame(){
  gameOver = true;
  running = false;
  stateEl.textContent = '游戏结束';
  playGameOver();
  // update best
  if(score > best){
    best = score;
    localStorage.setItem('runner_best', String(best));
    bestEl.textContent = best;
  }
}

// Simple sound
function playGameOver(){
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type='sine'; o.frequency.value = 220;
    o.connect(g); g.connect(ac.destination);
    const t = ac.currentTime;
    g.gain.value = 0.001; g.gain.linearRampToValueAtTime(0.12,t+0.01);
    o.start(t); g.gain.exponentialRampToValueAtTime(0.001,t+0.7); o.stop(t+0.75);
  }catch(e){}
}

// Render
function render(){
  // background sky (clear)
  ctx.clearRect(0,0,W,H);

  // parallax background
  bgOffset = (bgOffset + speed*0.3) % W;
  drawBackground(bgOffset);

  // ground
  ctx.fillStyle = '#25333f';
  ctx.fillRect(0, GROUND_Y + 1, W, H - GROUND_Y);

  // obstacles
  for(const o of obstacles){
    ctx.fillStyle = '#8b4d1e';
    roundRect(ctx, o.x, o.y, o.w, o.h, 6, true);
    // highlight
    ctx.strokeStyle = '#b0754a'; ctx.lineWidth = 2;
    ctx.strokeRect(o.x+2, o.y+2, o.w-4, o.h-4);
  }

  // player (body)
  const px = player.x - player.w/2;
  const py = player.y - player.h;
  ctx.fillStyle = '#2ea3ff';
  roundRect(ctx, px, py, player.w, player.h, 8, true);

  // head circle
  ctx.fillStyle = '#fff8';
  ctx.beginPath();
  ctx.arc(player.x, py + 14, 12, 0, Math.PI*2);
  ctx.fill();

  // draw a shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(player.x, GROUND_Y + 12, 26, 8, 0, 0, Math.PI*2);
  ctx.fill();

  // label "孙雨豪" above head, with a small floating effect
  const bob = Math.sin(Date.now()/250) * 2;
  ctx.font = 'bold 18px "Microsoft Yahei",sans-serif';
  ctx.textAlign = 'center';
  // outline for readability
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText('孙雨豪', labelPos.x, labelPos.y + bob);
  ctx.fillStyle = '#fffce6';
  ctx.fillText('孙雨豪', labelPos.x, labelPos.y + bob);

  // HUD numbers
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('分数: ' + score, 12, 26);
  ctx.fillText('速度: ' + Math.round(speed*10)/10, 12, 46);
}

// background drawing
function drawBackground(offset){
  // sky gradient already via CSS canvas background; draw simple hills/parallax layers
  // far hills
  ctx.fillStyle = '#143448';
  ctx.beginPath();
  for(let x=-offset; x<=W+200; x += 120){
    ctx.moveTo(x, GROUND_Y+20);
    ctx.quadraticCurveTo(x+40, GROUND_Y-80, x+120, GROUND_Y+20);
  }
  ctx.fill();

  // near hills
  ctx.fillStyle = '#1d3f52';
  ctx.beginPath();
  for(let x:-offset*1.4; x<=W+200; x += 80){
    ctx.moveTo(x, GROUND_Y+40);
    ctx.quadraticCurveTo(x+30, GROUND_Y-30, x+80, GROUND_Y+40);
  }
  ctx.fill();
}

// drawing helper
function roundRect(ctx, x, y, w, h, r=6, fill=true){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if(fill) ctx.fill();
}

// Main loop
function loop(ts){
  if(!lastTime) lastTime = ts;
  const dt = Math.min(40, ts - lastTime); // ms
  lastTime = ts;

  if(!gameOver){
    update(1); // using frame-based updates for simplicity
  }

  render();
  scoreEl.textContent = score;

  if(!gameOver) requestAnimationFrame(loop);
}

// start initial state
labelPos = {x: player.x, y: player.y - player.h - 12};
requestAnimationFrame(loop);

// spawn obstacles with a timer using setInterval for consistent rhythm
setInterval(()=>{
  if(!gameOver){
    spawnTimer = 0; // allow immediate spawn decision on next update
  }
}, 800);

// also increment spawn cadence by pushing spawnTimer negative on each frame via update logic

// simple incremental spawn using setInterval to keep spawn happening even if frame-based timing differs
setInterval(()=>{
  if(gameOver) return;
  // gradually reduce spawn gap as score increases
  const baseGap = Math.max(700, 1200 - Math.min(700, Math.floor(score/2)));
  // chance to spawn
  if(Math.random() < 1 / (baseGap / 200)){
    spawnObstacle();
  }
}, 200);

// auto-pause if page hidden
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && !gameOver){
    running = false;
    stateEl.textContent = '已暂停（切换回页面继续）';
  } else if(!gameOver){
    running = true;
    stateEl.textContent = '';
    lastTime = null; requestAnimationFrame(loop);
  }
});