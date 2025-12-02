let initial_length,
    initial_radius,
    angleToUse,
	rules;
var iterations = 1;

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

// function isNumeric(char) {
// 	return /^[0-9]$/.test(char);
// }

// Run the lsystem iterations number of times on the start axiom.
function run(iterations, startString) {
	let grammarArray = startString.split('');

	console.log("iterations: " + iterations);
    for (let i = 0; i < iterations; i++) {
    	let doubleBuffer = [];
		for (let j = 0; j < grammarArray.length; j++) {
            // if (isNumeric(grammarArray[j])) {
			// 	let rule = rules[parseInt(grammarArray[j])].split('');
			// 	if (doubleBuffer.length === 0) {
			// 		doubleBuffer = rule;
			// 	} else {
			// 		doubleBuffer = doubleBuffer.concat(rule);
            //     }
			// } else {
			// 	if (doubleBuffer.length === 0) {
			// 		doubleBuffer = grammarArray[j];
			// 	} else {
			// 		doubleBuffer = doubleBuffer.concat(grammarArray[j]);
			// 	}
            // }
           let symbol = grammarArray[j];

            if (rules[symbol]) {
                // replace with rule expansion
                doubleBuffer = doubleBuffer.concat(rules[symbol].split(''));
            } else {
                // keep the symbol as is
                doubleBuffer.push(symbol);
            }
		}
		
		// grammarArray.length = 0; // Clear
		// grammarArray.push(...doubleBuffer); 
		grammarArray = doubleBuffer;
		// doubleBuffer.length = 0;
    }

    return grammarArray;
}

// //
// // l-system grammar creation code
// // 
// function createGrammar() {
//     //variables : 0, 1
//     //constants: [, ]
//     //axiom  : 0
//     //rules  : (1 ? 11), (0 ? 1[0]0)
//     // Second example LSystem from 
//     // http://en.wikipedia.org/wiki/L-system
//     let start = "0";
//     rules[0] = "1[0]0";
//     rules[1] = "11";
//     angleToUse = 45.0;

// 	let grammar = run(iterations, start);
// 	return grammar;
// }

// Plant B: n=5, δ=20°, Axiom = F, Rule: F → F[+F]F[-F][F]
function createGrammarB() {
    let start = "F";
    rules = {};
    rules['F'] = "F[+F]F[-F][F]";
    angleToUse = 20.0;

    let grammar = run(iterations, start);
	console.log("Plant B grammar:", grammar.join(""));
    return grammar;
}


// Plant E: n=7, δ=25.7°, Axiom = X, Rules: X→F[+X][-X]FX, F→FF
function createGrammarE() {
    let start = "X";
    rules = {};
    rules['X'] = "F[+X][-X]FX";
    rules['F'] = "FF";
    angleToUse = 25.7;

    let grammar = run(iterations, start);
	console.log("Plant E grammar:", grammar.join(""));
    return grammar;
}

//
// l-system drawing code
//
function drawGrammarPoints(grammarArray) {

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
	let posx=0.0, posy = -1;
	
	// Apply the drawing rules to the string given to us
	for (let i = 0; i < grammarArray.length; i++) {
		let buff = grammarArray[i];
		switch (buff) {
			// case '0':
			// 	// draw a line ending in a leaf
			// 	posy += initial_length;
			// 	newPosition = [position[0], posy, position[2]];
			// 	rotated = rotate(position, newPosition, angle);
			// 	newPosition = [rotated[0], rotated[1], position[2]];
			// 	addLine(position, newPosition);

			// 	// set up for the next draw
			// 	position = newPosition;
			// 	posx = newPosition[0];
			// 	posy = newPosition[1];			
			// 	break;
			// case '1':
			// 	// draw a line 
			// 	posy += initial_length;
			// 	newPosition = [position[0],posy, position[2]];
			// 	rotated = rotate(position, newPosition, angle);
			// 	newPosition = [rotated[0], rotated[1], position[2]];
			// 	addLine(position, newPosition);

			// 	// set up for the next draw
			// 	position = newPosition;
			// 	posx = newPosition[0];
			// 	posy = newPosition[1];
			// 	break;

			case 'F':
				posy += initial_length;
				newPosition = [position[0], posy, position[2]];
				rotated = rotate(position, newPosition, angle);
				newPosition = [rotated[0], rotated[1], position[2]];
				addLine(position, newPosition);
				position = newPosition;
				posx = newPosition[0];
				posy = newPosition[1];
				break;

			case '[':
				positions.push(posx);
				positions.push(posy);
				angles.push(angle);
				break;
			case ']':
				posy = positions.pop();
				posx = positions.pop();
				position = [posx, posy, position[2]];
				angle = angles.pop();
				break;

			
			case '+':
				angle += angleToUse;
				break;

			case '-':
				angle -= angleToUse;
				break;

			case 'X':
                break;

			default: break;

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