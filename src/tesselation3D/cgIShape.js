// cgIShape.js - 3D Procedural Coral Generation using Stochastic L-Systems
// Bennett Chang, Anna Leung
// CSCI-510
// Generates trees with stochastic branching patterns and creates tessellated geometry for rendering

// L-System global configuration
let rules = {};                  // Grammar transformation rules for tree growth
let angleToUse = 22.5;           // Rotation increment for branch turns (degrees)
let initial_length = 0.5;        // Initial branch length (unused, kept for reference)
let growthIterations = 3;        // Number of L-System iterations to apply

// Cache L-System strings per tree to avoid recalculation (key: treeIndex, value: [gen0, gen1, gen2, ...])
let treeHistories = []; 

// -- Vector Math Utilities --
// Essential 3D vector operations for tree geometry construction

// Vector subtraction: v1 - v2
function sub(v1, v2) { return [v1[0]-v2[0], v1[1]-v2[1], v1[2]-v2[2]]; }

// Vector normalization to unit length (or [0,0,0] if zero vector)
function normalize(v) {
    let len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    if(len === 0) return [0,0,0];
    return [v[0]/len, v[1]/len, v[2]/len];
}

// Vector cross product: a × b (perpendicular vector)
function cross(a, b) {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
    ];
}

// Vector addition: v1 + v2
function add(v1, v2) { return [v1[0]+v2[0], v1[1]+v2[1], v1[2]+v2[2]]; }

// Vector scaling: v * scalar
function scaleVec(v, s) { return [v[0]*s, v[1]*s, v[2]*s]; }

// -- Stochastic L-System Grammar Generation --
// Generates tree structure by iteratively applying stochastic branching rules

/**
 * Applies one iteration of L-System grammar transformation with stochastic rules.
 * Each 'F' (forward) has 6 equally-likely alternatives for natural variation.
 * @param {string} startString - Current L-System state (e.g., "F" or "FF[+F]")
 * @returns {string} Next iteration after applying transformation rules
 */
function iterateGrammar(startString) {
    let grammarArray = startString.split('');
    let nextGrammar = [];

    // Define Stochastic Branching Rules: each has 20% probability
    // Symbols: F=forward, [=push, ]=pop, +=yaw, -=yaw, &=pitch, ^=pitch, <=roll, >=roll
    rules = {
        'F': [
            { prob: 0.15, res: "F[+F][-F]" },      // Left/right branching
            { prob: 0.15, res: "F[&F][^F]" },      // Front/back branching
            { prob: 0.15, res: "F[+&F][-^F]" },    // Combined XY branching
            { prob: 0.15, res: "[+F][-F][&F][^F]" }, // Quad branching
            { prob: 0.20, res: "F[&+F]" },         // Front-left branching
            { prob: 0.20, res: "F[<+F][>&F]" }     // Roll-based branching
        ]
    };

    // Apply transformation to each character
    for (let j = 0; j < grammarArray.length; j++) {
        let char = grammarArray[j];
        let rule = rules[char];

        if (rule && Array.isArray(rule)) {
            // Stochastic selection: pick one outcome based on cumulative probability
            let rand = Math.random();
            let cumulative = 0.0;
            let selected = rule[rule.length - 1].res;  // Default to last rule
            for (let k = 0; k < rule.length; k++) {
                cumulative += rule[k].prob;
                if (rand <= cumulative) {
                    selected = rule[k].res;
                    break;
                }
            }
            nextGrammar = nextGrammar.concat(selected.split(''));
        } else {
            // Non-transformable characters pass through unchanged
            nextGrammar.push(char);
        }
    }
    return nextGrammar.join('');
}

// Clear all cached L-System histories when generating a new tree
function generateNewTree() {
    treeHistories = []; 
}

// Extend L-System cache to match current growth iteration level
function updateTreeDepth() {
    for (let i = 0; i < treeHistories.length; i++) {
        if (treeHistories[i]) {
            // Generate missing iterations up to growthIterations
            while (treeHistories[i].length <= growthIterations) {
                let current = treeHistories[i][treeHistories[i].length - 1];
                treeHistories[i].push(iterateGrammar(current));
            }
        }
    }
}

// -- Branch Geometry Generation --
// Creates cylindrical mesh for tree branches with texture coordinates

/**
 * Creates a cylindrical branch segment between two points with UV texture mapping.
 * Builds two triangles per radial division to form a complete cylinder.
 * @param {Array} p1 - Start point [x, y, z]
 * @param {Array} p2 - End point [x, y, z]
 * @param {number} radius - Cylinder radius
 * @param {number} radialDivs - Number of radial subdivisions (e.g., 8 for octagon)
 */
function makeBranchSegment(p1, p2, radius, radialDivs) {
    // Calculate branch direction vector
    let axis = sub(p2, p1);
    let dir = normalize(axis);

    // Find perpendicular vector (avoid collinear case)
    let aux = [0, 1, 0];
    if (Math.abs(dir[1]) > 0.9) aux = [1, 0, 0];  // Use X-axis if Y-direction is vertical

    // Construct orthonormal basis (right, up, dir)
    let right = normalize(cross(dir, aux));
    let up = normalize(cross(right, dir));

    // Angular step between adjacent radii
    let angleStep = (2 * Math.PI) / radialDivs;

    // Create cylinder by connecting radial vertices at top and bottom
    for (let i = 0; i < radialDivs; i++) {
        // Current and next angular positions around cylinder
        let theta = i * angleStep;
        let thetaNext = (i + 1) * angleStep;

        let c1 = Math.cos(theta);
        let s1 = Math.sin(theta);
        let c2 = Math.cos(thetaNext);
        let s2 = Math.sin(thetaNext);

        // Offset points from branch axis at current and next angles
        let r1 = add(scaleVec(right, c1 * radius), scaleVec(up, s1 * radius));
        let r2 = add(scaleVec(right, c2 * radius), scaleVec(up, s2 * radius));

        // Four vertices of the quadrilateral: v0,v1 at start; v2,v3 at end
        let v0 = add(p1, r1); 
        let v1 = add(p1, r2); 
        let v2 = add(p2, r1); 
        let v3 = add(p2, r2);

        // UV coordinates for texture wrapping
        // U (0→1): wraps around cylinder circumference
        // V (0→1): runs along branch length
        let u1 = i / radialDivs;
        let u2 = (i + 1) / radialDivs;

        // First triangle: v0-v1-v2 (top edge, diagonal)
        addTriangle(
            v0[0], v0[1], v0[2], u1, 0.0,
            v1[0], v1[1], v1[2], u2, 0.0,
            v2[0], v2[1], v2[2], u1, 1.0
        );

        // Second triangle: v1-v3-v2 (completes quad)
        addTriangle(
            v1[0], v1[1], v1[2], u2, 0.0,
            v3[0], v3[1], v3[2], u2, 1.0,
            v2[0], v2[1], v2[2], u1, 1.0
        );
    }
}

// -- Main Tree Rendering Function --
// Interprets L-System grammar as turtle graphics commands to build tree

/**
 * Generates and renders a procedural tree using L-System interpretation.
 * Uses turtle graphics: position, angles, and stack for branch branching.
 * @param {number} subdivisions - Radial divisions for branch geometry (e.g., 8)
 * @param {number} offsetX - X-axis world position offset
 * @param {number} offsetZ - Z-axis world position offset
 * @param {number} startRotY - Initial Y-axis rotation (radians)
 * @param {number} treeIndex - Cache index for this tree's L-System history
 */
function makeStochasticTree(subdivisions, offsetX, offsetZ, startRotY, treeIndex) {
    // Initialize or retrieve cached L-System string history
    if (!treeHistories[treeIndex]) {
        treeHistories[treeIndex] = ["F"];  // Start with single forward command
    }

    // Generate iterations up to current growth level
    while (treeHistories[treeIndex].length <= growthIterations) {
        let last = treeHistories[treeIndex][treeHistories[treeIndex].length - 1];
        treeHistories[treeIndex].push(iterateGrammar(last));
    }

    // Get the fully-grown grammar string for current iteration level
    let grammar = treeHistories[treeIndex][growthIterations].split('');

    // Turtle graphics state: position
    let x = offsetX, y = -1.75, z = offsetZ; 
    // Turtle graphics state: rotation angles (radians)
    let angleX = 0, angleY = startRotY, angleZ = 0; 
    
    // Branch parameters that decrease with each branching level
    let step = 0.2;       // Forward movement distance
    let radius = 0.03;    // Branch thickness
    let stack = [];       // Push/pop stack for branching
    
    // Rotation helpers for turtle direction transformations
    // Rotate around Z axis (yaw/heading)
    function rotateZ(v, ang) {
        let rad = radians(ang);
        let c = Math.cos(rad), s = Math.sin(rad);
        return [v[0]*c - v[1]*s, v[0]*s + v[1]*c, v[2]];
    }
    // Rotate around X axis (pitch/elevation)
    function rotateX(v, ang) {
        let rad = radians(ang);
        let c = Math.cos(rad), s = Math.sin(rad);
        return [v[0], v[1]*c - v[2]*s, v[1]*s + v[2]*c];
    }
    // Rotate around Y axis (roll/tilt)
    function rotateY(v, ang) {
        let rad = radians(ang);
        let c = Math.cos(rad), s = Math.sin(rad);
        return [v[0]*c + v[2]*s, v[1], -v[0]*s + v[2]*c];
    }

    // Interpret L-System grammar as turtle graphics commands
    for (let i = 0; i < grammar.length; i++) {
        let cmd = grammar[i];
        // Compute forward direction in world space by applying all rotations
        let dir = [0, 1, 0];  // Start pointing up
        dir = rotateZ(dir, angleZ);
        dir = rotateX(dir, angleX);
        dir = rotateY(dir, angleY);
        
        switch (cmd) {
            case 'F':  // Draw forward: create branch segment and advance position
                let endX = x + dir[0] * step;
                let endY = y + dir[1] * step;
                let endZ = z + dir[2] * step;
                makeBranchSegment([x,y,z], [endX, endY, endZ], radius, subdivisions);
                x = endX; y = endY; z = endZ;
                break;
            case '+': angleZ += angleToUse; break;  // Yaw left (Z rotation)
            case '-': angleZ -= angleToUse; break;  // Yaw right
            case '&': angleX += angleToUse; break;  // Pitch down (X rotation)
            case '^': angleX -= angleToUse; break;  // Pitch up
            case '<': angleY += angleToUse; break;  // Roll left (Y rotation)
            case '>': angleY -= angleToUse; break;  // Roll right
            case '[':  // Push branch point: save state and decrease branch size
                stack.push({x, y, z, angleX, angleY, angleZ});
                step *= 0.9;     // Shorter segments for child branches
                radius *= 0.8;   // Thinner diameter for child branches
                break;
            case ']':  // Pop branch point: restore saved state and restore size
                let s = stack.pop();
                x = s.x; y = s.y; z = s.z;
                angleX = s.angleX; angleY = s.angleY; angleZ = s.angleZ;
                step /= 0.9;     // Restore parent segment length
                radius /= 0.8;   // Restore parent diameter
                break;
        }
    }
}

// -- Ground Geometry --
// Creates a flat terrain platform for tree placement

/**
 * Builds a 3D box to represent sand/ground with texture coordinates.
 * @param {number} size - Side length of the box base
 * @param {number} yTop - Y-coordinate of top surface
 */
function makeGroundBox(size, yTop) {
    const half = size / 2;          // Half-size for centered box
    const yBot = yTop - 0.3;        // Bottom surface (0.3 units below top)
    const tMax = 2.0;               // Texture coordinate at far edge (for tiling)
    const tHeight = 0.15;           // Texture coordinate for side height

    // Top surface (facing up): two triangles
    addTriangle(-half, yTop, -half, 0.0, 0.0, half, yTop, -half, tMax, 0.0, -half, yTop,  half, 0.0, tMax);
    addTriangle(half, yTop, -half, tMax, 0.0, half, yTop,  half, tMax, tMax, -half, yTop,  half, 0.0, tMax);

    // Bottom surface (facing down): two triangles
    addTriangle(-half, yBot,  half, 0.0, 0.0, half, yBot,  half, tMax, 0.0, -half, yBot, -half, 0.0, tMax);
    addTriangle(half, yBot,  half, tMax, 0.0, half, yBot, -half, tMax, tMax, -half, yBot, -half, 0.0, tMax);

    // East face (x = +half): two triangles
    addTriangle(-half, yTop,  half, 0.0, 0.0, half, yTop,  half, tMax, 0.0, -half, yBot,  half, 0.0, tHeight);
    addTriangle(half, yTop,  half, tMax, 0.0, half, yBot,  half, tMax, tHeight, -half, yBot,  half, 0.0, tHeight);
    
    // West face (x = -half): two triangles
    addTriangle(half, yTop, -half, 0.0, 0.0, -half, yTop, -half, tMax, 0.0, -half, yBot, -half, tMax, tHeight);
    addTriangle(half, yTop, -half, 0.0, 0.0, -half, yBot, -half, tMax, tHeight, half, yBot, -half, 0.0, tHeight);
    
    // North face (z = -half): two triangles
    addTriangle(-half, yTop, -half, 0.0, 0.0, -half, yTop,  half, tMax, 0.0, -half, yBot, -half, 0.0, tHeight);
    addTriangle(-half, yTop,  half, tMax, 0.0, -half, yBot,  half, tMax, tHeight, -half, yBot, -half, 0.0, tHeight);
    
    // South face (z = +half): two triangles
    addTriangle(half, yTop,  half, 0.0, 0.0, half, yTop, -half, tMax, 0.0, half, yBot, -half, tMax, tHeight);
    addTriangle(half, yTop,  half, 0.0, 0.0, half, yBot, -half, tMax, tHeight, half, yBot,  half, 0.0, tHeight);
}

// -- Utility Functions --

// Convert degrees to radians
function radians(degrees) { return degrees * (Math.PI/180); }

/**
 * Adds a triangle to the global geometry arrays with texture and barycentric data.
 * Each vertex gets barycentric coordinates for wireframe edge detection in fragment shader.
 * @param {number} x0,y0,z0 - First vertex position
 * @param {number} u0,v0 - First vertex UV texture coordinates
 * @param {number} x1,y1,z1 - Second vertex position
 * @param {number} u1,v1 - Second vertex UV coordinates
 * @param {number} x2,y2,z2 - Third vertex position
 * @param {number} u2,v2 - Third vertex UV coordinates
 */
function addTriangle(x0,y0,z0,u0,v0,  x1,y1,z1,u1,v1,  x2,y2,z2,u2,v2) {
    let nverts = points.length / 3;  // Current vertex count
    // Add first vertex with barycentric coords (1,0,0)
    points.push(x0, y0, z0); bary.push(1.0, 0.0, 0.0); uvs.push(u0, v0); indices.push(nverts); nverts++;
    // Add second vertex with barycentric coords (0,1,0)
    points.push(x1, y1, z1); bary.push(0.0, 1.0, 0.0); uvs.push(u1, v1); indices.push(nverts); nverts++;
    // Add third vertex with barycentric coords (0,0,1)
    points.push(x2, y2, z2); bary.push(0.0, 0.0, 1.0); uvs.push(u2, v2); indices.push(nverts); nverts++;
}