// add arduino

// game modes: "home", "playing", "finished"
// functions: addPattern, generateBeatmap, startGame, chiikawaHitsMochi, hitNote, findTravelTime, spawnNotes, hitOrMiss, drawScore, checkGameEnd, pressSpacebar
// different pages: drawHomeScreen, drawGameScreen, drawEndScreen
//Notes class

//use of millis/ time recommended

/*  ---------------------------------- globals  ---------------------------------- */
// arduino connection
let port; // do not remove or rename port
let serialData;

let handDistance = 100;
let handIsClose = false;
let prevHandIsClose = false;

let HIT_DISTANCE = 5;
let RELEASE_DISTANCE = 10;

// assets
let hitSFX;
let gameSong;
let perfectSFX;
let okaySFX;
let missSFX;
let chiikawaRestImg;
let chiikawaHitImg;
let mochiRestImg;
let mochiHitImg;
let bgImg;
let titleFont;
let subFont;

// game variables
let songStartTime;
let songDuration;

let elapsedTime; //ms
let travelTime; //ms
let noteToTargetDist; //pixels

let spaceHold = false;
let spaceHoldStart = 0;

// scoring
let score = 0;
let combo = 0;
let misses = 0;
let resultText = "";
let resultEnd = 0;

// constants
const BPM = 125;
const HIT_X = 150; //target x coord
const HIT_Y = 420*0.75; //target y coord
const NOTE_SPEED = 5; //px per frame
const ANIMATION_DURATION = 200;
const SPACE_HOLD_LIMIT = 180; //ms
const RESULT_DURATION = 700;

// 1min = 60s = 60000ms
// 120 beats per 60000ms
// 1 beat per 60000/120ms (BPM)
let beatLife = 60000/BPM; // how long a beat lasts
let nextBeat = 0; //next beat when a note should appear
let nextNote; // next physical note player is trying to hit

// arrays
let notes = []; //physically appearing notes
let beatmap = []; //pattern notes appear in

let animationEnd;

let gameState = "home";

/*  ---------------------------------- Setup & Draw  ---------------------------------- */
async function setup() {
  createCanvas(640,420);
  port = createSerial(); // creates the Serial Port

  // load assets
  gameSong = await loadSound("assets/yoisho-01.mp3");
  hitSFX = await loadSound("assets/mochi-hit-sound.mp3");
  perfectSFX = await loadSound("assets/PERFECT-01.mp3");
  okaySFX = await loadSound("assets/OKAY-01.mp3");
  missSFX = await loadSound("assets/MISS-01.mp3");
  chiikawaRestImg = await loadImage("assets/Chiikawa-01.png");
  chiikawaHitImg = await loadImage("assets/Chiikawa-02.png");
  mochiRestImg = await loadImage("assets/mochi-01.png");
  mochiHitImg = await loadImage("assets/mochi-02.png");
  bgImg = await loadImage("assets/bg-image.png");
  titleFont = await loadFont("assets/Super-Waffles.ttf");
  subFont = await loadFont("assets/Chicken-pie.ttf");
}

//===\\

function draw() {
  imageMode(CENTER);
  image(bgImg, width/2, height/2,640,420);

  // changing game screens
  if (gameState === "home") {
    drawHomeScreen();
  } else if (gameState === "playing") {
    drawGameScreen(); 
    displayResult();
  } else if (gameState === "finished") {
    drawEndScreen();
  }

  if (port && port.opened()) {
    serialData = port.readUntil("\n");
    // Only log and use data that has information, not empty signals
    if (serialData.length > 0) {
      // Remember to convert the serial data from string to number using float()
      // Disable or remove console.log once verified working
      console.log(serialData);
      
      // use float() to convert the data from string to number
      // (Arduino must send ONE number per line, e.g. Serial.println(distVal))
      let val = Number(serialData);

      // Ignore anything that isn't a number (e.g. stray text or a partial line)
      if (!isNaN(val)) {
        handDistance = val;

        if (handDistance <= HIT_DISTANCE) {
          handIsClose = true;
        } else if (handDistance > RELEASE_DISTANCE) {
          handIsClose = false;
        }

        if (handIsClose && !prevHandIsClose) { //trigger hit when hand first gets close
          if (gameState === "playing") {
            pressSpacebar("pressed");
          }
        }
        if (!handIsClose && prevHandIsClose) { //prevent player holding space
          pressSpacebar("released");
        }
        prevHandIsClose = handIsClose; 
      }
    }
  }
   drawSensorStatus();
}


/*  ---------------------------------- Beatmap  ---------------------------------- */

// 4 diff arrays for different difficulties
let easyPattern = [
    2, 2, 2.5, 2,
    2, 2.5, 2, 2,
    2.5, 2, 2, 2.5,
    2, 2, 2.5, 2
];

let medPattern = [
    1.5, 1.5, 1.25, 1.5,
    1.25, 1.5, 1.5, 1.25,
    1.5, 1.25, 1.5, 1.5,
    1.25, 1.5, 1.25, 1.5
];

let hardPattern = [
    1, 0.875, 1, 0.875,
    1, 1, 0.875, 1,
    0.875, 1, 0.875, 1,
    1, 0.875, 1, 0.875,
    1, 0.875, 0.875, 1
];

let expertPattern = [
  0.625, 0.5, 0.625, 0.5,
  0.5, 0.625, 0.5, 0.5,
  0.625, 0.5, 0.5, 0.625,
  0.5, 0.625, 0.5, 0.5,
  0.5, 0.625, 0.5, 0.5,
  0.625, 0.5, 0.5, 0.625,
  0.5, 0.5, 0.625, 0.5,
  0.5, 0.625, 0.5, 0.5
];

// make patterns into beats
function addPattern(patternType, startBeat, endBeat) { //patternType will be replaced by easy, medium, etc patternm
  let currentBeat = startBeat; 

  // for loop through the beat map
  for (let i = 0; currentBeat < endBeat; i++) { //index increase
    beatmap.push(currentBeat*beatLife) // scheduled beat time increases as i increases (++)
    currentBeat += patternType[i % patternType.length]; //repeat within the pattern
  }
  return endBeat; //for next pattern
}

//===\\

function generateBeatmap() {
  // 1 beat life = 60000/BPM ms
  // total beats = (songduration*1000)/(60000/BPM)
  let totalBeats = (gameSong.duration()*1000)/beatLife;
  let currentTime = 0;

  // order of patterns easy to expert
    currentTime = addPattern(easyPattern, currentTime, totalBeats*0.3);
    currentTime = addPattern(medPattern, currentTime, totalBeats*0.6);
    currentTime = addPattern(hardPattern, currentTime, totalBeats*0.8);
    currentTime = addPattern(expertPattern, currentTime, totalBeats);
}

/* ----------------- ----------------- functions ---------------------------------- */
function startGame() {
  gameState = "playing";

  // reset score, combo, misses
  score = 0;
  combo = 0;
  misses = 0;
  nextBeat = 0;
  resultText = "";
  resultEnd = 0;

  //spacebar
  spaceHold = false;
  spaceHoldStart = 0;

  songDuration = gameSong.duration()*1000;

  // reset notes
  notes = [];
  beatmap = [];

  // song starts
  if (gameState === "playing") {
    songStartTime = millis();
    gameSong.play();
  }

  // generate beatmap
  generateBeatmap();
}

function chiikawaHitsMochi() {
  imageMode(CENTER);
  //chiikawa n mochi stays at image 1
  //when player hits, change to image 2 for both
  // image 2 stays for 200ms until changing back to image 1
  if (millis() < animationEnd) { //value will be assigned to chiikawa animation end when note is hit
    image(chiikawaHitImg, HIT_X, HIT_Y -60, 150,150);
  } else {
    image(chiikawaRestImg, HIT_X, HIT_Y -60, 150,150);
  }
}

function hitNote() { // when player input
    nextNote = -1; //goes up
    let minDistance = 100000; //goes down

    // loop and look through notes array
    for (let i = 0; i < notes.length; i++) {//goes up
      noteToTargetDist = abs(notes[i].x - HIT_X); //return with positive integer

      if (notes[i].hit || notes[i].missed) {
        continue;
      }
      
      if (noteToTargetDist < minDistance) { 
        minDistance = noteToTargetDist;
        nextNote = i //closest note
        }
      } 
    if (nextNote !== -1 && minDistance <= 60) { //0,1,2,3 etc onwards valid
      notes[nextNote].checkHit();
      return true; 
    }
  return false; 
}

function findTravelTime() { //time taken to travel from 640 to target
  // Time = Distance/Speed
  // (ms) = px / (5px/frame)
  //60 frames per sec
  //frame speed : 1 frame takes 1/60s or ((1/60)*1000)ms which is (1000/60)ms;
  //so time = distance /(5px/(1000/60))
  frameRate(60);
  // console.log(frameRate);
  travelTime = (width - HIT_X)/(NOTE_SPEED/(1000/60));
}

function spawnNotes() { //when to spawn next note (only if there are notes left to spawn)
  // note spawns at far right offscreen at elapsed time n disappears
  // delay needed so note doesnt die at 640 (add travelTime)
  //e.g. elapsed time = 5000 | time when next beat spawns = 6000, travel time = 500, so note should spawn at nextBeat time - travelTime (5500)
  if (nextBeat < beatmap.length && elapsedTime >= beatmap[nextBeat] - travelTime) { 
    notes.push((new Notes(width))); // note appears on next beat at 640
    nextBeat++; //move on to next beat
  }
}

function hitOrMiss() { //what happens on hit or miss
  // play sfx and remove the note when player hits note
  //chiikawa hit image plays at millis(), chiikawa hit image ends at millis() + 200
  //range of min. hit = +-60px
  for (let i = notes.length -1; i>= 0; i--) { //removing notes not adding
    notes[i].update();
    notes[i].show();
    
    if (notes[i].hit) {
      if (millis() >= notes[i].hitEnd) { //animation delay on mochi 
        notes.splice(i,1);
      } 
    } else if (notes[i].x < HIT_X - 60 && !notes[i].missed) { // when note passes target, miss increase by 1 onyl 
      misses++;
      combo = 0;
      notes[i].missed = true;
      missSFX.play();
      showResult("MISS");
      }
    if (notes[i] && notes[i].x < 0) { // splice when missed notes go off screen on the left. index alw >=0
      notes.splice(i,1)
    }
  }
}

function drawScore() { //display score, combo, misses
  //score display
  //LATER: add words saying miss, combo, perfect, good etc.
  fill(40);
  noStroke();
  rect(0,0,150,100)

  textFont(titleFont);
  textAlign(LEFT);
  textSize(18);
  fill(255);
  text("Score: " + score, 20, 30);
  text("Combo: " + combo, 20, 55);
  text("Misses: " + misses, 20, 80);
}

function showResult(text) {
  resultText = text;
  resultEnd = millis() + RESULT_DURATION;
}

function displayResult() {
  if (millis() < resultEnd) {
    push();

    textAlign(CENTER);
    textFont(titleFont);
    textSize(28);
    textStyle(BOLD);

    if (resultText === "PERFECT") {
      fill(0,255,0);
    } else if (resultText === "OKAY") {
      fill(255,255,0);
    } else if (resultText === "MISS") {
      fill(255,0,0);
    }
    text(resultText, HIT_X, HIT_Y - 150);

    pop();
  }
}

function checkGameEnd() {
  // game ends whem:
  // 1.song ends
  // 2.no more notes/beatmap ends
  // 3.player misses too much
  if (elapsedTime >= songDuration && nextBeat >= beatmap.length && notes.length === 0) {
    gameState = "finished";
    gameSong.stop();
  }
}

function pressSpacebar(action) { //dont let players hold down spacebar, wrong timing even with no note = +1miss
  if (gameState !== "playing") {
    return;
  }
  
  if (action === "pressed" && !spaceHold) { //global starts with spaceHold = "false"
    spaceHold = true;
    let successfulHit = hitNote();

    if (!successfulHit) {
      misses++;
      combo=0;
      showResult("MISS");
      missSFX.play();
    }
    
    animationEnd = millis() + ANIMATION_DURATION;

  } else if (action === "released") {
    spaceHold = false;
  }
}

/*  ---------------------------------- Arduino ---------------------------------- */
//note: chatgpt used for help when there were connection problems for this arduino section
function connectBtnClicked() {
  // When button is clicked, check if serial port is already opened
  if (!port.opened()) {
    // If not already, open the port with baud rate 9600
    // Make sure baud rate here matches settings in Arduino
    port.open(9600);
  } else {
    // Otherwise, close the port
    port.close();
  }
}

function drawSensorStatus() {
  fill(0);
  textFont(subFont);
  textAlign(CENTER);
  textSize(12);

  text("Hand distance: ", width/2 +85,height/2-40);
  text("Hand status: ", width/2+90, height/2 -20);

  textSize(16);
  fill("#A74B2E");
  text(handDistance.toFixed(1) + "cm", width/2 +160,height/2-40);
  text((handIsClose ? "CLOSE" : "FAR"), width/2+145, height/2 -20);
  
  
}

/*  ---------------------------------- Game Screens  ---------------------------------- */
function drawHomeScreen() {
  // text
  textFont(titleFont);

  push();
  textAlign(CENTER);
  textSize(60);
  fill(255);
  stroke(5);
  strokeWeight(5)
  text("MOCHITSUKI", width/3 - 30, height/4-35);
  pop();

  push();
  textFont(subFont);
  textAlign(LEFT);
  textWrap(WORD);
  textSize(14);
  fill(0);
  text("1. Connect Arduino", 60, height/3 -25, 280);
  text("2. This game is MochiTsuki.", 60, height/2-35, 280);
  text("3. Test your controls.", 60, height/2 +25, 520);
  fill(255);
  text("4. When you're ready, Press 'ENTER' to start.", 260, height/2 +150, 400);

  fill(50);
  textSize(12);
  text("(Hand distance and Hand status values should be changing)", 60, height/3-5, 280);
  text("(You will be using an ultrasonic sensor to hit mochi when the beat is right.)", 60, height/2-15, 280); 
  text("(To hit a note, bring your hand close to the sensor. If the hand status is 'close', the hammer will be brought down.)", 60, height/2 + 45, 550);
  pop();
}

function drawGameScreen() {
  fill(0);
  
  elapsedTime = millis() -songStartTime;
  // console.log("elapsed", elapsedTime);

  // //note track
  // stroke(255);
  // strokeWeight(15);
  // line(0, HIT_Y, width, HIT_Y);

  // //target circle
  // noStroke();
  // fill(255);
  // ellipse(HIT_X, HIT_Y, 70,70);

  chiikawaHitsMochi()

  findTravelTime();
  
  spawnNotes(); 
  hitOrMiss(); 

  drawScore();

  checkGameEnd();
}

function drawEndScreen() {
  fill(255);
  textAlign(CENTER);

  textFont(titleFont);

  push();
  textSize(80);
  stroke(0);
  strokeWeight(5);
  text("Game Over!", width/2, height/3);
  pop();

  textSize(20);
  text("Final Score: "+score, width/2, height/2+40);
  text("Misses: "+misses, width/2, height/2+70);
  text("Press 'ENTER' to play again", width/2, height/2 +190);
}

/*  ---------------------------------- Controls  ---------------------------------- */
// later replace this with arduino connection if have time

function keyPressed() {
  if (gameState === "home" && keyCode === 13) {
    //console.log("game state:", gameState);
    startGame();
  }
  if (gameState === "playing" && key === " ") {
    // check spacebar
    pressSpacebar("pressed");
    return false;
    }
  if (gameState === "finished" && keyCode === 13) {
    startGame();  
    }
} 

function keyReleased() {
  if (gameState === "playing" && key === " ") {
    pressSpacebar("released");
    return false; 
  }
}
      
/*  ---------------------------------- Classes  ---------------------------------- */

class Notes {
  constructor(x) { //notes spawn at width, 640
    this.x = x;
    this.speed = NOTE_SPEED;
    this.hit = false;
    this.hitEnd = 0;
    this.missed = false;
  }

  update(){
    this.x -= this.speed;
  }

  show() {
    imageMode(CENTER);
    if (this.hit && millis() < this.hitEnd) {
      image(mochiHitImg, HIT_X, HIT_Y, 80,80);
    } else if (!this.hit) {
      image(mochiRestImg, this.x, HIT_Y,80,80);      
    }
  }

  checkHit() {
    // note needs to be hit in a certain range of distance from the target
    // distance btwn note and target to determine score/miss e.g. perfect etc
    noteToTargetDist = abs(this.x - HIT_X);

    if (this.hit || noteToTargetDist > 60) {//cant hit notes outside of the range
    return;      
    } 

    if (noteToTargetDist <= 20) {  // perfect
      score += 100;
      combo++;
      this.hit = true;
      this.hitEnd = millis() + 100
      // hitSFX.play();
      perfectSFX.play();
      showResult("PERFECT");  
      
    } else if (noteToTargetDist <= 60) { //minimum
      score += 50;
      combo++;
      this.hit = true; 
      this.hitEnd = millis() + 100
      // hitSFX.play();  
      okaySFX.play();
      showResult("OKAY");  
      
    } else {
      combo = 0;
      misses ++;
      showResult("MISS");
     }
   }
}