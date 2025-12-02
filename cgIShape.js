// cgIShape.js
// Bennett Chang
// CSCI-510

'use strict';

let initial_length,
    angleToUse,
    rules,
    colors; // Linked to the global colors array in lsystemMain.js

var iterations = 4;
var iterations2 = 4; // Default for Sierpinski

//
// Initialize grammar variables (called by main)
//
function initializeGrammarVars() {
    initial_length = 0.05;
    angleToUse = 25.0;
    iterations = 4;
    rules = {};
}

//
// Core L-System String Generator
// Handles both Deterministic (String) and Stochastic (Array) rules
//
function run(iterations, startString) {
    let grammarArray = startString.split('');
    let doubleBuffer = [];

    console.log("Generating with iterations: " + iterations);

    for (let i = 0; i < iterations; i++) {
        for (let j = 0; j < grammarArray.length; j++) {
            let char = grammarArray[j];
            let rule = rules[char];

            if (rule) {
                // Stochastic Rule Check (Is it an array?)
                if (Array.isArray(rule)) {
                    let rand = Math.random(); // 0.0 to 1.0
                    let cumulative = 0.0;
                    let selected = rule[rule.length - 1].res; // Default fallback

                    for (let k = 0; k < rule.length; k++) {
                        cumulative += rule[k].prob;
                        if (rand <= cumulative) {
                            selected = rule[k].res;
                            break;
                        }
                    }
                    doubleBuffer = doubleBuffer.concat(selected.split(''));
                } 
                // Deterministic Rule (Simple String)
                else {
                    doubleBuffer = doubleBuffer.concat(rule.split(''));
                }
            } else {
                // No rule? Keep the character (constants like +, -, [, ])
                doubleBuffer.push(char);
            }
        }
        
        // Swap buffers
        grammarArray = [...doubleBuffer]; 
        doubleBuffer = []; 
    }

    return grammarArray;
}

//
// Define the Grammars
//
function createGrammar(type) {
    rules = {}; // Clear previous rules
    
    if (type === 'fractal') {
        // 1. Fractal Plant (Barnsley Fern-ish)
        let start = "X";
        rules = {
            'X': "F+[[X]-X]-F[-FX]+X",
            'F': "FF"
        };
        angleToUse = 25.0;
        initial_length = 0.05 / Math.pow(1.5, iterations - 4); // Scale adjustment
        return run(iterations, start);
    } 
    else if (type === 'sympodial') {
        // 2. Sympodial Tree (Bushy/Organic)
        let start = "X";
        rules = {
            'X': "F[+X]F[-X]+X",
            'F': "FF"
        };
        angleToUse = 20.0;
        initial_length = 0.05 / Math.pow(1.5, iterations - 4);
        return run(iterations, start);
    } 
    else if (type === 'stochastic') {
        // 3. Stochastic Tree (Randomized)
        let start = "F";
        rules = {
            'F': [
                { prob: 0.33, res: "F[+F]F[-F]F" },
                { prob: 0.33, res: "F[+F]F" },
                { prob: 0.34, res: "F[-F]F" }
            ]
        };
        angleToUse = 25.7; // A classic angle for this randomness
        initial_length = 0.1 / Math.pow(1.2, iterations - 4);
        return run(iterations, start);
    }
    else if (type === 'sierpinski') {
        // 4. Legacy Sierpinski Support
        let start = "A"; 
        rules = { 
            'A': "B-A-B", 
            'B': "A+B+A" 
        };
        angleToUse = 60.0;
        initial_length = 0.8 / Math.pow(2, iterations2); 
        return run(iterations2, start);
    } 
    else { 
        // Default Fallback
        return createGrammar('fractal');
    }
}

//
// Router for Drawing Functions
//
function drawGrammarPoints(grammarArray, type) {
    colors = []; // Clear colors
    // Ensure points array is cleared in lsystemMain, but we append here
    
    if (type === 'sierpinski') {
        drawSierpinski(grammarArray);
    } else {
        // All trees use the standard "Turtle" Plant drawer
        drawPlant(grammarArray);
    }
}

//
// Standard Turtle Graphics Drawer (F, +, -, [, ])
//
function drawPlant(grammarArray) {
    // Turtle State
    let x = 0.0;
    let y = -0.8; // Start near bottom
    let angle = 90.0; // Start pointing UP
    let z = 0.25;

    let stack = []; // To store [x, y, angle]

    for (let i = 0; i < grammarArray.length; i++) {
        let cmd = grammarArray[i];

        switch (cmd) {
            case 'F': 
            case 'X': // Some grammars draw on X, some don't. We will draw on both for density.
                // Calculate new tip position
                let rad = radians(angle);
                let nextX = x + initial_length * Math.cos(rad);
                let nextY = y + initial_length * Math.sin(rad);

                // Add Line Segment
                addLine([x, y, z], [nextX, nextY, z]);
                
                // Color (Woody Brown)
                // You can get fancy here: mix green if it's a leaf (terminal branch)
                addColor([0.55, 0.27, 0.07]); 

                // Move Turtle
                x = nextX;
                y = nextY;
                break;

            case '+': // Turn Left
                angle += angleToUse;
                break;

            case '-': // Turn Right
                angle -= angleToUse;
                break;

            case '[': // Push State
                stack.push({ x: x, y: y, angle: angle });
                break;

            case ']': // Pop State
                let state = stack.pop();
                x = state.x;
                y = state.y;
                angle = state.angle;
                break;

            default: 
                // Ignore dummy characters used for evolution but not drawing
                break;
        }
    }
}

//
// Legacy Sierpinski Drawer
//
function drawSierpinski(grammarArray) {
    let angle = 0.0; 
    let x = -0.4;
    let y = -0.4;
    let z = 0.25;

    for (let i = 0; i < grammarArray.length; i++) {
        let cmd = grammarArray[i];
        if (cmd === 'A' || cmd === 'B') {
             let rad = radians(angle);
             let nextX = x + initial_length * Math.cos(rad);
             let nextY = y + initial_length * Math.sin(rad);

             addLine([x, y, z], [nextX, nextY, z]);
             
             // Alternating colors for Sierpinski
             if(cmd === 'A') addColor([1.0, 0.3, 0.3]);
             else addColor([0.3, 0.3, 1.0]);

             x = nextX;
             y = nextY;
        } else if (cmd === '+') {
            angle += angleToUse;
        } else if (cmd === '-') {
            angle -= angleToUse;
        }
    }
}

//
// Utilities
//
function radians(degrees) {
    return degrees * (Math.PI / 180);
}

function addLine(start, end) {
    // Push Start Vertex
    points.push(start[0], start[1], start[2]);
    // Push End Vertex
    points.push(end[0], end[1], end[2]);
}

function addColor(c) {
    // Add color for Start Vertex
    colors.push(c[0], c[1], c[2]);
    // Add color for End Vertex
    colors.push(c[0], c[1], c[2]);
}