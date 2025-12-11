// tessMain.js - WebGPU Rendering Pipeline for 3D Tessellated Trees
// Bennett Chang, Anna Leung
// CSCI-510
// Manages GPU initialization, shape creation, and frame rendering

'use strict';

// WebGPU Context & Resources
let adapter;                // GPU adapter abstraction
let context;                // Canvas WebGPU context
let device;                 // GPU device for command submission
let canvas;                 // HTML canvas element

// Texture Resources
let sandTexture;            // Sand texture for ground (loaded from sand.jpg)
let coralTexture;           // Coral texture for vegetation (loaded from coral.jpg)

// Shader & Pipeline Resources
let code;                   // Shader source code from HTML
let shaderDesc;             // Shader module descriptor
let shaderModule;           // Compiled shader module
let colorState;             // Canvas color format configuration
let pipeline;               // Main rendering pipeline
let skyPipeline;            // Background sky gradient pipeline

// Buffer Objects
let myVertexBuffer = null;  // Position data (float32x3)
let myBaryBuffer = null;    // Barycentric coords for wireframe (float32x3)
let myUvBuffer = null;      // Texture UV coordinates (float32x2)
let myIndexBuffer = null;   // Triangle index list (uint16)
let uniformBuffer;          // Shader uniform data (rotation, color, camera)

// Render State
let colorTexture;           // Current frame color texture
let colorTextureView;       // View into color texture
let colorAttachment;        // Color render target descriptor
let depthTexture;           // Depth buffer for occlusion
let renderPassDesc;         // Render pass configuration
let commandEncoder;         // GPU command recorder
let passEncoder;            // Render pass command encoder
let uniformValues;          // Float32Array for uniform updates
let uniformBindGroup;       // GPU resource bindings (textures, sampler, uniforms)

// Geometry Data (Populated by cgIShape functions)
let points;                 // Vertex positions (x,y,z per vertex)
let bary;                   // Barycentric coordinates (u,v,w per vertex)
let uvs;                    // Texture coordinates (u,v per vertex)
let indices;                // Triangle index list

// Tessellation Parameters
var division1 = 3;          // Primary subdivision for branch geometry
var division2 = 1;          // Secondary subdivision level

// Rotation & Camera
var angles = [0.0, 0.0, 0.0, 0.0];     // Rotation angles: [rotX, rotY, rotZ, unused]
var anglesReset = [0.0, 0.0, 0.0, 0.0]; // Reset rotation values
var angleInc = 5.0;         // Rotation increment per keystroke (degrees)
var camX = 0.0;             // Camera horizontal pan offset
var camY = 0.0;             // Camera vertical pan offset

// Shape Management
var TREE = 1;               // Shape type constant
var curShape = TREE;        // Currently active shape
var updateDisplay = true;   // Flag to trigger redraw

// Coral Color Palette
let coralMode = 0;          // Current color palette index
const CORAL_BASE_COLORS = [
    [1.0, 0.2, 0.2, 1.0],  // red
    [0.2, 1.0, 0.2, 1.0],  // green
    [0.2, 0.4, 1.0, 1.0],  // blue
    [0.2, 1.0, 1.0, 1.0],  // cyan
    [1.0, 0.4, 0.7, 1.0],  // pink
];


// -- Shader Setup --
// Compiles WGSL shader and initializes depth texture

/**
 * Retrieves shader code from HTML and creates GPU shader module with depth buffer.
 */
function setShaderInfo() {
    // Extract shader source from HTML <script> tag
    code = document.getElementById('shader').innerText;
    shaderDesc = { code: code };
    shaderModule = device.createShaderModule(shaderDesc);
    
    // Canvas color format (BGRA for WebGPU)
    colorState = {
        format: 'bgra8unorm'
    };

    // Create depth texture for occlusion testing (prevents Z-fighting artifacts)
    depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
}


// -- GPU Initialization --
// Requests WebGPU adapter and device, configures canvas

/**
 * Initializes WebGPU context: adapter → device → canvas configuration.
 * Called once at startup.
 */
async function initProgram() {
    // Check WebGPU support
    if (!navigator.gpu) {
        console.error("WebGPU not supported on this browser.");
        return;
    }
    
    // Request GPU adapter (hardware abstraction)
    adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("No appropriate GPUAdapter found.");
        return;
    }
    
    // Request GPU device (logical interface to GPU)
    device = await adapter.requestDevice();
    if (!device) {
        console.error("Failed to request Device.");
        return;
    }
    
    // Configure canvas for WebGPU rendering
    context = canvas.getContext('webgpu');
    const canvasConfig = {
        device: device,
        format: navigator.gpu.getPreferredCanvasFormat(),  // Auto-select optimal format
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        alphaMode: 'opaque'
    };
    context.configure(canvasConfig);
}

// -- Geometry & Pipeline Setup --
// Creates mesh data and configures GPU pipeline for rendering

/**
 * Main setup function: generates geometry, creates buffers, and configures render pipeline.
 * Called when shape parameters change (tessellation levels, shape type).
 */
function createNewShape() {
    console.log("inside create new shape: " + curShape);
    setShaderInfo();
    
    // Clear geometry arrays for new shape
    points = []; indices = []; bary = []; uvs = [];

    // Generate geometry based on active shape type
    if (curShape == TREE) {
        // Create sand ground platform
        makeGroundBox(4.0, -1.75);
        // Create three trees with different rotations and positions
        makeStochasticTree(division1, 0.0, 0.0, 0.0, 0);      // Center tree
        makeStochasticTree(division1, -1.5, -0.5, 90.0, 1);   // Left tree
        makeStochasticTree(division1, 1.5, 0.5, 180.0, 2);    // Right tree
    }
    else console.error(`Bad object type`);

    // *** GPU Buffer Creation ***
    
    // Vertex Position Buffer (3 floats per vertex: x, y, z)
    const vertexAttribDesc = { shaderLocation: 0, offset: 0, format: 'float32x3' };
    const vertexBufferLayoutDesc = { attributes: [vertexAttribDesc], arrayStride: 12, stepMode: 'vertex' };
    const vertexBufferDesc = { size: points.length * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, mappedAtCreation: true };
    myVertexBuffer = device.createBuffer(vertexBufferDesc);
    new Float32Array(myVertexBuffer.getMappedRange()).set(points);
    myVertexBuffer.unmap();

    // Barycentric Coordinate Buffer (3 floats per vertex: for wireframe edge detection)
    const baryAttribDesc = { shaderLocation: 1, offset: 0, format: 'float32x3' };
    const myBaryBufferLayoutDesc = { attributes: [baryAttribDesc], arrayStride: 12, stepMode: 'vertex' };
    const myBaryBufferDesc = { size: bary.length * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, mappedAtCreation: true };
    myBaryBuffer = device.createBuffer(myBaryBufferDesc);
    new Float32Array(myBaryBuffer.getMappedRange()).set(bary);
    myBaryBuffer.unmap();

    // Texture Coordinate Buffer (2 floats per vertex: u, v)
    const uvAttribDesc = { shaderLocation: 2, offset: 0, format: 'float32x2' };
    const myUvBufferLayoutDesc = { attributes: [uvAttribDesc], arrayStride: 8, stepMode: 'vertex' };
    const myUvBufferDesc = { size: uvs.length * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, mappedAtCreation: true };
    myUvBuffer = device.createBuffer(myUvBufferDesc);
    new Float32Array(myUvBuffer.getMappedRange()).set(uvs);
    myUvBuffer.unmap();

    // Index Buffer (triangle indices for indexed drawing)
    if (indices.length % 2 != 0) indices.push(indices[indices.length-1]);  // Pad odd indices
    const myIndexBufferDesc = { size: indices.length * 2, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, mappedAtCreation: true };
    myIndexBuffer = device.createBuffer(myIndexBufferDesc);
    new Uint16Array(myIndexBuffer.getMappedRange()).set(indices);
    myIndexBuffer.unmap();

    // *** Pipeline Configuration ***
    
    // Define GPU resource bindings (uniforms, sampler, textures)
    let uniformBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },           // Uniforms
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },               // Sampler
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },              // Sand texture
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }               // Coral texture
        ]
    });

    const pipelineLayoutDesc = { bindGroupLayouts: [uniformBindGroupLayout] };
    const layout = device.createPipelineLayout(pipelineLayoutDesc);

    // Main render pipeline: vertex → fragment with depth testing
    const pipelineDesc = {
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [vertexBufferLayoutDesc, myBaryBufferLayoutDesc, myUvBufferLayoutDesc]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [colorState]
        },
        depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
        primitive: { topology: 'triangle-list', frontFace: 'cw', cullMode: 'none' }
    };

    pipeline = device.createRenderPipeline(pipelineDesc);

    // Sky Pipeline: fullscreen background gradient (rendered before main objects)
    const skyShaderCode = `
    @vertex
    fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
        let pos = array<vec2f, 6>(vec2f(-1, -1), vec2f( 1, -1), vec2f(-1,  1), vec2f(-1,  1), vec2f( 1, -1), vec2f( 1,  1));
        return vec4f(pos[i], 0.999, 1.0);
    }
    @fragment
    fn fs(@builtin(position) p: vec4<f32>) -> @location(0) vec4<f32> {
        let t = clamp(p.y / 800.0, 0.0, 1.0);
        return vec4f(mix(vec3f(0.6, 0.8, 1.0), vec3f(0.1, 0.2, 0.5), t), 1.0);
    }
    `;
    const skyModule = device.createShaderModule({ code: skyShaderCode });
    skyPipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: skyModule, entryPoint: "vs" },
        fragment: { module: skyModule, entryPoint: "fs", targets: [colorState] },
        primitive: { topology: "triangle-list" },
        depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' }
    });

    // *** Uniform & Bind Group Setup ***
    
    // Create uniform buffer for shader parameters (rotation angles, colors, camera offsets)
    uniformValues = new Float32Array(12);
    uniformBuffer = device.createBuffer({ size: uniformValues.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    // Create linear texture sampler (repeating mode for seamless tiling)
    const sampler = device.createSampler({
        magFilter: 'linear', minFilter: 'linear',
        addressModeU: 'repeat', addressModeV: 'repeat',
    });

    // Bind GPU resources to pipeline
    uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer }},
            { binding: 1, resource: sampler },
            { binding: 2, resource: sandTexture.createView() },
            { binding: 3, resource: coralTexture.createView() }
        ],
    });

    updateDisplay = true;
}

// -- Texture Loading --
// Asynchronously loads image files and creates GPU texture objects

/**
 * Fetches image file, decodes to bitmap, and uploads to GPU texture.
 * @param {string} url - Path to image file (e.g., './sand.jpg')
 * @returns {GPUTexture} GPU texture ready for shader sampling
 */
async function loadTexture(url) {
    // Fetch and decode image from URL
    const res = await fetch(url);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
    
    // Create GPU texture resource
    const texture = device.createTexture({
        size: [bitmap.width, bitmap.height, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    // Copy image data to GPU texture
    device.queue.copyExternalImageToTexture({ source: bitmap }, { texture: texture }, { width: bitmap.width, height: bitmap.height });
    return texture;
}

// -- Rendering --
// Records GPU commands for current frame and submits to device

/**
 * Main render function: updates uniforms, records render commands, and submits to GPU.
 * Called once per frame (typically 60 FPS).
 */
function draw() {
    // Acquire current frame's color texture
    colorTexture = context.getCurrentTexture();
    colorTextureView = colorTexture.createView();
    
    // Configure color and depth attachment targets
    colorAttachment = { view: colorTextureView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1 }, loadOp: 'clear', storeOp: 'store' };
    renderPassDesc = { colorAttachments: [colorAttachment], depthStencilAttachment: { view: depthTexture.createView(), depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }};

    // Update uniform buffer with current state
    uniformValues[0] = radians(angles[0]);        // Rotation X
    uniformValues[1] = radians(angles[1]);        // Rotation Y
    uniformValues[2] = radians(angles[2]);        // Rotation Z
    uniformValues[3] = 0.0;                       // Unused
    uniformValues.set(CORAL_BASE_COLORS[coralMode], 4);  // Coral color (indices 4-7)
    uniformValues[8] = camX;                      // Camera X offset
    uniformValues[9] = camY;                      // Camera Y offset

    // Submit uniform data to GPU
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
    
    // Record rendering commands
    commandEncoder = device.createCommandEncoder();
    passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
    passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
    
    // Render sky background first (at depth 0.999)
    passEncoder.setPipeline(skyPipeline);
    passEncoder.draw(6);
    
    // Render main geometry (trees and ground) on top of sky
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, myVertexBuffer);
    passEncoder.setVertexBuffer(1, myBaryBuffer);
    passEncoder.setVertexBuffer(2, myUvBuffer); 
    passEncoder.setIndexBuffer(myIndexBuffer, "uint16");
    passEncoder.drawIndexed(indices.length, 1);
    passEncoder.end();

    // Submit command buffer to GPU execution queue
    device.queue.submit([commandEncoder.finish()]);
}

// -- Initialization --
// Startup sequence: GPU setup, texture loading, geometry creation, first frame

/**
 * Main initialization function called on page load.
 * Sets up WebGPU, loads textures, creates geometry, and renders first frame.
 */
async function init() {
    // Get canvas element and attach keyboard event listener
    canvas = document.querySelector("canvas");
    window.addEventListener('keydown', gotKey, false);

    // Initialize GPU context
    await initProgram();
    
    // Load texture images from files
    sandTexture = await loadTexture('./sand.jpg');      // Ground texture
    coralTexture = await loadTexture('./coral.jpg');    // Vegetation texture

    // Create initial geometry and render pipeline
    createNewShape();
    
    // Render first frame
    draw();
}