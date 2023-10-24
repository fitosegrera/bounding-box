let video;
let videoWidth = 720;
let videoHeight = 405;
const targetVideoWidth = 720;
const targetVideoHeight = 405;

const w = videoWidth;
const h = videoHeight;
const z = 320;

let detector;
let poses;
let skeletonJointNames;
let roboto;
let poseData = [];

let referenceX;
let referenceY;

//fps
var lastLoop = 0;
var thisLoop = 0;

const collisionBoundryX = 160;
const collisionBoundryY = 10;
const collisionBoundryZ = 160;
const collisionWidth = 24;
let collidingKeypoint = null;

// SOCKETS
const socket = io();

// TEXTS
let p = [];

// FLAGS
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

let drawingSettings = {};
let drawingReference = {};

async function init() {
  tf.env().setFlags(FLAGS);

  // LOAD MODEL
  const model = poseDetection.SupportedModels.BlazePose;
  const detectorConfig = {
    runtime: "tfjs", // 'mediapipe', 'tfjs'
    modelType: "full", // 'lite', 'full', 'heavy'
  };
  detector = await poseDetection.createDetector(model, detectorConfig);
}

const handlePortChange = (value) => {
  console.log(value);
};

function preload() {
  roboto = loadFont("/assets/Roboto-Regular.ttf");
}

async function setup() {
  const cnv = createCanvas(window.innerWidth, window.innerHeight, WEBGL);
  cnv.parent("sketch-holder");

  angleMode(DEGREES);
  textFont(roboto);
  textSize(12);

  //CREATE AND LOAD VIDEO SAMPLE
  // video = createVideo("assets/sample.mp4");
  video = createCapture(VIDEO);
  video.size("auto");
  video.position(0, 0);
  video.volume(0);
  video.loop();
  video.hide();

  await getPoses();
  await init();
  initSkeletonJoinNames();

  // CREATE TEXT WRAPPER
  let textWrapper = createDiv("");
  textWrapper.style("position", "absolute");
  textWrapper.style("top", "50%");
  textWrapper.style("transform", "translateY(-50%)");
  textWrapper.style("left", "80px");

  // HIDE STATUS
  select("#status").html("Model Loaded");
  select("#status").hide();

  // GUI
  drawingSettings = {
    liveCapture: false,
    isVideReferenceActive: true,
    isVideoFrameActive: true,
    collisionBox: true,
    showCollisions: true,
    drawData: true,
    collisionBoundryLeft: 160,
    collisionBoundryRight: 560,
    collisionBoundryTop: 10,
    collisionBoundryBottom: 390,
    serialPort: "/dev/ttyACM0",
    baudRate: "115200",
    textMarginLeft: 160,
  };
  let gui = new dat.GUI(); //Creates the UI overlay box.
  gui.domElement.id = "gui";

  //Add variables to the UI.

  gui.add(drawingSettings, "isVideReferenceActive").name("Video Reference");
  gui.add(drawingSettings, "isVideoFrameActive").name("Video Frame");
  gui.add(drawingSettings, "collisionBox").name("Collision Box");
  gui.add(drawingSettings, "showCollisions").name("Show Collisions");
  gui.add(drawingSettings, "drawData").name("Show Data");
  gui
    .add(drawingSettings, "collisionBoundryLeft", 0, 360, 1)
    .name("Collision Left");
  gui
    .add(drawingSettings, "collisionBoundryRight", 360, 720, 1)
    .name("Collision Right");
  gui
    .add(drawingSettings, "collisionBoundryTop", 0, 80, 1)
    .name("Collision Top");
  gui
    .add(drawingSettings, "collisionBoundryBottom", 320, 405, 1)
    .name("Collision Bottom");
  gui
    .add(drawingSettings, "serialPort")
    .name("Serial Port")
    .onChange(handlePortChange);
  gui
    .add(drawingSettings, "baudRate", ["115200", "57600", "9600"])
    .name("Baudrate");
  var obj = {
    updateSerialPort: function () {
      socket.emit("serialPort", {
        path: drawingSettings.serialPort,
        baudRate: drawingSettings.baudRate,
      });
    },
  };
  gui.add(obj, "updateSerialPort");
  gui
    .add(drawingSettings, "textMarginLeft", 0, 240, 1)
    .name("Data Margin Left")
    .onChange(() => {
      textWrapper.style(
        "left",
        drawingSettings.textMarginLeft.toString() + "px"
      );
    });

  // gui.addColor(theme.colors, "primary").name("Primary Color");
  // gui.addColor(theme.colors, "collision").name("Collision Color");
  // gui.addColor(theme.colors, "reference").name("Reference Color");

  referenceX = width - targetVideoWidth - 80;
  referenceY = height / 2 - targetVideoHeight / 2;

  // TEXTS
  for (let i = 0; i < 33; i++) {
    textWrapper.style("left", drawingSettings.textMarginLeft.toString() + "px");
    const tmpText = createP("");
    tmpText.style("color", "#ffffff");
    tmpText.style("font-size", "12px");
    p.push(tmpText);
    textWrapper.child(tmpText);
  }
}

function draw() {
  background(0);

  translate(-width / 2, -height / 2, 0);

  if (drawingSettings.isVideReferenceActive) {
    push();
    scale(-1, 1);

    image(
      video,
      -width + targetVideoWidth / 9,
      referenceY + targetVideoHeight,
      targetVideoWidth / 3,
      targetVideoHeight / 3
    );
    pop();
  }

  //Fps calculations
  thisLoop = millis();
  fps = 1000 / (thisLoop - lastLoop);
  lastLoop = thisLoop;

  push();
  if (poses && poses.length > 0) {
    for (let pose of poses) {
      drawKeypoints(pose);
      drawSkeleton(pose);
      if (drawingSettings.drawData) {
        push();
        translate(24, 56);
        drawData(pose, 1);
        pop();
      }
    }
  }

  pop();
}

//////////////////////////////

async function getPoses() {
  if (detector) {
    poses = await detector.estimatePoses(video.elt);
  }

  requestAnimationFrame(getPoses);
}

function drawData(pose, cols = 1) {
  if (p.length > 0) {
    for (let c = 0; c < cols; c++) {
      let count = 0;
      for (let keypoint of pose.keypoints3D) {
        noStroke();
        stroke(theme.colors.primary);
        noFill();
        if (collidingKeypoint && collidingKeypoint.name === keypoint.name) {
          fill(theme.colors.collision);
          p[count].style("color", "#ff0077");
        } else {
          fill(255);
          p[count].style("color", "#ffffff");
        }

        let tmpText = `${keypoint.name} x: ${keypoint.x} y: ${keypoint.y}`;
        // text(tmpText, 10 + c * 360, (count + 1) * 25);
        p[count].html(tmpText);
        count++;
      }
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

    let x1 = targetVideoWidth - map(keypoint1.x, -1, 1, 0, targetVideoWidth);
    let y1 = map(keypoint1.y, -1, 1, 0, targetVideoHeight);
    let z1 = map(keypoint1.z, -1, 1, 0, targetVideoHeight);

    let x2 = targetVideoWidth - map(keypoint2.x, -1, 1, 0, targetVideoWidth);
    let y2 = map(keypoint2.y, -1, 1, 0, targetVideoHeight);
    let z2 = map(keypoint2.z, -1, 1, 0, targetVideoHeight);

    push();
    translate(referenceX, referenceY);
    if (min(keypoint1.score, keypoint2.score) > 0.3) {
      stroke(255, 255, 255);
      line(x1, y1, x2, y2);
    }
    pop();
  }
}

function findKeypoint(pose, name) {
  return pose.keypoints3D.find((keypoint) => keypoint.name === name);
}

function drawKeypoints(pose) {
  for (let keypoint of pose.keypoints3D) {
    if (keypoint.score > 0.3) {
      let x = targetVideoWidth - map(keypoint.x, -1, 1, 0, targetVideoWidth);
      let y = map(keypoint.y, -1, 1, 0, targetVideoHeight);
      let z = map(keypoint.z, -1, 1, -targetVideoHeight, targetVideoHeight);

      noStroke();
      push();
      translate(referenceX, referenceY);
      // LEFT COLLISION
      if (x <= drawingSettings.collisionBoundryLeft) {
        fill(theme.colors.collision);
        drawingSettings.showCollisions &&
          rect(
            drawingSettings.collisionBoundryLeft - collisionWidth,
            drawingSettings.collisionBoundryTop,
            collisionWidth,
            drawingSettings.collisionBoundryBottom -
              drawingSettings.collisionBoundryTop
          );
        socket.emit("hit", "left");
        collidingKeypoint = keypoint;
      }
      // RIGHT COLLISION
      if (x >= drawingSettings.collisionBoundryRight) {
        fill(theme.colors.collision);
        drawingSettings.showCollisions &&
          rect(
            drawingSettings.collisionBoundryRight,
            drawingSettings.collisionBoundryTop,
            collisionWidth,
            drawingSettings.collisionBoundryBottom -
              drawingSettings.collisionBoundryTop
          );
        socket.emit("hit", "right");
        collidingKeypoint = keypoint;
      }

      // FRONT COLLISION
      if (z >= collisionBoundryZ) {
        fill(theme.colors.collisionTranslucent);
        drawingSettings.showCollisions &&
          rect(
            drawingSettings.collisionBoundryLeft,
            drawingSettings.collisionBoundryTop,
            drawingSettings.collisionBoundryRight -
              drawingSettings.collisionBoundryLeft,
            drawingSettings.collisionBoundryBottom -
              drawingSettings.collisionBoundryTop
          );
        socket.emit("hit", "front");
        collidingKeypoint = keypoint;
      }

      // BACK COLLISION
      if (z <= -collisionBoundryZ) {
        fill(theme.colors.collisionTranslucent);
        drawingSettings.showCollisions &&
          rect(
            drawingSettings.collisionBoundryLeft,
            collisionBoundryY,
            drawingSettings.collisionBoundryRight -
              drawingSettings.collisionBoundryLeft,
            targetVideoHeight - collisionBoundryY * 2
          );
        socket.emit("hit", "back");
        collidingKeypoint = keypoint;
      }

      // TOP COLLISION
      if (y <= drawingSettings.collisionBoundryTop) {
        fill(theme.colors.collision);
        drawingSettings.showCollisions &&
          rect(
            drawingSettings.collisionBoundryLeft,
            drawingSettings.collisionBoundryTop,
            drawingSettings.collisionBoundryRight -
              drawingSettings.collisionBoundryLeft,
            drawingSettings.collisionBoundryBottom -
              drawingSettings.collisionBoundryTop
          );
        socket.emit("hit", "top");
        collidingKeypoint = keypoint;
      }

      // BOTTOM COLLISION
      if (y >= drawingSettings.collisionBoundryBottom) {
        fill(theme.colors.collision);
        drawingSettings.showCollisions &&
          rect(
            drawingSettings.collisionBoundryLeft,
            drawingSettings.collisionBoundryBottom,
            drawingSettings.collisionBoundryRight -
              drawingSettings.collisionBoundryLeft,
            collisionWidth
          );
        socket.emit("hit", "bottom");
        collidingKeypoint = keypoint;
      }
      pop();

      drawReference(x, y);
    }
  }
}

function drawReference(x, y) {
  fill(theme.colors.reference);
  noStroke();
  push();
  translate(referenceX, referenceY);
  circle(x, y, 8);
  noFill();
  //video box
  stroke(theme.colors.primary);
  if (drawingSettings.isVideoFrameActive) {
    rect(0, 0, targetVideoWidth, targetVideoHeight);
  }
  //collision box
  stroke(theme.colors.reference);
  if (drawingSettings.collisionBox) {
    // TOP
    line(
      drawingSettings.collisionBoundryLeft,
      drawingSettings.collisionBoundryTop,
      drawingSettings.collisionBoundryRight,
      drawingSettings.collisionBoundryTop
    );
    // BOTTOM
    line(
      drawingSettings.collisionBoundryLeft,
      drawingSettings.collisionBoundryBottom,
      drawingSettings.collisionBoundryRight,
      drawingSettings.collisionBoundryBottom
    );
    // LEFT
    line(
      drawingSettings.collisionBoundryLeft,
      drawingSettings.collisionBoundryTop,
      drawingSettings.collisionBoundryLeft,
      drawingSettings.collisionBoundryBottom
    );
    // RIGHT
    line(
      drawingSettings.collisionBoundryRight,
      drawingSettings.collisionBoundryTop,
      drawingSettings.collisionBoundryRight,
      drawingSettings.collisionBoundryBottom
    );
  }
  pop();
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
