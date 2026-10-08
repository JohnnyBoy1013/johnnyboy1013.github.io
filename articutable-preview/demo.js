import { videoJoints, videoFrameCount, videoFps, referenceCyclePosition, toSourcePosition } from './motion.mjs';

const video = document.querySelector('#scene-video');
document.querySelectorAll('.video-picker button').forEach((button) => {
  button.addEventListener('click', () => {
    const scene = button.dataset.scene;
    video.pause();
    video.poster = `assets/videos/scene-${scene}.webp`;
    video.querySelector('source').src = `assets/videos/scene-${scene}.mp4`;
    video.load();
    document.querySelectorAll('.video-picker button').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
  });
});

const loadButton = document.querySelector('#load-demo');
const poster = document.querySelector('#demo-poster');
const viewport = document.querySelector('#demo-viewport');
const status = document.querySelector('#demo-status');
const toolbar = document.querySelector('#demo-toolbar');
const hint = document.querySelector('#demo-hint');
const motionButton = document.querySelector('#motion-button');
const jointControls = document.querySelector('#joint-controls');
const objectButtons = [...document.querySelectorAll('.demo-tabs button')];

let modelData;
function fetchModel() {
  if (modelData) return modelData;
  modelData = new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', 'assets/demo-scene.glb');
    request.responseType = 'arraybuffer';
    request.onprogress = (event) => {
      if (!status.hidden && event.lengthComputable) status.textContent = `Loading the 3D scene… ${Math.round(event.loaded / event.total * 100)}%`;
    };
    request.onload = () => request.status === 200 ? resolve(request.response) : reject(new Error(`3D model HTTP ${request.status}`));
    request.onerror = () => reject(new Error('3D model download failed'));
    request.send();
  }).catch((error) => {
    modelData = null;
    throw error;
  });
  return modelData;
}

let modules;
function loadModules() {
  if (modules) return modules;
  modules = Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]).catch((error) => {
    modules = null;
    throw error;
  });
  return modules;
}

let preparedDemo;
function prepareDemo() {
  if (preparedDemo) return preparedDemo;
  preparedDemo = (async () => {
    const [[THREE, { GLTFLoader }, { DRACOLoader }, { OrbitControls }, { RoomEnvironment }], data] = await Promise.all([loadModules(), fetchModel()]);
    status.textContent = 'Preparing the 3D scene…';
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/');
    try {
      const gltf = await new Promise((resolve, reject) => {
        new GLTFLoader().setDRACOLoader(draco).parse(data, 'assets/', resolve, reject);
      });
      modelData = null;
      return { THREE, OrbitControls, RoomEnvironment, gltf };
    } finally {
      draco.dispose();
    }
  })().catch((error) => {
    preparedDemo = null;
    throw error;
  });
  return preparedDemo;
}

const previewObserver = new IntersectionObserver((entries) => {
  if (!entries.some((entry) => entry.isIntersecting)) return;
  fetchModel().catch(() => {});
  loadModules().catch(() => {});
  previewObserver.disconnect();
}, { rootMargin: '250px' });
previewObserver.observe(document.querySelector('#demo'));

loadButton.addEventListener('click', async () => {
  loadButton.disabled = true;
  poster.classList.add('is-loading');
  status.hidden = false;
  status.textContent = 'Loading the 3D scene…';
  let renderer;

  try {
    const { THREE, OrbitControls, RoomEnvironment, gltf } = await prepareDemo();
    status.textContent = 'Starting the 3D view…';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#d9d9d9');
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.72;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    viewport.append(renderer.domElement);
    const environment = new RoomEnvironment();
    const environmentMap = new THREE.PMREMGenerator(renderer).fromScene(environment);
    scene.environment = environmentMap.texture;
    scene.environmentIntensity = 0.9;
    environment.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.2;
    controls.maxDistance = 30;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.45);
    // Isaac's softbox is centered at (0, -0.8, 3.5) in the Z-up scene.
    key.position.set(0, 3.5, 0.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0001;
    key.shadow.normalBias = 0.002;
    scene.add(key);

    const model = gltf.scene;
    scene.add(model);
    // The GLB already carries the simulator's PBR factors; keep them intact.
    const previewCamera = gltf.cameras.find((item) => item.name === 'front_camera');
    if (!previewCamera) throw new Error('The simulator preview camera is missing from the 3D asset');
    previewCamera.updateWorldMatrix(true, false);
    const previewPosition = previewCamera.getWorldPosition(new THREE.Vector3());
    const previewDirection = previewCamera.getWorldDirection(new THREE.Vector3());
    const fullBox = new THREE.Box3().setFromObject(model);
    const table = model.getObjectByName('table_0');
    if (!table) throw new Error('The simulator table is missing from the 3D asset');
    const tableBox = new THREE.Box3().setFromObject(table);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.ShadowMaterial({ opacity: 0.06 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = tableBox.min.y - 0.002;
    ground.receiveShadow = true;
    scene.add(ground);
    const shadowExtent = Math.max(fullBox.getSize(new THREE.Vector3()).length(), 2.5);
    key.target.position.copy(fullBox.getCenter(new THREE.Vector3()));
    scene.add(key.target);
    Object.assign(key.shadow.camera, {
      left: -shadowExtent, right: shadowExtent,
      top: shadowExtent, bottom: -shadowExtent,
      near: 0.1, far: 20,
    });
    key.shadow.camera.updateProjectionMatrix();
    model.traverse((node) => { if (node.isMesh) node.castShadow = true; });
    table.traverse((node) => { if (node.isMesh) node.receiveShadow = true; });
    const joints = [];
    model.traverse((node) => {
      const data = node.userData;
      if (!data.joint_name || !Array.isArray(data.joint_axis)) return;
      const owner = node.name.split('_joint_joint_')[0];
      const limits = videoJoints[owner]?.[data.joint_name];
      if (!limits) throw new Error(`Missing video trajectory for ${node.name}`);
      joints.push({
        node,
        owner,
        // Blender's joint driver animates local rotation_axis_angle[0] or
        // location[0]. joint_axis is in the source frame, not this local frame.
        axis: new THREE.Vector3(1, 0, 0),
        type: data.joint_type,
        lower: limits[0],
        upper: limits[1],
        sourceLower: Number(data.joint_lower),
        sourceUpper: Number(data.joint_upper),
        rest: Number(data.joint_value),
        reference: limits[2],
        position: node.position.clone(),
        quaternion: node.quaternion.clone(),
      });
    });

    let active = 'all';
    let playing = false;
    let started = 0;
    let elapsed = 0;
    let needsRender = true;
    const jointInputs = new Map();
    const orientation = new THREE.Vector3(1.25, 0.85, 1.45).normalize();
    function focus(object) {
      const target = object === 'all' ? model : model.getObjectByName(object);
      if (!target) return;
      const box = object === 'all' ? fullBox : new THREE.Box3().setFromObject(target);
      const center = box.getCenter(new THREE.Vector3());
      const distance = Math.max(box.getSize(new THREE.Vector3()).length() * (object === 'all' ? 1.4 : 1.55), 0.55);
      if (object === 'all') {
        camera.position.copy(previewPosition);
        camera.fov = previewCamera.fov;
        const depth = Math.max(center.clone().sub(previewPosition).dot(previewDirection), 0.5);
        controls.target.copy(previewPosition).addScaledVector(previewDirection, depth);
      } else {
        camera.position.copy(center).addScaledVector(orientation, distance);
        camera.fov = 40;
        controls.target.copy(center);
      }
      camera.near = Math.max(distance / 100, 0.05);
      camera.far = Math.max(distance * 10, 25);
      camera.updateProjectionMatrix();
      controls.update();
      needsRender = true;
    }

    function resetJoints() {
      joints.forEach((joint) => {
        joint.node.position.copy(joint.position);
        joint.node.quaternion.copy(joint.quaternion);
        jointInputs.get(joint)?.setValue(joint.reference);
      });
      renderer.shadowMap.needsUpdate = true;
      needsRender = true;
    }

    function setJointValue(joint, value) {
      const localValue = joint.type === 'prismatic'
        ? toSourcePosition(value, [joint.lower, joint.upper], [joint.sourceLower, joint.sourceUpper])
        : value;
      const change = localValue - joint.rest;
      if (joint.type === 'prismatic') {
        joint.node.position.copy(joint.position).addScaledVector(joint.axis, change);
      } else {
        joint.node.quaternion.copy(joint.quaternion).multiply(
          new THREE.Quaternion().setFromAxisAngle(joint.axis, change),
        );
      }
      jointInputs.get(joint)?.setValue(value);
      renderer.shadowMap.needsUpdate = true;
      needsRender = true;
    }

    function setPlaying(value) {
      playing = value;
      motionButton.setAttribute('aria-pressed', String(value));
      motionButton.textContent = value ? 'Ⅱ Pause motion' : '▶ Play motion';
    }

    function updateMotion(seconds) {
      // Same 192-frame, 24 fps reference → upper → lower → reference
      // position command used by capture_joint_demo_isaac.py.
      const phase = Math.min((seconds % (videoFrameCount / videoFps)) * videoFps / (videoFrameCount - 1), 1);
      joints.forEach((joint) => {
        if (active !== 'all' && joint.owner !== active) return;
        setJointValue(joint, referenceCyclePosition(
          [joint.lower, joint.upper, joint.reference], phase,
        ));
      });
    }

    function selectObject(owner) {
      active = owner;
      objectButtons.forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.object === owner)));
      jointControls.replaceChildren();
      if (owner === 'all') {
        const note = document.createElement('p');
        note.className = 'joint-controls-note';
        note.textContent = 'Select an object above or click one in the scene to move its joints directly.';
        jointControls.append(note);
      } else {
        joints.filter((joint) => joint.owner === owner).forEach((joint) => {
          const label = document.createElement('label');
          label.className = 'joint-control';
          const title = document.createElement('span');
          title.textContent = joint.node.userData.joint_name.replace('_', ' ');
          const output = document.createElement('output');
          const input = document.createElement('input');
          input.type = 'range';
          input.min = String(joint.lower);
          input.max = String(joint.upper);
          input.step = String((joint.upper - joint.lower) / 1000);
          const setValue = (value) => {
            input.value = String(value);
            output.textContent = joint.type === 'prismatic'
              ? `${(value * 100).toFixed(1)} cm`
              : `${(value * 180 / Math.PI).toFixed(0)}°`;
          };
          jointInputs.set(joint, { setValue });
          setValue(joint.reference);
          input.addEventListener('input', () => {
            setPlaying(false);
            elapsed = 0;
            setJointValue(joint, Number(input.value));
          });
          label.append(title, output, input);
          jointControls.append(label);
        });
      }
      resetJoints();
      focus(active);
      elapsed = 0;
      started = performance.now();
    }
    objectButtons.forEach((button) => button.addEventListener('click', () => selectObject(button.dataset.object)));
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart;
    renderer.domElement.addEventListener('pointerdown', (event) => {
      pointerStart = [event.clientX, event.clientY];
    });
    renderer.domElement.addEventListener('pointerup', (event) => {
      if (!pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
        -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(model, true)[0];
      let node = hit?.object;
      while (node && !objectButtons.some((button) => button.dataset.object === node.name)) node = node.parent;
      if (node) selectObject(node.name);
    });
    motionButton.addEventListener('click', () => {
      setPlaying(!playing);
      if (playing) started = performance.now() - elapsed * 1000;
      else elapsed = (performance.now() - started) / 1000;
    });

    const resize = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      needsRender = true;
    };
    viewport.hidden = false;
    poster.hidden = true;
    toolbar.hidden = false;
    jointControls.hidden = false;
    hint.hidden = false;
    status.hidden = true;
    new ResizeObserver(resize).observe(viewport);
    resize();
    focus('all');
    selectObject('all');

    function render(now) {
      requestAnimationFrame(render);
      if (document.hidden) return;
      if (playing) updateMotion((now - started) / 1000);
      const cameraMoved = controls.update();
      if (playing) renderer.shadowMap.needsUpdate = true;
      if (playing || cameraMoved || needsRender) renderer.render(scene, camera);
      needsRender = false;
    }
    requestAnimationFrame(render);
  } catch (error) {
    console.error('3D demo failed to load', error);
    renderer?.dispose();
    poster.classList.remove('is-loading');
    status.textContent = 'The 3D scene could not load. Please try again or watch the videos below.';
    loadButton.disabled = false;
  }
}, { once: false });
