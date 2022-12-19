import * as THREE from './vendor/three.module.js';

const focusInput = document.querySelector('#focus');

const scene = new THREE.Scene();
let width = window.innerWidth;
let height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
const renderer = new THREE.WebGLRenderer();
let fragmentShader, vertexShader;

renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);
camera.position.z = 2;
scene.add(camera);

let fieldTexture;
let plane, planeMat, planePts;
const filename = './frames.mp4';
const camsX = 48;
const camsY = 1;
const resX = 960;
const resY = 1280;
let focus = Number(focusInput.value);

window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.render(scene, camera);
});

focusInput.addEventListener('input', e => {
  focus = Number(focusInput.value);
  console.log('focus', focus);
  planeMat.uniforms.focus.value = focus;
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

async function loadScene() {
  await loadShaders();
  await extractVideo();
  loadPlane();
  animate();
}

async function loadShaders() {
  vertexShader = await fetch('./vertex.glsl').then(res => res.text());
  fragmentShader = await fetch('./fragment.glsl').then(res => res.text());
  console.log('Loaded shaders');
}

async function extractVideo() {
  // based on https://stackoverflow.com/questions/32699721/javascript-extract-video-frames-reliably
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = resX;
  canvas.height = resY;
  canvas.setAttribute('id', 'videosrc');
  video.src = filename;
  let seekResolve;
  let count = 0;
  let offset = 0;
  const allBuffer = new Uint8Array(resX * resY * 4 * camsX * camsY);

  console.log('starting extraction');

  const getBufferFromVideo = () => {
    ctx.drawImage(video, 0, 0, resX, resY);
    const imgData = ctx.getImageData(0, 0, resX, resY);
    allBuffer.set(imgData.data, offset);
    offset += imgData.data.byteLength;
    count++;
    console.log(`Loaded ${Math.round(100 * count / (camsX * camsY))}%`);
  };

  const fetchFrames = async () => {
    let currentTime = 0;

    while (count < camsX * camsY) {
      getBufferFromVideo();
      currentTime += 0.0333;
      video.currentTime = currentTime;
      await new Promise(res => (seekResolve = res));
    }

    fieldTexture = new THREE.DataTexture2DArray(allBuffer, resX, resY, camsX * camsY);
    console.log('Loaded field data');

    planeMat.uniforms.field.value = fieldTexture;
    fieldTexture.needsUpdate = true;
  };

  video.addEventListener('seeked', async function () {
    if (seekResolve) seekResolve();
  });


  video.addEventListener('loadeddata', async () => {
    await fetchFrames();
    console.log('loaded data');
  });
}

function loadPlane() {
  const planeGeo = new THREE.PlaneGeometry(resX, resY, camsX, camsY);
  planeMat = new THREE.ShaderMaterial({
    uniforms: {
      field: { value: fieldTexture },
      camArraySize: new THREE.Uniform(new THREE.Vector2(camsX, camsY)),
      aperture: { value: 5 },
      focus: { value: focus }
    },
    vertexShader,
    fragmentShader,
  });
  plane = new THREE.Mesh(planeGeo, planeMat);
  scene.add(plane);
  console.log('Loaded plane');
}

loadScene();