// ===== SETUP =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const grassCountEl = document.getElementById('grassCount');
const grassTotalEl = document.getElementById('grassTotal');
const restartBtn = document.getElementById('restartBtn');
const joystickEl = document.getElementById('joystick');
const joyStickEl = document.getElementById('joyStick');
const rotateOverlay = document.getElementById('rotateOverlay');
const startOverlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('startBtn');

const TILE_SIZE = 40;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 12;
const PLAYER_RADIUS = 14;
const SPEED = 220; // pixels per second

// ===== STATE =====
let map = [];
let items = [];
let player = { x: 0, y: 0, facing: 0 }; // facing: radian
let joystick = { active: false, dx: 0, dy: 0, touchId: null };
let keys = { up: false, down: false, left: false, right: false };
let gameStarted = false;
let isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ===== MAP INIT =====
function initMap() {
    map = Array(MAP_HEIGHT).fill().map(() => Array(MAP_WIDTH).fill(0));
    // Danau tengah
    for (let row = 2; row < 6; row++)
        for (let col = 6; col < 10; col++)
            map[row][col] = 1;
    // Rintangan kiri bawah
    for (let row = 8; row < 11; row++) {
        map[row][2] = 1;
        map[row][3] = 1;
    }
    // Rintangan kanan atas
    for (let row = 1; row < 4; row++) {
        map[row][14] = 1;
        map[row][15] = 1;
    }
    // Genangan kecil
    map[9][13] = 1;
    map[10][13] = 1;
}

// ===== ITEMS INIT =====
function initItems() {
    const raw = [
        { x: 5,  y: 4 }, { x: 12, y: 3 },
        { x: 15, y: 8 }, { x: 17, y: 5 },
        { x: 10, y: 9 }, { x: 18, y: 10 },
        { x: 5,  y: 10 }, { x: 13, y: 2 }
    ];
    items = raw
        .filter(it => map[it.y] && map[it.y][it.x] === 0)
        .map(it => ({ ...it, collected: false }));
    grassTotalEl.textContent = items.length;
}

// ===== PLAYER INIT =====
function initPlayer() {
    let sx = 10, sy = 6;
    if (map[sy][sx] === 1) {
        outer:
        for (let y = 0; y < MAP_HEIGHT; y++)
            for (let x = 0; x < MAP_WIDTH; x++)
                if (map[y][x] === 0) { sx = x; sy = y; break outer; }
    }
    player.x = sx * TILE_SIZE + TILE_SIZE / 2;
    player.y = sy * TILE_SIZE + TILE_SIZE / 2;
    player.facing = 0;
}

// ===== UI =====
function updateUI() {
    const n = items.filter(i => i.collected).length;
    grassCountEl.textContent = n;
}

// ===== COLLISION (pixel-based) =====
function canMoveTo(px, py) {
    const r = PLAYER_RADIUS - 2;
    const pts = [
        [px - r, py - r], [px + r, py - r],
        [px - r, py + r], [px + r, py + r]
    ];
    for (const [x, y] of pts) {
        const tx = Math.floor(x / TILE_SIZE);
        const ty = Math.floor(y / TILE_SIZE);
        if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return false;
        if (map[ty][tx] === 1) return false;
    }
    return true;
}

// ===== UPDATE =====
function update(dt) {
    let vx = 0, vy = 0;

    if (joystick.active && (joystick.dx !== 0 || joystick.dy !== 0)) {
        vx = joystick.dx;
        vy = joystick.dy;
    } else {
        if (keys.left)  vx -= 1;
        if (keys.right) vx += 1;
        if (keys.up)    vy -= 1;
        if (keys.down)  vy += 1;
        if (vx !== 0 && vy !== 0) {
            const len = Math.hypot(vx, vy);
            vx /= len; vy /= len;
        }
    }

    if (vx !== 0 || vy !== 0) {
        player.facing = Math.atan2(vy, vx);

        const mx = vx * SPEED * dt;
        const my = vy * SPEED * dt;

        if (canMoveTo(player.x + mx, player.y)) player.x += mx;
        if (canMoveTo(player.x, player.y + my)) player.y += my;
    }

    // Item collection - based on player center tile
    const tx = Math.floor(player.x / TILE_SIZE);
    const ty = Math.floor(player.y / TILE_SIZE);
    const item = items.find(i => i.x === tx && i.y === ty && !i.collected);
    if (item) {
        item.collected = true;
        updateUI();
    }
}

// ===== DRAW =====
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Map
    for (let row = 0; row < MAP_HEIGHT; row++) {
        for (let col = 0; col < MAP_WIDTH; col++) {
            if (map[row][col] === 0) {
                ctx.fillStyle = ((row + col) % 2 === 0) ? '#2d5a27' : '#336b2c';
            } else {
                ctx.fillStyle = '#2c6e9e';
            }
            ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
            ctx.strokeRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    // Items (dengan efek glow)
    const t = Date.now() / 400;
    for (const item of items) {
        if (item.collected) continue;
        const cx = item.x * TILE_SIZE + TILE_SIZE / 2;
        const cy = item.y * TILE_SIZE + TILE_SIZE / 2;
        const glow = 0.5 + 0.5 * Math.sin(t);

        ctx.fillStyle = `rgba(124, 252, 0, ${glow * 0.3})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 18 + glow * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2e8b2e';
        ctx.fillRect(cx - 1, cy + 2, 2, 10);

        ctx.fillStyle = '#7cfc00';
        ctx.beginPath(); ctx.ellipse(cx - 5, cy - 2, 6, 4, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 5, cy - 2, 6, 4, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, cy - 8, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Player
    const px = player.x, py = player.y;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(px, py + 12, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00f2ea';
    ctx.beginPath();
    ctx.arc(px, py, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00a8a2';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mata mengikuti arah
    const ex = Math.cos(player.facing) * 4;
    const ey = Math.sin(player.facing) * 4;
    ctx.fillStyle = '#001f1d';
    ctx.beginPath(); ctx.arc(px - 4 + ex, py - 2 + ey, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 4 + ex, py - 2 + ey, 2.5, 0, Math.PI * 2); ctx.fill();

    // Win overlay
    const n = items.filter(i => i.collected).length;
    if (items.length > 0 && n === items.length) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 44px Arial';
        ctx.fillText('🎉 Semua Rumput Terkumpul!', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.fillText('Tap 🔄 untuk main lagi', canvas.width / 2, canvas.height / 2 + 40);
    }
}

// ===== GAME LOOP =====
let lastTime = 0;
function gameLoop(timestamp) {
    const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0;
    lastTime = timestamp;
    if (gameStarted) update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// ===== KEYBOARD (desktop) =====
document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!gameStarted && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
        enterGameMode();
    }
    if (k === 'w' || k === 'arrowup')    keys.up = true;
    if (k === 's' || k === 'arrowdown')  keys.down = true;
    if (k === 'a' || k === 'arrowleft')  keys.left = true;
    if (k === 'd' || k === 'arrowright') keys.right = true;
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
});

document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup')    keys.up = false;
    if (k === 's' || k === 'arrowdown')  keys.down = false;
    if (k === 'a' || k === 'arrowleft')  keys.left = false;
    if (k === 'd' || k === 'arrowright') keys.right = false;
});

// ===== JOYSTICK =====
function getJoyCenter() {
    const r = joystickEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function updateJoystick(clientX, clientY) {
    const c = getJoyCenter();
    let dx = clientX - c.x;
    let dy = clientY - c.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = joystickEl.offsetWidth / 2 - 30;

    if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
    }

    joyStickEl.style.transform = `translate(${dx}px, ${dy}px)`;

    const nx = dx / maxDist;
    const ny = dy / maxDist;
    const len = Math.hypot(nx, ny);

    if (len > 0.15) {
        joystick.dx = nx;
        joystick.dy = ny;
    } else {
        joystick.dx = 0;
        joystick.dy = 0;
    }
}

function resetJoystick() {
    joystick.active = false;
    joystick.dx = 0;
    joystick.dy = 0;
    joystick.touchId = null;
    joyStickEl.style.transform = 'translate(0, 0)';
}

joystickEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joystick.touchId !== null) return;
    const t = e.changedTouches[0];
    joystick.touchId = t.identifier;
    joystick.active = true;
    updateJoystick(t.clientX, t.clientY);
}, { passive: false });

joystickEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (joystick.touchId === null) return;
    for (const t of e.changedTouches) {
        if (t.identifier === joystick.touchId) updateJoystick(t.clientX, t.clientY);
    }
}, { passive: false });

function joyEnd(e) {
    if (joystick.touchId === null) return;
    for (const t of e.changedTouches) {
        if (t.identifier === joystick.touchId) resetJoystick();
    }
}
joystickEl.addEventListener('touchend', joyEnd);
joystickEl.addEventListener('touchcancel', joyEnd);

// Mouse fallback (testing di desktop)
joystickEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    joystick.active = true;
    updateJoystick(e.clientX, e.clientY);
    const onMove = (ev) => updateJoystick(ev.clientX, ev.clientY);
    const onUp = () => {
        resetJoystick();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
});

// ===== RESTART =====
restartBtn.addEventListener('click', () => {
    initMap();
    initItems();
    initPlayer();
    updateUI();
});

// ===== ENTER GAME MODE (fullscreen + orientation lock) =====
async function enterGameMode() {
    startOverlay.classList.remove('show');
    gameStarted = true;

    if (isTouchDevice) {
        try {
            const el = document.documentElement;
            if (el.requestFullscreen) await el.requestFullscreen();
            else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        } catch (err) {}

        try {
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape');
            }
        } catch (err) {}
    }

    checkOrientation();
}
startBtn.addEventListener('click', enterGameMode);

// ===== ORIENTATION DETECTION =====
function checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isTouchDevice && isPortrait && gameStarted) {
        rotateOverlay.classList.add('show');
    } else {
        rotateOverlay.classList.remove('show');
    }
}
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 200));

// ===== INIT =====
initMap();
initItems();
initPlayer();
updateUI();

// Show joystick & start overlay
joystickEl.classList.add('active');
startOverlay.classList.add('show');
checkOrientation();

// Start loop
requestAnimationFrame(gameLoop);
