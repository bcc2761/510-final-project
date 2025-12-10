// cgIShape.js - 3D Tree Edition
// Bennett Chang, Anna Leung
// CSCI-510

// Global variables for L-System
let rules = {};
let angleToUse = 22.5;
let initial_length = 0.5;
let storedGrammar = null;
let growthIterations = 3;


//
// 1. Helper: Vector Math (Needed to orient cylinders in 3D space)
//
function sub(v1, v2) { return [v1[0]-v2[0], v1[1]-v2[1], v1[2]-v2[2]]; }
function normalize(v) {
    let len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    if(len === 0) return [0,0,0];
    return [v[0]/len, v[1]/len, v[2]/len];
}
function cross(a, b) {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
    ];
}
function add(v1, v2) { return [v1[0]+v2[0], v1[1]+v2[1], v1[2]+v2[2]]; }
function scaleVec(v, s) { return [v[0]*s, v[1]*s, v[2]*s]; }

//
// 2. Stochastic Grammar Generator
//
function runLSystem(iterations, startString) {
    let grammarArray = startString.split('');
    let doubleBuffer = [];

    // Define Stochastic Rules
    rules = {
    'F': [
        { prob: 0.25, res: "F[+F][-F]" },
        { prob: 0.25, res: "F[+F]" },
        { prob: 0.25, res: "F[-F]" },
        { prob: 0.25, res: "[+F][-F]" }
    ]
    };


    for (let i = 0; i < iterations; i++) {
        for (let j = 0; j < grammarArray.length; j++) {
            let char = grammarArray[j];
            let rule = rules[char];

            if (rule && Array.isArray(rule)) {
                let rand = Math.random();
                let cumulative = 0.0;
                let selected = rule[rule.length - 1].res;
                for (let k = 0; k < rule.length; k++) {
                    cumulative += rule[k].prob;
                    if (rand <= cumulative) {
                        selected = rule[k].res;
                        break;
                    }
                }
                doubleBuffer = doubleBuffer.concat(selected.split(''));
            } else {
                doubleBuffer.push(char);
            }
        }
        grammarArray = [...doubleBuffer];
        doubleBuffer = [];
    }
    return grammarArray;
}

//
// 3. Draw Branch (Connects Point A to Point B with a Cylinder Mesh)
//
function makeBranchSegment(p1, p2, radius, radialDivs) {
    let axis = sub(p2, p1);
    let len = Math.sqrt(axis[0]*axis[0] + axis[1]*axis[1] + axis[2]*axis[2]);
    let dir = normalize(axis);

    // Find an arbitrary vector not parallel to direction to compute Right/Up
    let aux = [0, 1, 0];
    if (Math.abs(dir[1]) > 0.9) aux = [1, 0, 0]; // If dir is vertical, use X as aux

    let right = normalize(cross(dir, aux));
    let up = normalize(cross(right, dir));

    let angleStep = (2 * Math.PI) / radialDivs;

    for (let i = 0; i < radialDivs; i++) {
        let theta = i * angleStep;
        let thetaNext = (i + 1) * angleStep;

        // Calculate ring vertices at P1 (Base)
        let c1 = Math.cos(theta);
        let s1 = Math.sin(theta);
        let c2 = Math.cos(thetaNext);
        let s2 = Math.sin(thetaNext);

        // Compute offsets based on the local frame (Right and Up vectors)
        let r1 = add(scaleVec(right, c1 * radius), scaleVec(up, s1 * radius));
        let r2 = add(scaleVec(right, c2 * radius), scaleVec(up, s2 * radius));

        // 4 Vertices for the quad
        let v0 = add(p1, r1); // Base Left
        let v1 = add(p1, r2); // Base Right
        let v2 = add(p2, r1); // Top Left
        let v3 = add(p2, r2); // Top Right

        // Add 2 triangles to form the side of the branch
        addTriangle(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
        addTriangle(v1[0], v1[1], v1[2], v3[0], v3[1], v3[2], v2[0], v2[1], v2[2]);
    }
}

function generateNewTree() {
    let startString = "F";
    storedGrammar = runLSystem(growthIterations, startString);
}

//
// 4. Main Tree Function (Called by tessMain)
//
function makeStochasticTree(subdivisions) {
    // // A. Generate Grammar
    // 1. Check if we have a cached grammar. If not, make one.
    if (!storedGrammar) {
        generateNewTree();
    }
    
    // 2. Use the cached grammar instead of generating a new one
    let grammar = storedGrammar;

    // B. Turtle State (3D)
    // Start slightly lower as requested previously
    let x = 0.0, y = -1.0, z = 0.0; 
    let angleX = 0, angleY = 0, angleZ = 0; 
    let step = 0.2;
    let radius = 0.03;
    let stack = [];
    
    // Direction tracking is hard in 3D without matrices, 
    // so we will simulate 2D-ish branching rotated in 3D space.
    // For a robust 3D tree, we usually use quaternions, but let's stick to 
    // simple trigonometry for this assignment level.
    
    let currentDir = [0, 1, 0]; // Start pointing UP

    // Helper to rotate vector around Z axis
    function rotateZ(v, ang) {
        let rad = radians(ang);
        let c = Math.cos(rad), s = Math.sin(rad);
        return [v[0]*c - v[1]*s, v[0]*s + v[1]*c, v[2]];
    }
    // Helper to rotate vector around X axis
    function rotateX(v, ang) {
        let rad = radians(ang);
        let c = Math.cos(rad), s = Math.sin(rad);
        return [v[0], v[1]*c - v[2]*s, v[1]*s + v[2]*c];
    }
    // Helper to rotate vector around Y axis
    function rotateY(v, ang) {
        let rad = radians(ang);
        let c = Math.cos(rad), s = Math.sin(rad);
        return [v[0]*c + v[2]*s, v[1], -v[0]*s + v[2]*c];
    }

    for (let i = 0; i < grammar.length; i++) {
        let cmd = grammar[i];
        
        // Calculate current forward vector based on accumulated angles
        let dir = [0, 1, 0]; // Start Up
        dir = rotateZ(dir, angleZ);
        dir = rotateX(dir, angleX);
        dir = rotateY(dir, angleY);
        
        switch (cmd) {
            case 'F':
                let endX = x + dir[0] * step;
                let endY = y + dir[1] * step;
                let endZ = z + dir[2] * step;

                // Draw the 3D Branch connecting Start to End
                makeBranchSegment([x,y,z], [endX, endY, endZ], radius, subdivisions);
                
                x = endX; y = endY; z = endZ;
                break;
            case '+': angleZ += angleToUse; break; // Yaw
            case '-': angleZ -= angleToUse; break;
            case '&': angleX += angleToUse; break; // Pitch (if you want 3D)
            case '^': angleX -= angleToUse; break;
            case '[': 
                stack.push({x, y, z, angleX, angleY, angleZ});
                step *= 0.9; // Branches get shorter
                radius *= 0.8; // Branches get thinner
                break;
            case ']': 
                let s = stack.pop();
                x = s.x; y = s.y; z = s.z;
                angleX = s.angleX; angleY = s.angleY; angleZ = s.angleZ;
                step /= 0.9;
                radius /= 0.8;
                break;
        }
    }
}
function makeGroundPlane(size = 2.0, y = -1.0) {
    const half = size / 2;

    addTriangle(-half, y, -half,  half, y, -half, -half, y,  half);
    addTriangle( half, y, -half,  half, y,  half, -half, y,  half);
}

// function makeCube(subdivisions) {
//     const halfSize = 0.25; // Half the length of the cube's side
//     const start = -halfSize; // Starting coordinate
//     const stepSize = (halfSize * 2) / subdivisions; // Size of each subdivision
//     let x0, y0, z0, x1, y1, z1; // Temporary variables for coordinates

//     for (let i = 0; i < subdivisions; i++) { // Loop through each subdivision in one direction
//         for (let j = 0; j < subdivisions; j++) {
//             // top (+Y)
//             x0 = start + i * stepSize;
//             x1 = start + (i + 1) * stepSize;
//             y1 = halfSize;
//             z0 = start + j * stepSize;
//             z1 = start + (j + 1) * stepSize;
//             addTriangle(x0, y1, z0, x0, y1, z1, x1, y1, z0); // first triangle
//             addTriangle(x1, y1, z0, x0, y1, z1, x1, y1, z1); // second triangle

//             // bottom (-Y)
//             y0 = -halfSize; // y-coordinate for bottom face
//             addTriangle(x0, y0, z0, x1, y0, z0, x0, y0, z1); // first triangle
//             addTriangle(x1, y0, z0, x1, y0, z1, x0, y0, z1); // second triangle

//             // front (+Z)
//             x0 = start + i * stepSize; // x-coordinate for front face
//             x1 = start + (i + 1) * stepSize; // next x-coordinate
//             y0 = start + j * stepSize; // y-coordinate
//             y1 = start + (j + 1) * stepSize; // next y-coordinate
//             z1 = halfSize; // z-coordinate for front face
//             addTriangle(x0, y0, z1, x1, y0, z1, x0, y1, z1); // first triangle
//             addTriangle(x1, y0, z1, x1, y1, z1, x0, y1, z1); // second triangle

//             // back (-Z)
//             z0 = -halfSize;
//             addTriangle(x0, y0, z0, x0, y1, z0, x1, y0, z0); // first triangle
//             addTriangle(x1, y0, z0, x0, y1, z0, x1, y1, z0); // second triangle

//             // left (-X)
//             x0 = -halfSize; // x-coordinate for left face
//             y0 = start + i * stepSize; // y-coordinate
//             y1 = start + (i + 1) * stepSize; // next y-coordinate
//             z0 = start + j * stepSize; // z-coordinate
//             z1 = start + (j + 1) * stepSize; // next z-coordinate
//             addTriangle(x0, y0, z0, x0, y0, z1, x0, y1, z0); // first triangle
//             addTriangle(x0, y1, z0, x0, y0, z1, x0, y1, z1); // second triangle

//             // right (+X)
//             x1 = halfSize; // x-coordinate for right face
//             addTriangle(x1, y0, z0, x1, y1, z0, x1, y0, z1); // first triangle
//             addTriangle(x1, y1, z0, x1, y1, z1, x1, y0, z1); // second triangle
//         }
//     }
// }

// //
// // fill in code that creates the triangles for a cylinder with diameter 0.5
// // and height of 0.5 (centered at the origin) with the number of subdivisions
// // around the base and top of the cylinder (given by radialdivision) and
// // the number of subdivisions along the surface of the cylinder given by
// //heightdivision.
// //
// function makeCylinder(radialdivision, heightdivision) {
//     const radius = 0.25; // Radius of the cylinder
//     const height = 0.5; // Height of the cylinder
//     const y_base = -0.25; // Y-coordinate of the base
//     const y_top = 0.25; // Y-coordinate of the top

//     const angle_step = (2 * Math.PI) / radialdivision; // Angle between each division
//     const height_step = height / heightdivision; // Height of each division

//     for (let i = 0; i < radialdivision; i++) { // Loop through each radial division
//         let angle1 = i * angle_step;
//         let angle2 = (i + 1) * angle_step;

//         let x1 = radius * Math.cos(angle1); // X-coordinate for first angle
//         let z1 = radius * Math.sin(angle1); // Z-coordinate for first angle
//         let x2 = radius * Math.cos(angle2); // X-coordinate for second angle
//         let z2 = radius * Math.sin(angle2); // Z-coordinate for second angle

//         // Top Cap
//         addTriangle(0, y_top, 0, x2, y_top, z2, x1, y_top, z1);

//         // Bottom Cap
//         addTriangle(0, y_base, 0, x1, y_base, z1, x2, y_base, z2);

//         // Side
//         for (let j = 0; j < heightdivision; j++) {
//             let y1 = y_base + j * height_step;
//             let y2 = y_base + (j + 1) * height_step;

//             addTriangle(x1, y1, z1, x1, y2, z1, x2, y2, z2);
//             addTriangle(x1, y1, z1, x2, y2, z2, x2, y1, z2);
//         }
//     }
// }

// //
// // fill in code that creates the triangles for a cone with diameter 0.5
// // and height of 0.5 (centered at the origin) with the number of
// // subdivisions around the base of the cone (given by radialdivision)
// // and the number of subdivisions along the surface of the cone
// //given by heightdivision.
// //
// function makeCone(radialdivision, heightdivision) {
//     const radius = 0.25; // Radius of the base of the cone
//     const height = 0.5; // Height of the cone
//     const y_base = -0.25; // Y-coordinate of the base
//     const y_tip = 0.25; // Y-coordinate of the tip

//     const angle_step = (2 * Math.PI) / radialdivision; // Angle between each division
//     const height_step = height / heightdivision; // Height of each division

//     for (let i = 0; i < radialdivision; i++) { // Loop through each radial division
//         let angle1 = i * angle_step;
//         let angle2 = (i + 1) * angle_step;

//         // Base vertices
//         let x_base1 = radius * Math.cos(angle1); // X-coordinate for first base vertex
//         let z_base1 = radius * Math.sin(angle1); // Z-coordinate for first base vertex
//         let x_base2 = radius * Math.cos(angle2); // X-coordinate for second base vertex
//         let z_base2 = radius * Math.sin(angle2); // Z-coordinate for second base vertex

//         // Bottom Cap
//         addTriangle(0, y_base, 0, x_base1, y_base, z_base1, x_base2, y_base, z_base2);

//         // Side
//         for (let j = 0; j < heightdivision; j++) {
//             let y1 = y_base + j * height_step;
//             let y2 = y_base + (j + 1) * height_step;

//             // Radius at y1 and y2
//             let r1 = radius * (y_tip - y1) / height;
//             let r2 = radius * (y_tip - y2) / height;

//             // Vertices for the quad on the side
//             let p1x = r1 * Math.cos(angle1);
//             let p1z = r1 * Math.sin(angle1);
//             let p2x = r1 * Math.cos(angle2);
//             let p2z = r1 * Math.sin(angle2);
//             let p3x = r2 * Math.cos(angle1);
//             let p3z = r2 * Math.sin(angle1);
//             let p4x = r2 * Math.cos(angle2);
//             let p4z = r2 * Math.sin(angle2);

//             addTriangle(p1x, y1, p1z, p3x, y2, p3z, p4x, y2, p4z);
//             addTriangle(p1x, y1, p1z, p4x, y2, p4z, p2x, y1, p2z);
//         }
//     }
// }


// Standard helpers
function radians(degrees) { return degrees * (Math.PI/180); }

function addTriangle(x0,y0,z0,x1,y1,z1,x2,y2,z2) {
    let nverts = points.length / 3;
    
    points.push(x0); bary.push (1.0); points.push(y0); bary.push (0.0); points.push(z0); bary.push (0.0);
    indices.push(nverts); nverts++;
    
    points.push(x1); bary.push (0.0); points.push(y1); bary.push (1.0); points.push(z1); bary.push (0.0);
    indices.push(nverts); nverts++;
    
    points.push(x2); bary.push (0.0); points.push(y2); bary.push (0.0); points.push(z2); bary.push (1.0);
    indices.push(nverts); nverts++;
}