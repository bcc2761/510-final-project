// lsystemMain.js
// Bennett Chang
// CSCI-510

'use strict';

// Global variables
let verticesSize,
    adapter,
    context,
    colorAttachment,
    colorTextureView,
    colorTexture,
    depthTexture,
    code,
    shaderDesc,
    colorState,
    shaderModule,
    pipeline,
    renderPassDesc,
    commandEncoder,
    passEncoder,
    device,
    canvas,
    points, // Global points array
    uniformValues,
    uniformBindGroup;
  
// Buffers
let myVertexBuffer = null;
let myColorBuffer = null;
let uniformBuffer;

// Display globals
var updateDisplay = true;
var anglesReset = [0.0, 0.0, 0.0];
var angles = [0.0, 0.0, 0.0];
var angleInc = 5.0;
var scaleReset = 0.5;
var scale = 0.5;
var scaleInc = 0.8;
 
function setShaderInfo() {
    code = document.getElementById('shader').innerText;
    shaderDesc = { code: code };
    shaderModule = device.createShaderModule(shaderDesc);
    colorState = { format: 'bgra8unorm' };

    depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
}

async function initProgram() {
      if (!navigator.gpu) {
          console.error("WebGPU not supported.");
          return;
      }
      adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return;
      device = await adapter.requestDevice();
      if (!device) return;

      context = canvas.getContext('webgpu');
      const canvasConfig = {
          device: device,
          format: navigator.gpu.getPreferredCanvasFormat(),
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
          alphaMode: 'opaque'
      };
      context.configure(canvasConfig);
}

// Main generation function
function createLSystem(type) {
    if (!type) type = 'fractal'; // Safety default

    // Set up shaders if not already done (or simple refresh)
    setShaderInfo();

    // Clear globals from previous run
    points = [];
    
    // Generate the Grammar String and then the Points
    let grammar = createGrammar(type); 
    drawGrammarPoints(grammar, type); 

    // Vertex Buffer
    const vertexAttribDesc = {
        shaderLocation: 0,
        offset: 0,
        format: 'float32x3'
    };
    const vertexBufferLayoutDesc = {
        attributes: [vertexAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3,
        stepMode: 'vertex'
    };
    const vertexBufferDesc = {
        size: points.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myVertexBuffer = device.createBuffer(vertexBufferDesc);
    let writeArray = new Float32Array(myVertexBuffer.getMappedRange());
    writeArray.set(points);
    myVertexBuffer.unmap();

    // Color Buffer
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
    // Safety check for empty colors array
    if (!colors || colors.length === 0) {
        colors = new Array(points.length).fill(1.0); 
    }
    
    const colorBufferDesc = {
        size: colors.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myColorBuffer = device.createBuffer(colorBufferDesc);
    let writeArray2 = new Float32Array(myColorBuffer.getMappedRange());
    writeArray2.set(colors);
    myColorBuffer.unmap();
   
    // Uniforms
    let uniformBindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {}
        }]
    });

    const pipelineLayoutDesc = { bindGroupLayouts: [uniformBindGroupLayout] };
    const layout = device.createPipelineLayout(pipelineLayoutDesc);

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
            frontFace: 'cw',
            cullMode: 'back'
        }
    };

    pipeline = device.createRenderPipeline(pipelineDesc);

    uniformValues = new Float32Array([0,0,0,0]); // [angX, angY, angZ, scale]
    
    uniformBuffer = device.createBuffer({
        size: uniformValues.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer },
        }],
    });

    updateDisplay = true;
}

function draw() {
    colorTexture = context.getCurrentTexture();
    colorTextureView = colorTexture.createView();

    colorAttachment = {
        view: colorTextureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, // Dark grey bg
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

    uniformValues[0] = radians(angles[0]);
    uniformValues[1] = radians(angles[1]);
    uniformValues[2] = radians(angles[2]);
    uniformValues[3] = scale;

    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    commandEncoder = device.createCommandEncoder();
    passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
    passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, myVertexBuffer);
    passEncoder.setVertexBuffer(1, myColorBuffer); 
    passEncoder.draw(points.length / 3);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
}

async function init() {
    canvas = document.querySelector("canvas");
    window.addEventListener('keydown', gotKey, false);

    await initProgram();
    initializeGrammarVars();
    createLSystem('fractal'); // Start with fractal
    draw();
}