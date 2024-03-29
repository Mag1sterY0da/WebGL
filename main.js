'use strict';

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.
let camera; // A StereoCamera object that manages the stereo camera parameters.
let webcam; // A Webcam object that obtains the camera feed.
let textureWebcam; // A texture object that holds the webcam feed.
let texture; // A texture object that holds the texture image.
let surfaceWebcam; // A surface model that displays the webcam feed in the background.
let track; // A MediaStreamTrack object that holds the camera feed.

function deg2rad(angle) {
  return (angle * Math.PI) / 180;
}

function CreateWebcamTexture() {
  textureWebcam = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textureWebcam);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function CreateCamera() {
  webcam = document.createElement('video');
  webcam.setAttribute('autoplay', true);
  navigator.getUserMedia({ video: true, audio: false }, function (stream) {
    webcam.srcObject = stream;
    track = stream.getTracks()[0];
  }, function (e) {
    console.error('Rejected!', e);
  });
}

// Constructor
class StereoCamera {
  constructor(
    Convergence,
    EyeSeparation,
    AspectRatio,
    FOV,
    NearClippingDistance,
    FarClippingDistance
  ) {
    this.mConvergence = Convergence;
    this.mEyeSeparation = EyeSeparation;
    this.mAspectRatio = AspectRatio;
    this.mFOV = FOV * Math.PI / 180.0;
    this.mNearClippingDistance = NearClippingDistance;
    this.mFarClippingDistance = FarClippingDistance;
    this.projection = m4.identity();
    this.modelView = m4.identity();
  }
  ApplyLeftFrustum() {

    const top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
    const bottom = -top;

    const a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;

    const b = a - this.mEyeSeparation / 2;
    const c = a + this.mEyeSeparation / 2;

    const left = -b * this.mNearClippingDistance / this.mConvergence;
    const right = c * this.mNearClippingDistance / this.mConvergence;

    this.projection = m4.frustum(left, right, bottom, top,
      this.mNearClippingDistance, this.mFarClippingDistance);
    this.modelView = m4.translation(this.mEyeSeparation / 2, 0.0, 0.0);

  }
  ApplyRightFrustum() {

    const top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
    const bottom = -top;

    const a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;

    const b = a - this.mEyeSeparation / 2;
    const c = a + this.mEyeSeparation / 2;

    const left = -c * this.mNearClippingDistance / this.mConvergence;
    const right = b * this.mNearClippingDistance / this.mConvergence;

    this.projection = m4.frustum(left, right, bottom, top,
      this.mNearClippingDistance, this.mFarClippingDistance);
    this.modelView = m4.translation(-this.mEyeSeparation / 2, 0.0, 0.0);

  }
}

// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iTexCoordsBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function (vertices, normals, texCoords) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STREAM_DRAW);

    this.count = vertices.length / 3;
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordsBuffer);
    gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribTexCoord);

    gl.drawArrays(gl.TRIANGLES, 0, this.count);
  };
}

// Constructor
function ShaderProgram(name, program) {
  this.name = name;
  this.prog = program;

  // Location of the attribute variable in the shader program.
  this.iAttribVertex = -1;
  // Location of the uniform specifying a color for the primitive.
  this.iColor = -1;
  // Location of the uniform matrix representing the combined transformation.
  this.iModelViewProjectionMatrix = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  };
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {

  const a = document.getElementById('a').value;
  const b = document.getElementById('b').value;
  const c = document.getElementById('c').value;
  const d = document.getElementById('d').value;

  const getF = (a, b, v) => {
    return (
      (a * b) /
      Math.sqrt(
        Math.pow(a, 2) +
        Math.pow(Math.sin(v), 2) +
        Math.pow(b, 2) * Math.pow(Math.cos(v), 2)
      )
    );
  };

  const getVertex = (u, v) => {
    const uRad = u;
    const vRad = v;
    const x =
      (1 / 2) *
      (getF(a, b, vRad) * (1 + Math.cos(uRad)) +
        ((Math.pow(d, 2) - Math.pow(c, 2)) * (1 - Math.cos(uRad))) /
        getF(a, b, vRad)) *
      Math.cos(vRad);
    const y =
      (1 / 2) *
      (getF(a, b, vRad) * (1 + Math.cos(uRad)) +
        ((Math.pow(d, 2) - Math.pow(c, 2)) * (1 - Math.cos(uRad))) /
        getF(a, b, vRad)) *
      Math.sin(vRad);
    const z =
      (1 / 2) *
      (getF(a, b, vRad) -
        (Math.pow(d, 2) - Math.pow(c, 2)) / getF(a, b, vRad)) *
      Math.sin(uRad);
    return [x, y, z]
  }
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  /* Set the values of the projection transformation */
  let projection = m4.perspective(Math.PI / 4, 1, 6, 14);

  /* Get the view matrix from the SimpleRotator object.*/
  let modelView = spaceball.getViewMatrix();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -10);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);
  camera.mConvergence = parseFloat(document.getElementById('conv').value);
  camera.mEyeSeparation = parseFloat(document.getElementById('eyes').value);
  camera.mFOV = parseFloat(document.getElementById('fov').value);
  camera.mNearClippingDistance = parseFloat(document.getElementById('near').value);

  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, m4.identity());
  gl.bindTexture(gl.TEXTURE_2D, textureWebcam);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    webcam
  );
  surfaceWebcam.Draw();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.clear(gl.DEPTH_BUFFER_BIT);

  /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
  let modelViewProjection = m4.multiply(projection, matAccum1);
  camera.ApplyLeftFrustum();
  modelViewProjection = m4.multiply(camera.projection, m4.multiply(camera.modelView, matAccum1));
  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
  gl.colorMask(true, false, false, false);
  surface.Draw();
  gl.clear(gl.DEPTH_BUFFER_BIT);

  camera.ApplyRightFrustum();
  modelViewProjection = m4.multiply(camera.projection, m4.multiply(camera.modelView, matAccum1));
  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
  gl.colorMask(false, true, true, false);
  surface.Draw();
  gl.colorMask(true, true, true, true);
}

function animate() {
  draw()
  window.requestAnimationFrame(animate)
}

function updSrf() {
  surface.BufferData(...CreateSurfaceData());
  draw()
}

function CreateSurfaceData() {
  let vertexList = [],
    normalList = [],
    textureList = [];
  const a = document.getElementById('a').value;
  const b = document.getElementById('b').value;
  const c = document.getElementById('c').value;
  const d = document.getElementById('d').value;

  const getF = (a, b, v) => {
    return (
      (a * b) /
      Math.sqrt(
        Math.pow(a, 2) +
        Math.pow(Math.sin(v), 2) +
        Math.pow(b, 2) * Math.pow(Math.cos(v), 2)
      )
    );
  };

  const getVertex = (u, v) => {
    const uRad = deg2rad(u);
    const vRad = deg2rad(v);
    const x =
      (1 / 2) *
      (getF(a, b, vRad) * (1 + Math.cos(uRad)) +
        ((Math.pow(d, 2) - Math.pow(c, 2)) * (1 - Math.cos(uRad))) /
        getF(a, b, vRad)) *
      Math.cos(vRad);
    const y =
      (1 / 2) *
      (getF(a, b, vRad) * (1 + Math.cos(uRad)) +
        ((Math.pow(d, 2) - Math.pow(c, 2)) * (1 - Math.cos(uRad))) /
        getF(a, b, vRad)) *
      Math.sin(vRad);
    const z =
      (1 / 2) *
      (getF(a, b, vRad) -
        (Math.pow(d, 2) - Math.pow(c, 2)) / getF(a, b, vRad)) *
      Math.sin(uRad);
    return [0.75 * x, 0.75 * y, 0.75 * z]
  }

  for (let u = 0; u <= 360; u += 5) {
    for (let v = 0; v <= 360; v += 5) {
      let vertex1 = getVertex(u, v)
      let vertex2 = getVertex(u + 5, v)
      let vertex3 = getVertex(u, v + 5)
      let vertex4 = getVertex(u + 5, v + 5)
      vertexList.push(...vertex1);
      vertexList.push(...vertex2);
      vertexList.push(...vertex3);
      vertexList.push(...vertex3);
      vertexList.push(...vertex2);
      vertexList.push(...vertex4);
      textureList.push(u / 360, v / 360)
      textureList.push((u + 5) / 360, v / 360)
      textureList.push(u / 360, (v + 5) / 360)
      textureList.push(u / 360, (v + 5) / 360)
      textureList.push((u + 5) / 360, v / 360)
      textureList.push((u + 5) / 360, (v + 5) / 360)

    }
  }

  return [vertexList, normalList, textureList];
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
  CreateCamera()
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram('Basic', prog);
  shProgram.Use();
  CreateWebcamTexture()

  shProgram.iAttribVertex = gl.getAttribLocation(prog, 'vertex');
  shProgram.iAttribTexCoord = gl.getAttribLocation(prog, 'texCoord');
  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(
    prog,
    'ModelViewProjectionMatrix'
  );

  surfaceWebcam = new Model();
  surfaceWebcam.BufferData([-1, -1, 0, 1, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 1, 0],
    [],
    [1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0]
  );
  surface = new Model('Surface');
  surface.BufferData(...CreateSurfaceData());

  gl.enable(gl.DEPTH_TEST);
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error('Error in vertex shader:  ' + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error('Error in fragment shader:  ' + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Link error in program:  ' + gl.getProgramInfoLog(prog));
  }
  return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
  let canvas;
  try {
    canvas = document.getElementById('webglcanvas');
    gl = canvas.getContext('webgl');
    if (!gl) {
      throw 'Browser does not support WebGL';
    }
  } catch (e) {
    document.getElementById('canvas-holder').innerHTML =
      '<p>Sorry, could not get a WebGL graphics context.</p>';
    return;
  }
  try {
    initGL(); // initialize the WebGL graphics context
  } catch (e) {
    document.getElementById('canvas-holder').innerHTML =
      '<p>Sorry, could not initialize the WebGL graphics context: ' +
      e +
      '</p>';
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);
  camera = new StereoCamera(1000, 0.1, 1, 45, 1, 15);

  LoadTexture()

  draw();
  animate()
}

function LoadTexture() {
  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const image = new Image();
  image.crossOrigin = 'anonymus';
  image.src = "https://static.turbosquid.com/Preview/2014/08/01__12_04_02/Urban__Brickwall1.jpg766465EF-01F6-40FD-A9055898D5FDCEA3.jpgLarger.jpg";
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );
    console.log("imageLoaded")
    draw()
  }
}