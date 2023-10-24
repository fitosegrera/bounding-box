let detector;
let poses;
let video;
let skeletonJointNames;
let roboto;
let poseData = [];

//fps
var lastLoop = 0;
var thisLoop = 0;

// Boundries
// const w = window.innerWidth;
// const h = window.innerHeight;
const w = 640;
const h = 480;
const z = 320;

const collisionBoundryX = 150;
const collisionBoundryY = 50;
const collisionBoundryZ = 50;

//Check Joints and KeyPoints ->
//https://github.com/tensorflow/tfjs-models/tree/master/pose-detection#keypoint-diagram
let POSE_CHAIN_INDICES = [
  ["0", "1"],
  ["1", "3"],
  ["0", "2"],
  ["2", "4"],
  ["0", "5"],
  ["5", "7"],
  ["7", "9"],
  ["5", "11"],
  ["11", "13"],
  ["13", "15"],
  ["0", "6"],
  ["6", "8"],
  ["8", "10"],
  ["6", "12"],
  ["12", "14"],
  ["14", "16"],
];

const FLAGS = {
  WEBGL_CHECK_NUMERICAL_PROBLEMS: true,
  WEBGL_CONV_IM2COL: true,
  WEBGL_CPU_FORWARD: true,
  WEBGL_DELETE_TEXTURE_THRESHOLD: -1,
  WEBGL_DOWNLOAD_FLOAT_ENABLED: true,
  WEBGL_FLUSH_THRESHOLD: -1,
  WEBGL_FORCE_F16_TEXTURES: false,
  WEBGL_LAZILY_UNPACK: true,
  WEBGL_MAX_TEXTURES_IN_SHADER: 16,
  WEBGL_PACK_IMAGE_OPERATIONS: true,
};

function preload() {
  roboto = loadFont("/assets/Roboto-Regular.ttf");
}

async function init() {
  tf.env().setFlags(FLAGS);

  const model = poseDetection.SupportedModels.BlazePose;
  const detectorConfig = {
    runtime: "tfjs", // 'mediapipe', 'tfjs'
    modelType: "full", // 'lite', 'full', 'heavy'
  };
  detector = await poseDetection.createDetector(model, detectorConfig);
  console.log(tf.env().getFlags());
}

async function videoReady() {
  //video.size(320, 240);

  console.log("Screen Dims: " + width + ", " + height);
  console.log(
    "Video element: " + video.elt.videoWidth + ", " + video.elt.videoHeight
  );
  console.log("Video dims: " + video.width + ", " + video.height);

  console.log("video ready");
  select("#status").html("Model Loaded");
  select("#status").hide();
  await getPoses();
}

async function setup() {
  video = createCapture(VIDEO, videoReady);
  video.hide();

  let cnv = createCanvas(window.innerWidth, window.innerHeight, WEBGL);
  cnv.parent("sketch-holder");
  //cnv.style("position", "absolute");
  await init();
  initSkeletonJoinNames();
  angleMode(DEGREES);
  textFont(roboto);
  textSize(12);

  leftColor = "#00000000";
}

async function getPoses() {
  if (detector) {
    poses = await detector.estimatePoses(video.elt);
  }

  requestAnimationFrame(getPoses);
}

function draw() {
  background(0);
  //image(video, 0, 0); //That speed up my code
  translate(-width / 2, -height / 2, 0);
  // drawBoundingBox();

  //Fps calculations
  thisLoop = millis();
  fps = 1000 / (thisLoop - lastLoop);
  lastLoop = thisLoop;

  push();
  if (poses && poses.length > 0) {
    let count = 0;
    for (let pose of poses) {
      drawKeypoints(pose);
      drawData(pose);
      // drawSkeleton(pose);
    }
  }

  pop();

  // DRAW DATA
}

function drawData(pose) {
  let count = 0;
  for (let keypoint of pose.keypoints3D) {
    let x = video.width - map(keypoint.x, -1, 1, 0, video.width);
    let y = map(keypoint.y, -1, 1, 0, video.height);
    // let z = map(keypoint.z, -1, 1, 0, 200);
    noStroke();
    stroke(theme.colors.primary);
    noFill();
    fill(255);
    let tmpText = `${keypoint.name} x: ${keypoint.x} y: ${keypoint.y}`;
    text(tmpText, 10, (count + 1) * 20);
    count++;
  }
}

function drawKeypoints(pose) {
  let count = 0;
  for (let keypoint of pose.keypoints3D) {
    if (keypoint.score > 0.3) {
      let x = video.width - map(keypoint.x, -1, 1, 0, video.width);
      let y = map(keypoint.y, -1, 1, 0, video.height);
      // let z = map(keypoint.z, -1, 1, 0, 200);

      noStroke();

      // LEFT COLLISION
      if (x <= collisionBoundryX) {
        // console.log("Left Boundry");
        fill(theme.colors.collision);
        rect(0, 0, theme.sizing.collisionBox, height);
      }

      // RIGHT COLLISION
      if (x >= targetVideoWidth - collisionBoundryX) {
        // console.log("Right Boundry");
        fill(theme.colors.collision);
        rect(
          width - theme.sizing.collisionBox,
          0,
          theme.sizing.collisionBox,
          height
        );
      }

      // FRONT COLLISION
      if (z <= collisionBoundryZ) {
        // console.log("Front Boundry");
        fill(theme.colors.collision);
        // rect(0, 0, w, h);
      }

      // TOP COLLISION
      if (y <= collisionBoundryY) {
        // console.log("Top Boundry");
        fill(theme.colors.collision);
        rect(0, 0, width, theme.sizing.collisionBox);
      }

      // BOTTOM COLLISION
      if (y >= targetVideoHeight - collisionBoundryX) {
        // console.log("Bottom Boundry");
        fill(theme.colors.collision);
        rect(
          0,
          height - theme.sizing.collisionBox,
          width,
          theme.sizing.collisionBox
        );
      }

      // Draw a circle at the keypoint position
      // if (keypoint.name == "nose") {
      //   console.log("Nose");
      //   fill(theme.colors.reference);
      //   noStroke();
      // } else {
      //   stroke(theme.colors.primary);
      //   noFill();
      // }

      fill(theme.colors.reference);
      noStroke();
      push();
      translate(width - video.width, video.height / 2, 0);
      circle(x, y, 8);
      noFill();
      stroke(theme.colors.primary);

      rect(150, 0, 350, video.height);
      pop();
    }
  }
}

function initSkeletonJoinNames() {
  skeletonJointNames = [];
  for (let side of ["left", "right"]) {
    for (let chain of [
      ["shoulder", "elbow", "wrist"],
      ["hip", "knee", "ankle", "heel"],
    ]) {
      for (let i = 1; i < chain.length; i++) {
        let p1 = chain[i - 1];
        let p2 = chain[i];
        let name1 = `${side}_${p1}`;
        let name2 = `${side}_${p2}`;
        skeletonJointNames.push([name1, name2]);
      }
    }
    for (let finger of ["pinky", "index", "thumb"]) {
      skeletonJointNames.push([`${side}_wrist`, `${side}_${finger}`]);
    }
  }
}

function drawSkeleton(pose) {
  for (let [name1, name2] of skeletonJointNames) {
    let keypoint1 = findKeypoint(pose, name1);
    let keypoint2 = findKeypoint(pose, name2);
    if (min(keypoint1.score, keypoint2.score) > 0.3) {
      stroke(255, 255, 255);
      line(
        video.width - keypoint1.x,
        keypoint1.y,
        video.width - keypoint2.x,
        keypoint2.y
      );
    }
  }
}

function findKeypoint(pose, name) {
  return pose.keypoints.find((keypoint) => keypoint.name === name);
}

function isEyeCorner(keypoint) {
  return (
    keypoint.name.endsWith("eye_outer") || keypoint.name.endsWith("eye_inner")
  );
}

function isFingerJoint(keypoint) {
  return (
    keypoint.name.endsWith("pinky") ||
    keypoint.name.endsWith("index") ||
    keypoint.name.endsWith("thumb")
  );
}

function isFacialFeature(keypoint) {
  return keypoint.name.match(/nose|eye|ear|mouth/);
}

function isSkeletalJoin(keypoint) {
  return !isFacialFeature(keypoint);
}
