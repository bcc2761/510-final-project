// cgIShape.js
// Bennett Chang
// CSCI-510

'use strict';

let initial_length,
    initial_radius,
    angleToUse,
	rules,
    colors;
var iterations = 4;
var iterations2 = 1;

// 
// initialize grammar variables
//
function initializeGrammarVars() {
    // how to set line width?????
    initial_length =0.1;
    initial_radius = 1.0;
	angleToUse = 45.0;
    iterations = 4;
    rules = [];
}

function isNumeric(char) {
	return /^[0-9]$/.test(char);
}

// Run the lsystem iterations number of times on the start axiom.
function run(iterations, startString) {
	let grammarArray = startString.split('');
    let doubleBuffer = [];

	console.log("iterations: " + iterations);
    for (let i = 0; i < iterations; i++) {
		for (let j = 0; j < grammarArray.length; j++) {
            if (isNumeric(grammarArray[j])) {
				let rule = rules[parseInt(grammarArray[j])].split('');
				if (doubleBuffer.length === 0) {
					doubleBuffer = rule;
				} else {
					doubleBuffer = doubleBuffer.concat(rule);
                }
			} else {
				if (doubleBuffer.length === 0) {
					doubleBuffer = grammarArray[j];
				} else {
					doubleBuffer = doubleBuffer.concat(grammarArray[j]);
				}
            }
           
		}
		
		grammarArray.length = 0; // Clear
		grammarArray.push(...doubleBuffer); 
		doubleBuffer.length = 0;
    }

    return grammarArray;
}

//
// l-system grammar creation code
//
function createGrammar(type) {
    rules = []; // clear rules each time
    if (type === 'sierpinski') {
        // 0 represents A (draw)
        // 1 represents B (draw)
        let start = "0"; // start with '0' instead of 'A'
        rules = {
            '0': "1-0-1", // rule for A is now rule for 0
            '1': "0+1+0"  // rule for B is now rule for 1
        };
        angleToUse = 60.0;
        initial_length = 0.8 / Math.pow(2, iterations2); 
        return run(iterations2, start);
    } else { // default to the original plant
        let start = "0";
        rules = {
            '0': "1[0]0",
            '1': "11"
        };
        angleToUse = 45.0;
        initial_length = 1.6 / Math.pow(2, iterations);
        return run(iterations, start);
    }
}

//
// choose which drawing function to use based on the type of l-system
//
function drawGrammarPoints(grammarArray, type) {
    colors = []; // always reset the colors array before drawing
    if (type === 'sierpinski') {
        drawSierpinski(grammarArray);
    } else {
        drawPlant(grammarArray);
    }
}

// drawing code for the plant l-system
function drawPlant(grammarArray) {
	// to push and pop location and angle
	let positions = [];
	let angles = [];

    // current angle and position
	let angle = 0.0;

	// positions to draw towards
	let newPosition = [];
	let rotated = [];

	// always start at 0.0, 0.0, 0.25
	let position = [0.0, 0.0, 0.25];
	let posx=0.0, posy = 0.0;
	
	// Apply the drawing rules to the string given to us
	for (let i = 0; i < grammarArray.length; i++) {
		let buff = grammarArray[i];
		switch (buff) {
			case '0':
				// draw a line ending in a leaf
				posy += initial_length;
				newPosition = [position[0], posy, position[2]];
				rotated = rotate(position, newPosition, angle);
				newPosition = [rotated[0], rotated[1], position[2]];
				addLine(position, newPosition);
                addColor([0.2, 0.8, 0.3]); // Add color for the line

				// set up for the next draw
				position = newPosition;
				posx = newPosition[0];
				posy = newPosition[1];			
				break;
			case '1':
				// draw a line 
				posy += initial_length;
				newPosition = [position[0],posy, position[2]];
				rotated = rotate(position, newPosition, angle);
				newPosition = [rotated[0], rotated[1], position[2]];
				addLine(position, newPosition);
                addColor([0.7, 0.4, 0.2]); // Add color for the line

				// set up for the next draw
				position = newPosition;
				posx = newPosition[0];
				posy = newPosition[1];
				break;
			case '[':
				//[: push position and angle, turn left 45 degrees
				positions.push(posy);
				positions.push(posx);
				angles.push(angle);
				angle -= 45;
				break;
			case ']':
				//]: pop position and angle, turn right 45 degrees
				posx = positions.pop();
				posy = positions.pop();
				position = [posx, posy, position[2]];
				angle = angles.pop();
				angle += 45;
				break;
			default: break;
		}
	}
}

// drawing code for the sierpinski triangle l-system
function drawSierpinski(grammarArray) {
    let angle = 0.0;
    let position = [-0.4, -0.2, 0.25];
    const colorPalette = [[1.0, 0.3, 0.3], [0.3, 1.0, 0.3], [0.3, 0.3, 1.0]];

    for (let i = 0; i < grammarArray.length; i++) {
        let buff = grammarArray[i];
        switch(buff) {
            case '0':
            case '1':
                let rad = radians(angle);
                let newPosition = [position[0] + initial_length * Math.cos(rad), position[1] + initial_length * Math.sin(rad), position[2]];
                addLine(position, newPosition);
                addColor(buff === '0' ? colorPalette[0] : colorPalette[1]);
                position = newPosition;
                break;
            case '+':
                angle += angleToUse;
                break;
            case '-':
                angle -= angleToUse;
                break;
        }
    }
}

////////////////////////////////////////////////////////////////////
//
//  Utility functions
//
///////////////////////////////////////////////////////////////////

function radians(degrees)
{
  var pi = Math.PI;
  return degrees * (pi/180);
}
// rotate a line and return the position after rotation
// Assumes rotation around the Z axis
function rotate(pivotPoint, pointToRotate, angle) {
   		let Nx = (pointToRotate[0] - pivotPoint[0]);
   		let Ny = (pointToRotate[1] - pivotPoint[1]);
		let radAngle = radians(-angle);
	let result = [Math.cos(radAngle) * Nx - Math.sin(radAngle) * Ny + pivotPoint[0],
		Math.sin(radAngle) * Nx + Math.cos(radAngle) * Ny + pivotPoint[1]];
		return result;
}

function addLine(firstPosition, secondPosition) {
   
    // push first vertex
	points.push(firstPosition[0]); 
	points.push(firstPosition[1]);  
	points.push(firstPosition[2]);  
    
    // push second vertex
    points.push(secondPosition[0]); 
	points.push(secondPosition[1]);
	points.push(secondPosition[2]);
}

// add color for both vertices of the line
function addColor(color) {
    colors.push(color[0], color[1], color[2]);
    colors.push(color[0], color[1], color[2]);
}