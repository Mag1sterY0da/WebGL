'use strict';

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.
let sphere;

function deg2rad(angle) {
  return (angle * Math.PI) / 180;
}

// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iNormalBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function (vertices, normals) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STREAM_DRAW);

    this.count = vertices.length / 3;
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribNormal);

    // gl.drawArrays(gl.LINE_STRIP, 0, this.count);
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

  /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
  let modelViewProjection = m4.multiply(projection, matAccum1);

  gl.uniformMatrix4fv(
    shProgram.iModelViewProjectionMatrix,
    false,
    modelViewProjection
  );

  const normal = m4.identity();
  m4.inverse(modelView, normal);
  m4.transpose(normal, normal);

  gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normal);


  /* Draw the six faces of a cube, with different colors. */
  gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);
  gl.uniform3fv(shProgram.iLightPos, [3 * Math.cos(Date.now() * 0.001), 3 * Math.sin(Date.now() * 0.001), 1]);

  surface.Draw();
  gl.uniform4fv(shProgram.iColor, [1, 1, 0, 255]);
  gl.uniformMatrix4fv(
    shProgram.iModelViewProjectionMatrix,
    false,
    m4.multiply(modelViewProjection,
      m4.translation(3 * Math.cos(Date.now() * 0.001), 3 * Math.sin(Date.now() * 0.001), 1))
  );
  sphere.Draw();
}

function animate() {
  draw()
  window.requestAnimationFrame(animate)
}

function CreateSurfaceData() {
  let vertexList = [],
    normalList = [];
  const a = 1.5;
  const b = 3;
  const c = 2;
  const d = 1;

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
    return [x, y, z]
  }

  const getNormal = (u, v) => {
    let psi = 0.0001
    let uv = getVertex(u, v)
    let u1 = getVertex(u + psi, v)
    let v1 = getVertex(u, v + psi)
    let dU = []
    let dV = []
    for (let i = 0; i < 3; i++) {
      dU.push((uv[i] - u1[i]) / psi)
      dV.push((uv[i] - v1[i]) / psi)
    }
    const n = m4.normalize(m4.cross(dU, dV))
    return n
  }

  for (let u = 0; u <= 360; u += 5) {
    for (let v = 0; v <= 360; v += 5) {
      let vertex1 = getVertex(u, v)
      let vertex2 = getVertex(u + 5, v)
      let vertex3 = getVertex(u, v + 5)
      let vertex4 = getVertex(u + 5, v + 5)
      let Normal1 = getNormal(u, v)
      let Normal2 = getNormal(u + 5, v)
      let Normal3 = getNormal(u, v + 5)
      let Normal4 = getNormal(u + 5, v + 5)
      vertexList.push(...vertex1);
      vertexList.push(...vertex2);
      vertexList.push(...vertex3);
      vertexList.push(...vertex3);
      vertexList.push(...vertex2);
      vertexList.push(...vertex4);
      normalList.push(...Normal1);
      normalList.push(...Normal2);
      normalList.push(...Normal3);
      normalList.push(...Normal3);
      normalList.push(...Normal2);
      normalList.push(...Normal4);
    }
  }

  return [vertexList, normalList];
}

function CreateSphereSurfaceData() {
  let vertexList = [];

  let u = 0,
    t = 0;
  while (u < Math.PI * 2) {
    while (t < Math.PI) {
      let v = sphereSurface(u, t);
      let w = sphereSurface(u + 0.1, t);
      let wv = sphereSurface(u, t + 0.1);
      let ww = sphereSurface(u + 0.1, t + 0.1);
      vertexList.push(v.x, v.y, v.z);
      vertexList.push(w.x, w.y, w.z);
      vertexList.push(wv.x, wv.y, wv.z);
      vertexList.push(wv.x, wv.y, wv.z);
      vertexList.push(w.x, w.y, w.z);
      vertexList.push(ww.x, ww.y, ww.z);
      t += 0.1;
    }
    t = 0;
    u += 0.1;
  }
  return vertexList
}
const radius = 0.1;
function sphereSurface(long, lat) {
  return {
    x: radius * Math.cos(long) * Math.sin(lat),
    y: radius * Math.sin(long) * Math.sin(lat),
    z: radius * Math.cos(lat)
  }
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram('Basic', prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, 'vertex');
  shProgram.iAttribNormal = gl.getAttribLocation(prog, 'normal');
  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(
    prog,
    'ModelViewProjectionMatrix'
  );
  shProgram.iNormalMatrix = gl.getUniformLocation(
    prog,
    'NormalM'
  );
  shProgram.iColor = gl.getUniformLocation(prog, 'color');
  shProgram.iLightPos = gl.getUniformLocation(prog, 'lightPos');

  surface = new Model('Surface');
  surface.BufferData(...CreateSurfaceData());
  sphere = new Model()
  sphere.BufferData(CreateSphereSurfaceData(), CreateSphereSurfaceData())

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

  draw();
  animate()
}
