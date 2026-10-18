import * as THREE from 'three';

// ===== UI ELEMENTS =====
const grassCountEl = document.getElementById('grassCount');
const grassTotalEl = document.getElementById('grassTotal');
const restartBtn = document.getElementById('restartBtn');
const joystickEl = document.getElementById('joystick');
const joyStickEl = document.getElementById('joyStick');
const rotateOverlay = document.getElementById('rotateOverlay');
const startOverlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('startBtn');

// ===== KONFIGURASI GAME =====
const TILE_SIZE = 4;       // Ukuran 1 kotak peta dalam 3D
const MAP_WIDTH = 20;
const MAP_HEIGHT = 12;
const SPEED = 14;          // Kecepatan jalan karakter
const PLAYER_RADIUS = 1.5; // Radius tabrakan karakter

let map = [];              // Array 2D untuk data peta (0 = tanah, 1 = air)
let items = [];            // Array untuk data rumput
let isGameStarted = false;

// State Input
let joystick = { active: false, dx: 0, dy: 0, touchId: null };
let keys = { up: false, down: false, left: false, right: false };

// ===== SETUP THREE.JS (SCENE, CAMERA, RENDERER) =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Warna langit
scene.fog = new THREE.Fog(0x87CEEB, 40, 90);  // Efek kabut di kejauhan

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; // Aktifkan bayangan
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Pencahayaan
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
scene.add(dirLight);

// ===== KARAKTER 3D (PLAYER) =====
const playerGroup = new THREE.Group();

// Badan Karakter (Kapsul)
const bodyGeo = new THREE.CapsuleGeometry(1, 1.2, 4, 16);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00f2ea, roughness: 0.2 });
const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
bodyMesh.castShadow = true;
bodyMesh.position.y = 1.6;
playerGroup.add(bodyMesh);

// Mata (Putih & Hitam)
const eyeWhiteGeo = new THREE.SphereGeometry(0.35, 16, 16);
const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const eyeBlackGeo = new THREE.SphereGeometry(0.15, 16, 16);
const eyeBlackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

// Mata Kiri
const leftEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
leftEye.position.set(-0.4, 2.2, 0.9);
const leftPupil = new THREE.Mesh(eyeBlackGeo, eyeBlackMat);
leftPupil.position.set(0, 0, 0.25);
leftEye.add(leftPupil);

// Mata Kanan
const rightEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
rightEye.position.set(0.4, 2.2, 0.9);
const rightPupil = new THREE.Mesh(eyeBlackGeo, eyeBlackMat);
rightPupil.position.set(0, 0, 0.25);
rightEye.add(rightPupil);

playerGroup.add(leftEye);
playerGroup.add(rightEye);
scene.add(playerGroup);

// State Player
const player = { x: 0, z: 0, targetAngle: 0 };

// ===== GRUP UNTUK MAP & ITEM =====
// Digunakan agar mudah dihapus saat Restart
const mapGroup = new THREE.Group();
const itemGroup = new THREE.Group();
scene.add(mapGroup);
scene.add(itemGroup);

// ===== FUNGSI INISIALISASI PETA =====
function initMap() {
    // Hapus peta lama jika ada
    mapGroup.clear();

    // Buat array peta 2D (0 = tanah, 1 = air)
    map = Array(MAP_HEIGHT).fill().map(() => Array(MAP_WIDTH).fill(0));

    // Desain rintangan air
    for (let row = 2; row < 6; row++) for (let col = 6; col < 10; col++) map[row][col] = 1;
    for (let row = 8; row < 11; row++) { map[row][2] = 1; map[row][3] = 1; }
    for (let row = 1; row < 4; row++) { map[row][14] = 1; map[row][15] = 1; }
    map[9][13] = 1; map[10][13] = 1;

    // Material 3D
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2c6e9e, transparent: true, opacity: 0.85 });

    // Loop untuk membuat kotak 3D
    for (let row = 0; row < MAP_HEIGHT; row++) {
        for (let col = 0; col < MAP_WIDTH; col++) {
            const isWater = map[row][col] === 1;
            
            // Tanah dasar
            const groundGeo = new THREE.BoxGeometry(TILE_SIZE, 1, TILE_SIZE);
            const groundMesh = new THREE.Mesh(groundGeo, grassMat);
            groundMesh.position.set(col * TILE_SIZE, -0.5, row * TILE_SIZE);
            groundMesh.receiveShadow = true;
            mapGroup.add(groundMesh);

            // Jika air, taruh kotak biru di atas tanah
            if (isWater) {
                const waterGeo = new THREE.BoxGeometry(TILE_SIZE, 1.2, TILE_SIZE);
                const waterMesh = new THREE.Mesh(waterGeo, waterMat);
                waterMesh.position.set(col * TILE_SIZE, 0.1, row * TILE_SIZE);
                mapGroup.add(waterMesh);
            }
        }
    }
}

// ===== FUNGSI INISIALISASI ITEM (RUMPUT) =====
function initItems() {
    itemGroup.clear();
    items = [];

    const rawItems = [
        { x: 5, z: 4 }, { x: 12, z: 3 }, { x: 15, z: 8 }, { x: 17, z: 5 },
        { x: 10, z: 9 }, { x: 18, z: 10 }, { x: 5, z: 10 }, { x: 13, z: 2 }
    ];
    
    // Material rumput (hijau menyala)
    const grassItemMat = new THREE.MeshStandardMaterial({ 
        color: 0x7cfc00, 
        emissive: 0x336600, 
        emissiveIntensity: 0.6 
    });
    // Bentuk rumput (kerucut)
    const itemGeo = new THREE.ConeGeometry(0.9, 2.8, 5);

    rawItems.forEach(it => {
        if (map[it.z] && map[it.z][it.x] === 0) { // Pastikan tidak muncul di air
            const mesh = new THREE.Mesh(itemGeo, grassItemMat);
            mesh.position.set(it.x * TILE_SIZE, 1.8, it.z * TILE_SIZE);
            mesh.castShadow = true;
            
            // Simpan data animasi melayang
            mesh.userData = { baseY: 1.8, offset: Math.random() * Math.PI * 2 };
            
            itemGroup.add(mesh);
            items.push({ x: it.x, z: it.z, mesh: mesh, collected: false });
        }
    });
    grassTotalEl.textContent = items.length;
}

// ===== FUNGSI INISIALISASI PLAYER =====
function initPlayer() {
    let sx = 10, sz = 6;
    
    // Cari posisi aman (bukan air) jika spawn awal ternyata di air
    if (map[sz][sx] === 1) {
        outer:
        for (let z = 0; z < MAP_HEIGHT; z++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (map[z][x] === 0) { sx = x; sz = z; break outer; }
            }
        }
    }
    
    player.x = sx * TILE_SIZE;
    player.z = sz * TILE_SIZE;
    player.targetAngle = 0;
    playerGroup.position.set(player.x, 0, player.z);
}

// ===== UPDATE UI SKOR =====
function updateUI() {
    const n = items.filter(i => i.collected).length;
    grassCountEl.textContent = n;
}

// ===== DETEKSI TABRAKAN (COLLISION) =====
function canMoveTo(nx, nz) {
    // Cek 4 sudut karakter
    const checkPoints = [
        { x: nx - PLAYER_RADIUS, z: nz - PLAYER_RADIUS },
        { x: nx + PLAYER_RADIUS, z: nz - PLAYER_RADIUS },
        { x: nx - PLAYER_RADIUS, z: nz + PLAYER_RADIUS },
        { x: nx + PLAYER_RADIUS, z: nz + PLAYER_RADIUS }
    ];

    for (let p of checkPoints) {
        const tx = Math.floor(p.x / TILE_SIZE);
        const tz = Math.floor(p.z / TILE_SIZE);
        
        // Cek batas peta
        if (tx < 0 || tx >= MAP_WIDTH || tz < 0 || tz >= MAP_HEIGHT) return false;
        // Cek air
        if (map[tz][tx] === 1) return false; 
    }
    return true;
}

// ===== LOOP UPDATE (LOGIKA GAME) =====
const clock = new THREE.Clock();

function update() {
    const dt = Math.min(clock.getDelta(), 0.1); // Batasi delta time agar tidak error saat lag
    const time = clock.getElapsedTime();

    // 1. Animasi Rumput (Berputar & Melayang)
    items.forEach(item => {
        if (!item.collected && item.mesh) {
            item.mesh.rotation.y += dt * 2.5;
            // Gerakan naik turun menggunakan Sinus
            item.mesh.position.y = item.mesh.userData.baseY + Math.sin(time * 3 + item.mesh.userData.offset) * 0.3;
        }
    });

    // 2. Baca Input (Joystick atau Keyboard)
    let moveX = 0;
    let moveZ = 0;

    if (joystick.active && (joystick.dx !== 0 || joystick.dy !== 0)) {
        moveX = joystick.dx;
        moveZ = joystick.dy;
    } else {
        if (keys.left) moveX -= 1;
        if (keys.right) moveX += 1;
        if (keys.up) moveZ -= 1;
        if (keys.down) moveZ += 1;
    }

    // 3. Pergerakan & Rotasi Karakter
    if (moveX !== 0 || moveZ !== 0) {
        // Normalisasi kecepatan agar diagonal tidak lebih cepat
        const length = Math.hypot(moveX, moveZ);
        moveX /= length;
        moveZ /= length;

        // Tentukan arah hadap
        player.targetAngle = Math.atan2(moveX, moveZ);
        
        // Rotasi halus (Smooth rotation)
        let diff = player.targetAngle - playerGroup.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        playerGroup.rotation.y += diff * 12 * dt;

        // Hitung posisi baru
        const nx = player.x + moveX * SPEED * dt;
        const nz = player.z + moveZ * SPEED * dt;

        // Cek tabrakan per sumbu (agar karakter bisa "geser" di dinding)
        if (canMoveTo(nx, player.z)) player.x = nx;
        if (canMoveTo(player.x, nz)) player.z = nz;

        // Update posisi 3D
        playerGroup.position.set(player.x, 0, player.z);
    }

    // 4. Deteksi Ambil Item
    items.forEach(item => {
        if (!item.collected) {
            const dist = Math.hypot((item.x * TILE_SIZE) - player.x, (item.z * TILE_SIZE) - player.z);
            if (dist < 2.5) { // Jarak deteksi
                item.collected = true;
                item.mesh.visible = false;
                updateUI();
            }
        }
    });

    // 5. Kamera Follow (Third-Person)
    // Kamera berada di belakang (Z positif) dan atas (Y positif)
    const targetCamPos = new THREE.Vector3(player.x, 18, player.z + 22); 
    
    // Efek Lerp agar kamera bergerak mulus
    camera.position.lerp(targetCamPos, 6 * dt);
    camera.lookAt(player.x, 2, player.z);
}

// ===== GAME LOOP (RENDER) =====
function animate() {
    requestAnimationFrame(animate);
    if (isGameStarted) update();
    renderer.render(scene, camera);
}

// ===== EVENT LISTENER (KEYBOARD) =====
document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!isGameStarted && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) enterGameMode();
    if (k === 'w' || k === 'arrowup') keys.up = true;
    if (k === 's' || k === 'arrowdown') keys.down = true;
    if (k === 'a' || k === 'arrowleft') keys.left = true;
    if (k === 'd' || k === 'arrowright') keys.right = true;
});

document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') keys.up = false;
    if (k === 's' || k === 'arrowdown') keys.down = false;
    if (k === 'a' || k === 'arrowleft') keys.left = false;
    if (k === 'd' || k === 'arrowright') keys.right = false;
});

// ===== EVENT LISTENER (JOYSTICK / TOUCH) =====
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
    
    // Deadzone (jika geser sedikit, abaikan)
    if (Math.hypot(nx, ny) > 0.15) {
        joystick.dx = nx;
        joystick.dy = ny;
    } else {
        joystick.dx = 0; joystick.dy = 0;
    }
}

function resetJoystick() {
    joystick.active = false; joystick.dx = 0; joystick.dy = 0; joystick.touchId = null;
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

// ===== FITUR FULLSCREEN & LANDSCAPE =====
async function enterGameMode() {
    startOverlay.classList.remove('show');
    isGameStarted = true;
    
    // Minta Fullscreen & Lock Orientasi (Khusus Mobile)
    try {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        
        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape');
        }
    } catch (err) {
        console.log("Fullscreen/Lock tidak didukung di browser ini.");
    }
    checkOrientation();
}

startBtn.addEventListener('click', enterGameMode);

// Deteksi jika HP masih Portrait (Berdiri)
function checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait && isGameStarted) rotateOverlay.classList.add('show');
    else rotateOverlay.classList.remove('show');
}

// Handle Resize layar
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    checkOrientation();
});

// ===== TOMBOL RESTART =====
restartBtn.addEventListener('click', () => {
    initMap();
    initItems();
    initPlayer();
    updateUI();
});

// ===== JALANKAN GAME =====
initMap();
initItems();
initPlayer();
updateUI();
animate();
