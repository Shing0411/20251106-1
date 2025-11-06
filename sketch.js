// --- 全域常數與變數 ---
const NUM_QUESTIONS = 5;
const OPTION_LETTERS = ['A', 'B', 'C', 'D']; 
const OPTION_HEIGHT = 60; 
const OPTIONS_Y_START = 200; 
const INPUT_WIDTH = 300; // 輸入框寬度 (需與 CSS 配合)

let questionsTable;
let allQuestions = []; 
let quizQuestions = []; 
let currentQuestionIndex = 0;
let score = 0;
let quizState = 'loading'; // 'loading', 'input', 'quiz', 'results', 'error'

// 身份資訊與 DOM 元素
let studentId = '';
let studentName = '';
let idInput;
let nameInput;
let startButton;
let resetButton; 

// 背景粒子動畫相關
let particles = [];
let numParticles = 150;
let bgColorHue = 210; 
let BASE_BG_COLOR_RGB; 

let cnv; // <-- 新增：儲存 canvas 參考
let ignoreNextMouseClick = false; // <-- 新增：忽略下一次 canvas 點擊（避免按鈕點擊被 canvas 捕捉）

// 互動動畫相關
let fireworks = []; 
let rainParticles = []; 
let showFeedbackAnimation = false;


// --- p5.js 核心函式 ---

function preload() {
  // 載入 CSV (路徑設定為子資料夾)
  questionsTable = loadTable('questions/questions.csv', 'csv', 'header', 
    function(table) {
      console.log("CSV 載入成功");
      parseQuestions(); 
      
      if (allQuestions.length >= NUM_QUESTIONS) {
        quizState = 'input'; 
      } else {
        quizState = 'error'; 
      }
    },
    function(error) { 
      console.error("CSV 載入失敗:", error);
      questionsTable = null; 
      quizState = 'error'; 
    }
  );
}

function setup() {
  // 將 createCanvas 的回傳值存下，供後續判斷點擊目標使用
  cnv = createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  colorMode(HSB, 360, 100, 100, 1); 
  textSize(20);
  noStroke();

  colorMode(RGB);
  BASE_BG_COLOR_RGB = color(25, 25, 35); 
  
  // 背景粒子初始化
  colorMode(HSB, 360, 100, 100, 1);
  for (let i = 0; i < numParticles; i++) {
    particles.push(new BGParticle(random(width), random(height), random(180, 240))); 
  }
  
  // 建立輸入框和按鈕
  idInput = createInput('');
  idInput.attribute('placeholder', '請輸入學號 (Student ID)');
  idInput.style('width', `${INPUT_WIDTH}px`); 
  idInput.class('quiz-input');
  idInput.hide(); 

  nameInput = createInput('');
  nameInput.attribute('placeholder', '請輸入姓名 (Name)');
  nameInput.style('width', `${INPUT_WIDTH}px`); 
  nameInput.class('quiz-input');
  nameInput.hide();
  
  startButton = createButton('開始測驗');
  startButton.class('quiz-button');
  startButton.mousePressed(startQuiz);
  startButton.hide();
  
  resetButton = createButton('點我重新測驗');
  resetButton.class('quiz-button');
  resetButton.mousePressed(resetQuiz);
  resetButton.hide();

  // 首次定位
  positionInputElements();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  positionInputElements();
}

function positionInputElements() {
  idInput.position(width / 2 - INPUT_WIDTH / 2, height / 2 - 60);
  nameInput.position(width / 2 - INPUT_WIDTH / 2, height / 2 + 10);
  
  // 使用 CSS 寬度或預設值進行置中
  let startButtonWidth = startButton.width > 0 ? startButton.width : 250; 
  startButton.position(width / 2 - startButtonWidth / 2, height / 2 + 100);
  
  let resetButtonWidth = resetButton.width > 0 ? resetButton.width : 300; 
  resetButton.position(width / 2 - resetButtonWidth / 2, height - 100); 
}

function startQuiz() {
  if (idInput.value().trim() === '' || nameInput.value().trim() === '') {
    alert('學號和姓名不能為空！');
    return;
  }
  
  studentId = idInput.value().trim();
  studentName = nameInput.value().trim();
  
  // 隱藏輸入框和按鈕
  idInput.hide();
  nameInput.hide();
  startButton.hide();
  
  // 新增：避免同一次點擊繼續被 canvas 接收（會導致誤選題目）
  ignoreNextMouseClick = true;
  setTimeout(() => { ignoreNextMouseClick = false; }, 200);

  quizState = 'quiz';
}

function resetQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  studentId = '';
  studentName = '';
  
  idInput.value('');
  nameInput.value('');
  
  // 重新隨機選擇題目
  selectRandomQuestions(); 
  
  quizState = 'input'; 
  showFeedbackAnimation = false;
  fireworks = [];
  rainParticles = [];
  
  // 新增：避免重置按鈕的點擊被 canvas 捕捉
  ignoreNextMouseClick = true;
  setTimeout(() => { ignoreNextMouseClick = false; }, 200);

  resetButton.hide();
}


function draw() {
  
  drawBackgroundParticles();
  drawStateBackground();

  switch (quizState) {
    case 'loading':
      displayLoading();
      break;
    case 'input':
      displayInput();
      // 第一次進入 input 狀態時選題 (確保只在第一次運行)
      if (quizQuestions.length === 0 && allQuestions.length >= NUM_QUESTIONS) {
          selectRandomQuestions();
      }
      break;
    case 'quiz':
      displayQuiz();
      break;
    case 'results':
      if (showFeedbackAnimation) {
        drawFeedbackAnimation();
      }
      displayResults();
      break;
    case 'error':
      displayError();
      break;
  }
}

function mousePressed() {
  // 若被標記要忽略（同一次按鈕點擊），清除旗標並忽略處理
  if (ignoreNextMouseClick) {
    ignoreNextMouseClick = false;
    return;
  }

  // 先檢查實際被點擊的 DOM 元素是否為 canvas（避免點擊按鈕也觸發 canvas 互動）
  if (cnv && cnv.elt) {
    const rect = cnv.elt.getBoundingClientRect();
    const clientX = mouseX + rect.left;
    const clientY = mouseY + rect.top;
    const el = document.elementFromPoint(clientX, clientY);
    if (!el || el.tagName.toLowerCase() !== 'canvas') {
      return; // 點擊不是畫布，忽略 canvas 的點擊處理
    }
  }

  if (ignoreNextMouseClick) {
    ignoreNextMouseClick = false; // 重置標誌
    return; // 忽略這次點擊
  }

  if (quizState === 'quiz' && currentQuestionIndex < quizQuestions.length) {
    let q = quizQuestions[currentQuestionIndex];
    
    for (let i = 0; i < q.options.length; i++) {
      let y = OPTIONS_Y_START + i * OPTION_HEIGHT;
      let optionWidth = width / 2;
      let xStart = width / 4;
      
      if (
        mouseX > xStart &&
        mouseX < xStart + optionWidth &&
        mouseY > y &&
        mouseY < y + OPTION_HEIGHT - 10 
      ) {
        q.selectedIndex = i;
        
        currentQuestionIndex++;
        if (currentQuestionIndex >= quizQuestions.length) {
          calculateResults();
        }
        break;
      }
    }
  }
  
  // 點擊清除結果動畫 (排除重置按鈕區域)
  if (quizState === 'results' && showFeedbackAnimation && mouseY < height - 150) { 
      showFeedbackAnimation = false;
      fireworks = [];
      rainParticles = [];
  }
}

// --- 輔助函式 ---

function drawBackgroundParticles() {
  bgColorHue = (bgColorHue + 0.03) % 360; 
  push();
  colorMode(HSB, 360, 100, 100, 1);
  background(210, 80, 10, 0.1); 
  noStroke();

  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    p.update();
    p.show(); 

    for (let j = i + 1; j < particles.length; j++) {
      let other = particles[j];
      p.attract(other);
      if (dist(p.pos.x, p.pos.y, other.pos.x, other.pos.y) < 80) {
        stroke(200, 50, 95, 0.15); 
        strokeWeight(1);
        line(p.pos.x, p.pos.y, other.pos.x, other.pos.y);
      }
    }
    p.attract(new BGParticle(mouseX, mouseY, 210, true)); 
  }
  pop();
}

function drawStateBackground() {
  colorMode(RGB); 

  if (quizState === 'loading' || quizState === 'error' || quizState === 'input') {
    background(BASE_BG_COLOR_RGB); 
  } else if (quizState === 'results' && showFeedbackAnimation) {
    if (score >= 60) {
      background(0, 0, 0, 30); 
    } else {
      background(50, 50, 150, 100); 
    }
  }
}

function displayInput() {
  colorMode(RGB);
  background(BASE_BG_COLOR_RGB); 

  // 顯示輸入框和按鈕
  idInput.show();
  nameInput.show();
  startButton.show();
  resetButton.hide(); 
  positionInputElements(); 

  fill(255);
  textSize(40);
  text("歡迎參加測驗", width / 2, height / 2 - 200);
  
  textSize(24);
  fill(200);
  text("請輸入學號和姓名開始", width / 2, height / 2 - 140);
}

function displayQuiz() {
  if (currentQuestionIndex >= quizQuestions.length) return;
  
  colorMode(RGB);
  
  let q = quizQuestions[currentQuestionIndex];
  
  fill(100, 150, 255); 
  textSize(16);
  textAlign(LEFT, TOP);
  text(`考生: ${studentName} (${studentId})`, 20, 20);
  textAlign(CENTER, CENTER);

  fill(200); 
  textSize(24);
  text(`第 ${currentQuestionIndex + 1} 題 / 共 ${quizQuestions.length} 題`, width / 2, 50);
  
  fill(255); 
  textSize(28);
  text(q.question, width / 2, 120);

  textSize(20);
  let optionWidth = width / 2;
  let xStart = width / 4;
  
  let defaultColor = color(50, 80, 130); 
  let hoverColor = color(70, 110, 190); 
  let selectedColor = color(255, 165, 0); 

  for (let i = 0; i < q.options.length; i++) {
    let y = OPTIONS_Y_START + i * OPTION_HEIGHT;
    let buttonColor = defaultColor; 

    let isHovering = (
      mouseX > xStart &&
      mouseX < xStart + optionWidth &&
      mouseY > y &&
      mouseY < y + OPTION_HEIGHT - 10
    );

    if (q.selectedIndex === i) {
      buttonColor = selectedColor; 
    } else if (isHovering) {
      buttonColor = hoverColor; 
    }

    fill(buttonColor);
    drawingContext.shadowOffsetX = 3;
    drawingContext.shadowOffsetY = 3;
    drawingContext.shadowBlur = 8; 
    drawingContext.shadowColor = 'rgba(0, 0, 0, 0.8)';
    
    rect(xStart, y, optionWidth, OPTION_HEIGHT - 10, 8); 

    drawingContext.shadowBlur = 0;
    drawingContext.shadowOffsetX = 0;
    drawingContext.shadowOffsetY = 0;

    fill(255); 
    let optionText = `${OPTION_LETTERS[i]}. ${q.options[i]}`;
    text(optionText, width / 2, y + OPTION_HEIGHT / 2 - 5);
  }
}

function calculateResults() {
  score = 0;
  for (let q of quizQuestions) {
    let correctIndex = OPTION_LETTERS.indexOf(q.correctAnswer); 
    if (q.selectedIndex === correctIndex) {
      score += 100 / NUM_QUESTIONS;
      q.isCorrect = true;
    }
  }
  score = round(score); 
  quizState = 'results';
  showFeedbackAnimation = true;
}

function displayResults() {
  colorMode(RGB); 
  
  let feedbackText = "";
  let feedbackColor = color(255);

  if (score === 100) {
    feedbackText = "滿分！🎉 恭喜！太棒了！掌聲加煙火！";
    feedbackColor = color(255, 255, 0); 
  } else if (score >= 60) {
    feedbackText = `成績：${score} 分。合格！繼續努力！放煙火！`;
    feedbackColor = color(0, 255, 0); 
  } else {
    feedbackText = `成績：${score} 分。不合格... 繼續加油！🌧️ (下雨中)`;
    feedbackColor = color(255, 100, 100); 
  }

  fill(255);
  textSize(48);
  text("測驗結束！", width / 2, height / 2 - 200);

  textSize(24);
  fill(200);
  text(`考生: ${studentName} (${studentId})`, width / 2, height / 2 - 140);
  
  textSize(64);
  fill(feedbackColor);
  text(`${score} 分`, width / 2, height / 2);

  textSize(28);
  fill(255);
  text(feedbackText, width / 2, height / 2 + 100);
  
  // 顯示重置按鈕
  resetButton.show();
  positionInputElements(); // 確保定位
}

function drawFeedbackAnimation() {
  // 確保 HSB 模式用於煙火粒子
  push(); 
  colorMode(HSB, 255);
  
  if (score === 100 || score >= 60) {
    if (random(1) < 0.05) { 
      fireworks.push(new Firework());
    }
    for (let i = fireworks.length - 1; i >= 0; i--) {
      fireworks[i].update();
      fireworks[i].show();
      if (fireworks[i].isFinished()) {
        fireworks.splice(i, 1);
      }
    }
  } else {
    // 確保雨滴使用 RGB 模式
    pop(); 
    push(); 
    colorMode(RGB);
    
    if (frameCount % 3 === 0) { 
        rainParticles.push(new RainDrop(random(width), 0));
    }
    for (let i = rainParticles.length - 1; i >= 0; i--) {
      rainParticles[i].update();
      rainParticles[i].show();
      if (rainParticles[i].isFinished()) {
        rainParticles.splice(i, 1);
      }
    }
  }
  pop(); 
}

function displayLoading() {
  idInput.hide(); 
  nameInput.hide();
  startButton.hide();
  resetButton.hide();

  colorMode(RGB);
  textSize(32);
  fill(255); 
  text("載入中... 請稍候", width / 2, height / 2 - 30);
  textSize(20);
  fill(200); 
  text("正在嘗試從 questions/questions.csv 載入檔案...", width / 2, height / 2 + 30);
}

function displayError() {
  idInput.hide(); 
  nameInput.hide();
  startButton.hide();
  resetButton.hide();
  
  colorMode(RGB);
  let errorMessage = "❌ 載入錯誤！無法讀取檔案或檔案格式不正確。";
  if (questionsTable && questionsTable.getRowCount() < NUM_QUESTIONS) {
      errorMessage = `⚠️ 題目不足！CSV 檔案中只有 ${questionsTable.getRowCount()} 題，需要 ${NUM_QUESTIONS} 題。`;
  }
  
  textSize(32);
  fill(255, 50, 50); 
  text(errorMessage, width / 2, height / 2 - 50);
  textSize(20);
  fill(255);
  text("請確保 'questions' 資料夾在專案根目錄，且檔名為 'questions.csv'。", width / 2, height / 2 + 30);
  textSize(18);
  fill(200);
  text("若仍失敗，請使用 Live Server 或其他本地伺服器運行。", width / 2, height / 2 + 70);
}

// --- 輔助邏輯函式 (最終修正 parseQuestions，處理數據錯位問題) ---

function parseQuestions() {
  let rows = questionsTable.getRows();
  allQuestions = []; 

  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    
    let questionText = row.getString('Question');
    let correctAnswer = row.getString('CorrectAnswer');
    
    // 檢查基本資料完整性
    if (questionText && questionText.trim() !== '' && correctAnswer && correctAnswer.trim() !== '') {
      allQuestions.push({
        question: questionText,
        options: [
          row.getString('OptionA') || '無選項A',
          row.getString('OptionB') || '無選項B',
          row.getString('OptionC') || '無選項C',
          row.getString('OptionD') || '無選項D'
        ],
        correctAnswer: correctAnswer.toUpperCase().trim(), 
        selectedIndex: -1, 
        isCorrect: false
      });
    } else {
      console.warn(`CSV 讀取警告：跳過第 ${i + 1} 行，因缺少題目或正確答案欄位。`);
    }
  }
  
  // 🎯 最終修正點：檢查並移除錯誤讀取的標題行 (跳題的根本原因)
  if (allQuestions.length > 0 && 
      allQuestions[0].question.toUpperCase().trim() === 'QUESTION') {
      
      console.warn("偵測到重複的標題行作為題目數據，已移除第一個元素。");
      allQuestions.shift(); // 移除第一個元素
  }
}

function selectRandomQuestions() {
  // 重置所有題目的選擇狀態
  for (let q of allQuestions) {
    q.selectedIndex = -1;
    q.isCorrect = false;
  }
    
  let tempQuestions = [...allQuestions]; 
  quizQuestions = [];
  for (let i = 0; i < NUM_QUESTIONS; i++) {
    if (tempQuestions.length === 0) break; 
    let randomIndex = floor(random(tempQuestions.length));
    quizQuestions.push(tempQuestions[randomIndex]);
    tempQuestions.splice(randomIndex, 1); 
  }
}


// --- 類別定義 (不變) ---

class BGParticle {
  constructor(x, y, hue, isMouse = false) { 
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.5, 2));
    this.acc = createVector(0, 0);
    this.mass = random(1, 3);
    this.lifespan = 255;
    this.hue = hue || random(360); 
    this.isMouse = isMouse;
  }
  applyForce(force) {
    let f = p5.Vector.div(force, this.mass);
    this.acc.add(f);
  }
  attract(other) {
    if (this.isMouse || other.isMouse) return;
    let force = p5.Vector.sub(other.pos, this.pos);
    let distanceSq = constrain(force.magSq(), 100, 10000);
    let G = 0.8;
    let strength = G * (this.mass * other.mass) / distanceSq;
    force.setMag(strength);
    if (force.mag() < 10) {
      force.mult(-1.5);
    }
    this.applyForce(force);
  }
  update() {
    if (this.isMouse) return;
    this.vel.add(this.acc);
    this.vel.limit(5);
    this.pos.add(this.vel);
    this.acc.mult(0);
    if (this.pos.x > width || this.pos.x < 0) {
      this.vel.x *= -1;
      this.pos.x = constrain(this.pos.x, 0, width);
    }
    if (this.pos.y > height || this.pos.y < 0) {
      this.vel.y *= -1;
      this.pos.y = constrain(this.pos.y, 0, height);
    }
    this.lifespan -= 0.5;
    if (this.lifespan < 0) {
      this.lifespan = 255;
      this.pos = createVector(random(width), random(height));
      this.vel = p5.Vector.random2D().mult(random(0.5, 2));
    }
  }
  show() {
    if (this.isMouse) return;
    push();
    colorMode(HSB, 360, 100, 100, 1); 
    fill(this.hue, 50, 90, this.lifespan / 255); 
    ellipse(this.pos.x, this.pos.y, this.mass * 2);
    pop();
  }
}

class RainDrop {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, random(5, 15)); 
    this.len = random(10, 20); 
  }
  update() {
    this.pos.add(this.vel);
  }
  show() {
    push();
    colorMode(RGB); 
    stroke(150, 180, 255, 150); 
    strokeWeight(1);
    line(this.pos.x, this.pos.y, this.pos.x, this.pos.y + this.len);
    pop();
  }
  isFinished() {
    return this.pos.y > height;
  }
}

class Particle {
  constructor(x, y, hue, firework = false) {
    this.pos = createVector(x, y);
    this.firework = firework; 
    this.lifespan = 255;
    this.hue = hue;
    if (this.firework) {
      this.vel = createVector(0, random(-12, -8)); 
    } else {
      this.vel = p5.Vector.random2D();
      this.vel.mult(random(1, 6));
    }
    this.acc = createVector(0, 0);
  }
  applyForce(force) {
    this.acc.add(force);
  }
  update() {
    if (!this.firework) {
      this.vel.mult(0.9); 
      this.lifespan -= 4;
    }
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0); 
  }
  show() {
    push();
    colorMode(HSB, 255); 
    if (this.firework) {
      stroke(this.hue, 255, 255);
      strokeWeight(4);
    } else {
      stroke(this.hue, 255, 255, this.lifespan);
      strokeWeight(2);
    }
    point(this.pos.x, this.pos.y);
    pop();
  }
  isFinished() {
    return this.lifespan < 0;
  }
}

class Firework {
  constructor() {
    this.hue = random(255); 
    this.firework = new Particle(random(width), height, this.hue, true); 
    this.exploded = false;
    this.particles = [];
    this.gravity = createVector(0, 0.2); 
  }
  update() {
    if (!this.exploded) {
      this.firework.applyForce(this.gravity);
      this.firework.update();
      if (this.firework.vel.y >= 0) {
        this.explode();
        this.exploded = true;
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].applyForce(this.gravity);
      this.particles[i].update();
      if (this.particles[i].isFinished()) {
        this.particles.splice(i, 1);
      }
    }
  }
  explode() {
    for (let i = 0; i < 100; i++) {
      let p = new Particle(this.firework.pos.x, this.firework.pos.y, this.hue, false);
      this.particles.push(p);
    }
  }
  show() {
    if (!this.exploded) {
      this.firework.show();
    }
    for (let p of this.particles) {
      p.show();
    }
  }
  isFinished() {
    return this.exploded && this.particles.length === 0;
  }
}