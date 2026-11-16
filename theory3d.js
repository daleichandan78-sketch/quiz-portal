// ============================================================
// EE MASTER EXAM PRO - INTERACTIVE 3D THEORY LAB (Three.js)
// ============================================================

let scene3D, camera3D, renderer3D, animFrameId;
let isTheoryActive = false;
let currentModelType = "rmf"; // 'rmf' or 'transformer'
let modelGroup = null;

// 3-Phase RMF State
let rmfFreq = 50;
let rmfReversed = false;
let rmfPaused = false;
let rmfAngle = 0;
let arrowR, arrowY, arrowB, arrowNet;

// Transformer Cutaway State
let isCoreLaminated = true;
let fluxDots = [];
let coreMeshes = [];
let windingMeshes = [];
let conservatorMesh = null;
let buchholzMesh = null;

// Rotation & Zoom Controls (Touch + Mouse)
let isDragging3D = false;
let prevPointer = { x: 0, y: 0 };
let targetRotX = 0.35;
let targetRotY = 0.45;
let targetCamZ = 7.2;
let initialPinchDist = null;

const transformerNotes = {
    core: {
        title: "1. Laminated Silicon Steel Core",
        formula: "Eddy Current Loss: Pe ∝ Bmax² · f² · t²  |  Hysteresis Loss: Ph ∝ Bmax^1.6 · f",
        desc: "Silicon steel (3-4% Si) minimizes Hysteresis loss, while thin varnished laminations (0.35 mm - 0.5 mm) break circulating eddy current loops to drastically reduce Eddy Current loss."
    },
    winding: {
        title: "2. Concentric HV & LV Copper Windings",
        formula: "EMF Equation: E = 4.44 · f · N · Φmax  |  Turns Ratio: K = N2 / N1 = V2 / V1",
        desc: "Low Voltage (LV) winding is placed closer to the core limb to reduce insulation cost, while High Voltage (HV) winding is placed outside over the LV winding."
    },
    conservator: {
        title: "3. Conservator Tank & Silica Gel Breather",
        formula: "Dry Silica Gel = Blue  ➔  Moisture Saturated = Pale Pink",
        desc: "Accommodates thermal expansion and contraction of transformer insulating oil without exposing the main tank oil to atmospheric air. The breather absorbs moisture."
    },
    buchholz: {
        title: "4. Buchholz Relay (Gas-Actuated Protection)",
        formula: "Installed at 3°–9° pipe inclination between Main Tank & Conservator",
        desc: "Used in oil-immersed transformers (>500 kVA). Slow gas bubbles from minor faults tilt the upper float (Alarm), while severe faults create an oil surge tilting the lower flap (Trip)."
    }
};

function open3DTheory(topic = "rmf") {
    if (typeof setScreenUI === "function") {
        setScreenUI("theory");
    } else {
        document.getElementById("screen-setup").style.display = "none";
        document.getElementById("screen-exam").style.display = "none";
        document.getElementById("screen-result").style.display = "none";
        document.getElementById("screen-theory").style.display = "block";
    }

    isTheoryActive = true;
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (!renderer3D) {
        initThreeEngine();
    }
    switch3DModel(topic);
    animate3DLoop();
}

function close3DTheory() {
    isTheoryActive = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (typeof backToHome === "function") {
        backToHome();
    }
}

function initThreeEngine() {
    const container = document.getElementById("canvas-3d-box");
    const width = container.clientWidth || 340;
    const height = container.clientHeight || 340;

    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x0b1120);

    camera3D = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera3D.position.set(0, 1.1, targetCamZ);

    renderer3D = new THREE.WebGLRenderer({ antialias: true });
    renderer3D.setSize(width, height);
    renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(renderer3D.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene3D.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
    keyLight.position.set(5, 8, 6);
    scene3D.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-5, -4, -5);
    scene3D.add(rimLight);

    const gridHelper = new THREE.GridHelper(8, 16, 0x1e293b, 0x1e293b);
    gridHelper.position.y = -2.2;
    scene3D.add(gridHelper);

    const dom = renderer3D.domElement;

    dom.addEventListener("pointerdown", (e) => {
        isDragging3D = true;
        prevPointer = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("pointermove", (e) => {
        if (!isDragging3D || !isTheoryActive) return;
        const dx = e.clientX - prevPointer.x;
        const dy = e.clientY - prevPointer.y;
        targetRotY += dx * 0.01;
        targetRotX = Math.max(-1.25, Math.min(1.25, targetRotX + dy * 0.01));
        prevPointer = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("pointerup", () => {
        isDragging3D = false;
    });

    dom.addEventListener("wheel", (e) => {
        e.preventDefault();
        targetCamZ = Math.max(4.2, Math.min(11.5, targetCamZ + e.deltaY * 0.005));
    }, { passive: false });

    dom.addEventListener("touchmove", (e) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (initialPinchDist !== null) {
                const diff = initialPinchDist - dist;
                targetCamZ = Math.max(4.2, Math.min(11.5, targetCamZ + diff * 0.02));
            }
            initialPinchDist = dist;
        }
    }, { passive: true });

    dom.addEventListener("touchend", () => {
        initialPinchDist = null;
    });

    window.addEventListener("resize", () => {
        if (!isTheoryActive || !renderer3D) return;
        const newW = container.clientWidth || 340;
        const newH = container.clientHeight || 340;
        camera3D.aspect = newW / newH;
        camera3D.updateProjectionMatrix();
        renderer3D.setSize(newW, newH);
    });
}

function createArrowMesh(colorHex, length = 1.6, thickness = 0.07) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.25,
        metalness: 0.2,
        emissive: colorHex,
        emissiveIntensity: 0.25
    });

    const shaftGeo = new THREE.CylinderGeometry(thickness, thickness, length, 16);
    shaftGeo.translate(0, length / 2, 0);
    const shaft = new THREE.Mesh(shaftGeo, mat);

    const headGeo = new THREE.ConeGeometry(thickness * 2.4, 0.35, 16);
    headGeo.translate(0, length + 0.15, 0);
    const head = new THREE.Mesh(headGeo, mat);

    group.add(shaft, head);
    return group;
}

function buildRMFModel() {
    modelGroup = new THREE.Group();
    targetRotX = 0.32;
    targetRotY = 0.0;
    targetCamZ = 7.2;

    const stator = new THREE.Mesh(
        new THREE.TorusGeometry(2.3, 0.24, 18, 56),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.35 })
    );
    modelGroup.add(stator);

    const phaseConfigs = [
        { angle: 0, color: 0xef4444 },
        { angle: (2 * Math.PI) / 3, color: 0xeab308 },
        { angle: (4 * Math.PI) / 3, color: 0x3b82f6 }
    ];

    phaseConfigs.forEach(cfg => {
        const coilMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.3 });
        const poleTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.65), coilMat);
        poleTop.position.set(-Math.sin(cfg.angle) * 2.0, Math.cos(cfg.angle) * 2.0, 0);
        poleTop.rotation.z = cfg.angle;

        const poleBottom = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.65), coilMat);
        poleBottom.position.set(Math.sin(cfg.angle) * 2.0, -Math.cos(cfg.angle) * 2.0, 0);
        poleBottom.rotation.z = cfg.angle;

        modelGroup.add(poleTop, poleBottom);
    });

    const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.85, 24),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.25 })
    );
    hub.rotation.x = Math.PI / 2;
    modelGroup.add(hub);

    arrowR = createArrowMesh(0xef4444, 1.1, 0.045);
    arrowY = createArrowMesh(0xeab308, 1.1, 0.045);
    arrowB = createArrowMesh(0x3b82f6, 1.1, 0.045);
    arrowNet = createArrowMesh(0x22c55e, 1.68, 0.085);

    modelGroup.add(arrowR, arrowY, arrowB, arrowNet);
    scene3D.add(modelGroup);
}

function buildTransformerModel() {
    modelGroup = new THREE.Group();
    targetRotX = 0.26;
    targetRotY = 0.48;
    targetCamZ = 7.0;
    coreMeshes = [];
    windingMeshes = [];
    fluxDots = [];

    const sliceCount = isCoreLaminated ? 9 : 1;
    const totalDepth = 0.85;
    const sliceDepth = (totalDepth / sliceCount) * (isCoreLaminated ? 0.82 : 1.0);

    for (let i = 0; i < sliceCount; i++) {
        const zPos = sliceCount === 1 ? 0 : -totalDepth / 2 + (i + 0.5) * (totalDepth / sliceCount);
        const steelMat = new THREE.MeshStandardMaterial({
            color: isCoreLaminated ? (i % 2 === 0 ? 0x64748b : 0x475569) : 0x94a3b8,
            metalness: 0.65,
            roughness: 0.35
        });

        const leftLimb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.2, sliceDepth), steelMat);
        leftLimb.position.set(-1.05, 0, zPos);

        const rightLimb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.2, sliceDepth), steelMat);
        rightLimb.position.set(1.05, 0, zPos);

        const topYoke = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.45, sliceDepth), steelMat);
        topYoke.position.set(0, 1.1, zPos);

        const botYoke = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.45, sliceDepth), steelMat);
        botYoke.position.set(0, -1.1, zPos);

        modelGroup.add(leftLimb, rightLimb, topYoke, botYoke);
        coreMeshes.push(leftLimb, rightLimb, topYoke, botYoke);
    }

    const copperMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.55, roughness: 0.28 });
    [-1.05, 1.05].forEach(xPos => {
        for (let w = -0.55; w <= 0.55; w += 0.22) {
            const turn = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.16, 1.12), copperMat);
            turn.position.set(xPos, w, 0);
            modelGroup.add(turn);
            windingMeshes.push(turn);
        }
    });

    const tankMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.45, roughness: 0.35 });
    conservatorMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.45, 24), tankMat);
    conservatorMesh.rotation.z = Math.PI / 2;
    conservatorMesh.position.set(0.32, 1.88, 0);
    modelGroup.add(conservatorMesh);

    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.68, 14), tankMat);
    pipe.position.set(-0.25, 1.56, 0);
    pipe.rotation.z = -0.35;
    modelGroup.add(pipe);

    buchholzMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.22, 0.28),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
    );
    buchholzMesh.position.set(-0.25, 1.56, 0);
    modelGroup.add(buchholzMesh);

    const dotGeo = new THREE.SphereGeometry(0.075, 12, 12);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let i = 0; i < 12; i++) {
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.z = 0.48;
        modelGroup.add(dot);
        fluxDots.push({ mesh: dot, phase: i / 12 });
    }

    scene3D.add(modelGroup);
}

function switch3DModel(type) {
    currentModelType = type;

    document.querySelectorAll(".theory-tab-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`tab-3d-${type}`);
    if (activeBtn) activeBtn.classList.add("active");

    document.getElementById("ctrl-3d-rmf").style.display = type === "rmf" ? "block" : "none";
    document.getElementById("ctrl-3d-transformer").style.display = type === "transformer" ? "block" : "none";
    const ctrlDc = document.getElementById("ctrl-3d-dcmotor");
    if (ctrlDc) ctrlDc.style.display = type === "dcmotor" ? "block" : "none";

    if (modelGroup) {
        scene3D.remove(modelGroup);
    }

    if (type === "rmf") {
        buildRMFModel();
    } else if (type === "transformer") {
        buildTransformerModel();
        selectTransformerPart("core");
    } else if (type === "dcmotor") {
        buildDCMotorModel();
        selectDCMotorPart("poles");
    }
}

function updateRMFFreq(val) {
    rmfFreq = parseInt(val, 10);
    const ns4Pole = (120 * rmfFreq) / 4;
    document.getElementById("rmf-freq-val").innerText = `${rmfFreq} Hz (Ns = ${ns4Pole} RPM for 4-Pole)`;
}

function toggleRMFDirection() {
    rmfReversed = !rmfReversed;
    const btn = document.getElementById("btn-rmf-dir");
    btn.innerText = rmfReversed ? "🔄 Sequence: R-B-Y (Reverse)" : "🔄 Sequence: R-Y-B (Forward)";
    btn.style.background = rmfReversed ? "var(--danger)" : "var(--primary)";
}

function toggleRMFPause() {
    rmfPaused = !rmfPaused;
    document.getElementById("btn-rmf-pause").innerText = rmfPaused ? "▶ Play" : "⏸ Pause";
}

function toggleTransformerLamination() {
    isCoreLaminated = !isCoreLaminated;
    const btn = document.getElementById("btn-tx-lam");
    btn.innerText = isCoreLaminated ? "🧱 Core: Laminated (Low Eddy Loss)" : "🧱 Core: Solid Iron (High Eddy Loss)";
    scene3D.remove(modelGroup);
    buildTransformerModel();
}

function selectTransformerPart(partKey) {
    const info = transformerNotes[partKey];
    if (!info) return;
    document.getElementById("tx-part-title").innerText = info.title;
    document.getElementById("tx-part-formula").innerText = info.formula;
    document.getElementById("tx-part-desc").innerText = info.desc;

    coreMeshes.forEach(m => m.material.emissive.setHex(partKey === "core" ? 0x1d4ed8 : 0x000000));
    windingMeshes.forEach(m => m.material.emissive.setHex(partKey === "winding" ? 0xb45309 : 0x000000));
    if (conservatorMesh) conservatorMesh.material.emissive.setHex(partKey === "conservator" ? 0x0369a1 : 0x000000);
    if (buchholzMesh) buchholzMesh.material.emissive.setHex(partKey === "buchholz" ? 0x991b1b : 0x000000);
}

function animate3DLoop() {
    if (!isTheoryActive) return;
    animFrameId = requestAnimationFrame(animate3DLoop);
    if (currentModelType === "dcmotor" && typeof updateDCMotorAnimation === "function") {
        updateDCMotorAnimation();
    }

    if (camera3D) {
        camera3D.position.z += (targetCamZ - camera3D.position.z) * 0.12;
    }

    if (modelGroup) {
        modelGroup.rotation.x += (targetRotX - modelGroup.rotation.x) * 0.1;
        modelGroup.rotation.y += (targetRotY - modelGroup.rotation.y) * 0.1;
    }

    if (currentModelType === "rmf" && !rmfPaused) {
        const dir = rmfReversed ? -1 : 1;
        rmfAngle += dir * (rmfFreq / 50) * 0.035;

        arrowNet.rotation.z = -rmfAngle;

        const br = Math.cos(rmfAngle);
        const by = Math.cos(rmfAngle - (2 * Math.PI) / 3);
        const bb = Math.cos(rmfAngle - (4 * Math.PI) / 3);

        arrowR.scale.y = Math.max(0.05, Math.abs(br));
        arrowR.rotation.z = br >= 0 ? 0 : Math.PI;

        arrowY.scale.y = Math.max(0.05, Math.abs(by));
        arrowY.rotation.z = (2 * Math.PI) / 3 + (by >= 0 ? 0 : Math.PI);

        arrowB.scale.y = Math.max(0.05, Math.abs(bb));
        arrowB.rotation.z = (4 * Math.PI) / 3 + (bb >= 0 ? 0 : Math.PI);
    }

    if (currentModelType === "transformer") {
        const t = Date.now() * 0.004;
        const wave = Math.sin(t);
        fluxDots.forEach(d => {
            const p = (d.phase + (t * 0.08)) % 1;
            if (p < 0.25) {
                const u = p / 0.25;
                d.mesh.position.set(-1.05, -1.1 + u * 2.2, 0.48);
            } else if (p < 0.5) {
                const u = (p - 0.25) / 0.25;
                d.mesh.position.set(-1.05 + u * 2.1, 1.1, 0.48);
            } else if (p < 0.75) {
                const u = (p - 0.5) / 0.25;
                d.mesh.position.set(1.05, 1.1 - u * 2.2, 0.48);
            } else {
                const u = (p - 0.75) / 0.25;
                d.mesh.position.set(1.05 - u * 2.1, -1.1, 0.48);
            }
            d.mesh.scale.setScalar(0.6 + 0.5 * Math.abs(wave));
        });
    }

    renderer3D.render(scene3D, camera3D);
}

// ============================================================
// 3D DC MOTOR & SPLIT-RING COMMUTATOR SIMULATION
// ============================================================
let dcMotorGroup = null;
let dcRotorAssembly = null;
let dcFluxLinesGroup = null;
let dcTerminalPos = null;
let dcTerminalNeg = null;
let dcVoltage = 220;
let dcFluxPct = 100;
let dcPolarityDir = 1; // 1 = Forward (CCW), -1 = Reverse (CW)
let dcIsPaused = false;

const dcPartInfo = {
    poles: {
        title: "1. Stator Yoke & Field Poles (N & S)",
        formula: "N ∝ (V - Ia·Ra) / Φ  (Field Weakening = Higher Speed)",
        desc: "Electro-magnets wound with field coils create a steady magnetic flux (Φ) directed from the Red North Pole to the Blue South Pole. Reducing Φ via a field rheostat increases speed above base speed."
    },
    armature: {
        title: "2. Rotating Armature Coil & Lorentz Force",
        formula: "F = B · I · l  (Fleming's Left-Hand Rule)  |  Eb = ΦZNP / 60A",
        desc: "Current-carrying copper conductors on the rotor interact with the N-S magnetic field, generating equal and opposite forces on both sides to produce continuous torque."
    },
    commutator: {
        title: "3. Split-Ring Copper Commutator",
        formula: "Mechanical Inverter (Reverses Coil Current at MNA)",
        desc: "Two semi-circular copper segments separated by mica insulation rotate with the shaft. Every half-turn (180°), the segments swap brush contact, reversing coil current to keep torque unidirectional."
    },
    brushes: {
        title: "4. Stationary Carbon Brushes & DC Supply",
        formula: "Ia = (V - Eb) / Ra",
        desc: "High-grade carbon/graphite blocks press gently against the spinning split-ring commutator to deliver DC current from the external supply without twisting wires."
    }
};

function buildDCMotorModel() {
    if (!scene3D) return;

    dcMotorGroup = new THREE.Group();

    // 1. Outer Cylindrical Stator Yoke (Cutaway Ring)
    const yokeGeo = new THREE.CylinderGeometry(3.1, 3.1, 2.2, 48, 1, true);
    const yokeMat = new THREE.MeshStandardMaterial({
        color: 0x334155, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.45
    });
    const yokeMesh = new THREE.Mesh(yokeGeo, yokeMat);
    yokeMesh.rotation.z = Math.PI / 2;
    dcMotorGroup.add(yokeMesh);

    // 2. North Pole (Left / Red) & South Pole (Right / Blue)
    const poleGeo = new THREE.BoxGeometry(0.9, 1.3, 1.7);
    const northMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
    const southMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });

    const northPole = new THREE.Mesh(poleGeo, northMat);
    northPole.position.set(-2.35, 0, 0);
    const southPole = new THREE.Mesh(poleGeo, southMat);
    southPole.position.set(2.35, 0, 0);
    dcMotorGroup.add(northPole, southPole);

    // Field Coils around N & S poles
    const fCoilGeo = new THREE.BoxGeometry(0.45, 1.55, 1.95);
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.65, roughness: 0.25 });
    const nCoil = new THREE.Mesh(fCoilGeo, copperMat);
    nCoil.position.set(-2.45, 0, 0);
    const sCoil = new THREE.Mesh(fCoilGeo, copperMat);
    sCoil.position.set(2.45, 0, 0);
    dcMotorGroup.add(nCoil, sCoil);

    // 3. Magnetic Flux Lines (N -> S)
    dcFluxLinesGroup = new THREE.Group();
    const fluxMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 });
    for (let y = -0.45; y <= 0.45; y += 0.45) {
        for (let z = -0.45; z <= 0.45; z += 0.45) {
            const lineGeo = new THREE.CylinderGeometry(0.025, 0.025, 3.6, 8);
            const line = new THREE.Mesh(lineGeo, fluxMat);
            line.rotation.z = Math.PI / 2;
            line.position.set(0, y, z);
            dcFluxLinesGroup.add(line);
        }
    }
    dcMotorGroup.add(dcFluxLinesGroup);

    // 4. Rotating Armature Assembly (Shaft + Copper Loop + Split-Ring Commutator)
    dcRotorAssembly = new THREE.Group();

    const shaftGeo = new THREE.CylinderGeometry(0.16, 0.16, 4.4, 20);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.x = Math.PI / 2;
    dcRotorAssembly.add(shaft);

    const drumGeo = new THREE.CylinderGeometry(1.15, 1.15, 1.7, 32);
    const drumMat = new THREE.MeshStandardMaterial({
        color: 0x64748b, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.32
    });
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.rotation.x = Math.PI / 2;
    drum.position.z = -0.35;
    dcRotorAssembly.add(drum);

    const sideGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.85, 16);
    const sideA = new THREE.Mesh(sideGeo, copperMat);
    sideA.rotation.x = Math.PI / 2;
    sideA.position.set(-0.95, 0, -0.35);

    const sideB = new THREE.Mesh(sideGeo, copperMat);
    sideB.rotation.x = Math.PI / 2;
    sideB.position.set(0.95, 0, -0.35);

    const backBridgeGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.98, 16);
    const backBridge = new THREE.Mesh(backBridgeGeo, copperMat);
    backBridge.rotation.z = Math.PI / 2;
    backBridge.position.set(0, 0, -1.25);

    const arrowGeo = new THREE.ConeGeometry(0.18, 0.45, 12);
    const forceUp = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    forceUp.position.set(-0.95, 0.55, -0.35);

    const forceDown = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    forceDown.rotation.z = Math.PI;
    forceDown.position.set(0.95, -0.55, -0.35);

    dcRotorAssembly.add(sideA, sideB, backBridge, forceUp, forceDown);

    // Split-Ring Commutator
    const ringGeo1 = new THREE.CylinderGeometry(0.46, 0.46, 0.65, 24, 1, false, 0.14, Math.PI - 0.28);
    const ring1 = new THREE.Mesh(ringGeo1, copperMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.z = 1.05;

    const ringGeo2 = new THREE.CylinderGeometry(0.46, 0.46, 0.65, 24, 1, false, Math.PI + 0.14, Math.PI - 0.28);
    const ring2 = new THREE.Mesh(ringGeo2, copperMat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.z = 1.05;

    dcRotorAssembly.add(ring1, ring2);
    dcMotorGroup.add(dcRotorAssembly);

    // 5. Stationary Carbon Brushes & Supply Terminals (+ / -)
    const brushGeo = new THREE.BoxGeometry(0.32, 0.35, 0.45);
    const brushMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

    const leftBrush = new THREE.Mesh(brushGeo, brushMat);
    leftBrush.position.set(-0.58, 0, 1.05);
    const rightBrush = new THREE.Mesh(brushGeo, brushMat);
    rightBrush.position.set(0.58, 0, 1.05);

    const termGeo = new THREE.SphereGeometry(0.16, 16, 16);
    dcTerminalPos = new THREE.Mesh(termGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    dcTerminalPos.position.set(-1.1, 0, 1.05);

    dcTerminalNeg = new THREE.Mesh(termGeo, new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
    dcTerminalNeg.position.set(1.1, 0, 1.05);

    dcMotorGroup.add(leftBrush, rightBrush, dcTerminalPos, dcTerminalNeg);

    dcMotorGroup.rotation.set(0.28, -0.35, 0);
    modelGroup = dcMotorGroup;
    scene3D.add(modelGroup);

    updateDCMotorParams();
}

function updateDCMotorParams() {
    const vEl = document.getElementById("dc-volt-slider");
    const fEl = document.getElementById("dc-flux-slider");
    if (!vEl || !fEl) return;

    dcVoltage = parseInt(vEl.value, 10);
    dcFluxPct = parseInt(fEl.value, 10);

    document.getElementById("dc-volt-val").innerText = `${dcVoltage} V`;
    document.getElementById("dc-flux-val").innerText = dcFluxPct < 80
        ? `${dcFluxPct}% (Field Weakening!)`
        : `${dcFluxPct}%`;

    const rpm = Math.round(1500 * (dcVoltage / 220) * (100 / dcFluxPct));
    document.getElementById("dc-speed-readout").innerText = `Speed (N): ${rpm} RPM`;

    if (dcFluxLinesGroup) {
        const scale = dcFluxPct / 100;
        dcFluxLinesGroup.scale.set(1, scale, scale);
    }
}

function toggleDCMotorPolarity() {
    dcPolarityDir *= -1;
    const btn = document.getElementById("btn-dc-dir");
    if (btn) {
        btn.innerText = dcPolarityDir === 1
            ? "🔄 Polarity: +V / -V (CCW)"
            : "🔄 Polarity: -V / +V (CW Reverse)";
    }
    if (dcTerminalPos && dcTerminalNeg) {
        dcTerminalPos.material.color.setHex(dcPolarityDir === 1 ? 0xef4444 : 0x3b82f6);
        dcTerminalNeg.material.color.setHex(dcPolarityDir === 1 ? 0x3b82f6 : 0xef4444);
    }
}

function toggleDCMotorPause() {
    dcIsPaused = !dcIsPaused;
    const btn = document.getElementById("btn-dc-pause");
    if (btn) btn.innerText = dcIsPaused ? "▶ Resume" : "⏸ Pause";
}

function selectDCMotorPart(key) {
    const info = dcPartInfo[key];
    if (!info) return;
    document.getElementById("dc-part-title").innerText = info.title;
    document.getElementById("dc-part-formula").innerText = info.formula;
    document.getElementById("dc-part-desc").innerText = info.desc;
}

function updateDCMotorAnimation() {
    if (!dcRotorAssembly || dcIsPaused) return;
    const angularSpeed = 0.035 * (dcVoltage / 220) * (100 / dcFluxPct);
    dcRotorAssembly.rotation.z += angularSpeed * dcPolarityDir;
}