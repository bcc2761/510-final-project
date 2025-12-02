  'use strict';

  // Global variables that are set and used
  // across the application
let verticesSize,
    vertices,
    adapter,
    context,
    colorAttachment,
    colorTextureView,
    colorTexture,
    depthTexture,
    code,
    computeCode,
    shaderDesc,
    colorState,
    shaderModule,
    pipeline,
    renderPassDesc,
    commandEncoder,
    passEncoder,
    device,
    drawingTop,
    drawingLeft,
    canvas,
    points,
    colors,
    uniformValues,
    uniformBindGroup;
  
  // buffers
  let myVertexBuffer = null;
let myColorBuffer = null;
  let uniformBuffer;

  // Other globals with default values
  var updateDisplay = true;
  var anglesReset = [0.0, 0.0, 0.0];
  var angles = [0.0, 0.0, 0.0];
  var angleInc = 5.0;
  var scaleReset = 0.5;
  var scale = 0.5;
  var scaleInc = 0.8;
 
// palette
const palette = [
  [1.0, 0.0, 0.0], // red
  [0.0, 1.0, 0.0], // green
  [0.0, 0.0, 1.0], // blue
  [1.0, 1.0, 0.0], // yellow
  [0.0, 1.0, 1.0], // cyan
  [1.0, 0.0, 1.0], // magenta
];
let paletteIndex = 0;

function nextColor() {
    const c = palette[paletteIndex % palette.length];
    paletteIndex++;
    return c;
}


function addLine(firstPosition, secondPosition) {
    // push first vertex
    points.push(firstPosition[0], firstPosition[1], firstPosition[2]);
    colors.push(...nextColor());

    // push second vertex
    points.push(secondPosition[0], secondPosition[1], secondPosition[2]);
    colors.push(...nextColor());
}

// set up the shader var's
function setShaderInfo() {
    // set up the shader code var's
    code = document.getElementById('shader').innerText;
    shaderDesc = { code: code };
    shaderModule = device.createShaderModule(shaderDesc);
    colorState = {
        format: 'bgra8unorm'
    };

    // set up depth
    // depth shading will be needed for 3d objects in the future
    depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
}

  // Create a program with the appropriate vertex and fragment shaders
  async function initProgram() {

      // Check to see if WebGPU can run
      if (!navigator.gpu) {
          console.error("WebGPU not supported on this browser.");
          return;
      }

      // get webgpu browser software layer for graphics device
      adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
          console.error("No appropriate GPUAdapter found.");
          return;
      }

      // get the instantiation of webgpu on this device
      device = await adapter.requestDevice();
      if (!device) {
          console.error("Failed to request Device.");
          return;
      }

      // configure the canvas
      context = canvas.getContext('webgpu');
      const canvasConfig = {
          device: device,
          // format is the pixel format
          format: navigator.gpu.getPreferredCanvasFormat(),
          // usage is set up for rendering to the canvas
          usage:
              GPUTextureUsage.RENDER_ATTACHMENT,
          alphaMode: 'opaque'
      };
      context.configure(canvasConfig);

  }

// --- Common buffer creation ---
function createBuffers() {
    // --- Position buffer ---
    const vertexAttribDesc = {
        shaderLocation: 0, // @location(0) in vertex shader
        offset: 0,
        format: 'float32x3' // 3 floats: x,y,z
    };

    // this sets up our buffer layout
    const vertexBufferLayoutDesc = {
        attributes: [vertexAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3,
        stepMode: 'vertex'
    };

    // buffer layout and filling
    const vertexBufferDesc = {
        size: points.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myVertexBuffer = device.createBuffer(vertexBufferDesc);
    new Float32Array(myVertexBuffer.getMappedRange()).set(points);
    myVertexBuffer.unmap();

    // --- Color buffer ---
    const colorAttribDesc = {
        shaderLocation: 1,
        offset: 0,
        format: 'float32x3'
    };
    const colorBufferLayoutDesc = {
        attributes: [colorAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3,
        stepMode: 'vertex'
    };

    const colorBufferDesc = {
        size: colors.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myColorBuffer = device.createBuffer(colorBufferDesc);
    new Float32Array(myColorBuffer.getMappedRange()).set(colors);
    myColorBuffer.unmap();

    return { vertexBufferLayoutDesc, colorBufferLayoutDesc };
}

function createPipeline(vertexBufferLayoutDesc, colorBufferLayoutDesc) {
    let uniformBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {}
            }
        ]
    });

    // set up the pipeline layout
    const pipelineLayoutDesc = { bindGroupLayouts: [uniformBindGroupLayout] };
    const layout = device.createPipelineLayout(pipelineLayoutDesc);

    // pipeline desc
    const pipelineDesc = {
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [vertexBufferLayoutDesc, colorBufferLayoutDesc]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [colorState]
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
        primitive: {
            topology: 'line-list',  
            frontFace: 'cw', // this doesn't matter for lines
            cullMode: 'back'
        }
    };

    pipeline = device.createRenderPipeline(pipelineDesc);

    uniformValues = new Float32Array([angles[0], angles[1], angles[2], scale]);
    uniformBuffer = device.createBuffer({
        size: uniformValues.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // copy the values from JavaScript to the GPU
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniformBuffer,
                },
            },
        ],
    });
}
function createLSystemB() {
    setShaderInfo();
    points = [];
    colors = [];
    paletteIndex = 0;

    let grammar = createGrammarB();
    initial_length = 1.0 / Math.pow(2, iterations);
    drawGrammarPoints(grammar);

    const { vertexBufferLayoutDesc, colorBufferLayoutDesc } = createBuffers();
    createPipeline(vertexBufferLayoutDesc, colorBufferLayoutDesc);
    updateDisplay = true;
}

function createLSystemE() {
    setShaderInfo();
    points = [];
    colors = [];
    paletteIndex = 0;

    let grammar = createGrammarE();
    initial_length = 1.0 / Math.pow(2, iterations);
    drawGrammarPoints(grammar);
    
    const { vertexBufferLayoutDesc, colorBufferLayoutDesc } = createBuffers();
    createPipeline(vertexBufferLayoutDesc, colorBufferLayoutDesc);
    updateDisplay = true;
}


// We call draw to render to our canvas
function draw() {
    
    // set up color info
    colorTexture = context.getCurrentTexture();
    colorTextureView = colorTexture.createView();

    // a color attachment ia like a buffer to hold color info
    colorAttachment = {
        view: colorTextureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
    };
    renderPassDesc = {
        colorAttachments: [colorAttachment],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        },
    };

    // convert to radians before sending to shader
    uniformValues[0] = radians(angles[0]);
    uniformValues[1] = radians(angles[1]);
    uniformValues[2] = radians(angles[2]);
    uniformValues[3] = scale;

    // copy the values from JavaScript to the GPU
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    // create the render pass
    commandEncoder = device.createCommandEncoder();
    passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
    passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, myVertexBuffer);
    passEncoder.setVertexBuffer(1, myColorBuffer);
    passEncoder.draw(points.length/3);
    passEncoder.end();

    // submit the pass to the device
    device.queue.submit([commandEncoder.finish()]);
}


  // Entry point to our application
async function init() {
    // Retrieve the canvas
    canvas = document.querySelector("canvas");

    // deal with keypress
    window.addEventListener('keydown', gotKey, false);

    // Read, compile, and link your shaders
    await initProgram();
    initializeGrammarVars();
    // create and bind your current object
    // createLSystem();
    createLSystemB();
    // createLSystemE();
    

    // do a draw
    draw();
}
