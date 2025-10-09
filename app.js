//===================selecting main elements======================
const gameBoard = document.querySelector(".g-board");
const scoreSpan = document.querySelector(".score");
const highScoreSpan = document.querySelector(".high-score");
const gameOverScreen = document.getElementById("game-over-screen");
const finalScoreDisplay = document.getElementById("final-score");
const restartButton = document.getElementById("restart-button");

//=========================main game variables======================
let gameOver = false;
let foodX, foodY;
let snakeHeadPositionX, snakeHeadPositionY;
let snakeBody;
let velocityX, velocityY;
let setIntervalId;
let score;
let highScore = localStorage.getItem("high-score") || 0;
highScoreSpan.textContent = `High Score: ${highScore}`;

// =====================start or restart game========================
const initGame = () => {
  gameOver = false;
  snakeHeadPositionX = 5;
  snakeHeadPositionY = 8;
  snakeBody = [];
  velocityX = 0;
  velocityY = 0;
  score = 0;
  scoreSpan.textContent = "Score: 0";
  gameOverScreen.classList.add("hidden");
  changeFoodPosition();

  //===========clear any previous interval and start a new one=========
  clearInterval(setIntervalId);
  setIntervalId = setInterval(runGame, 150);
}

//================set random food position on grid====================
const changeFoodPosition = () =>{
  foodX = Math.floor(Math.random() * 30) + 1;
  foodY = Math.floor(Math.random() * 30) + 1;
}

//=============handle direction changes for the snake=================
const changeDirection = (e) =>{
  if (e.key === "ArrowUp" && velocityY !== 1) {
    velocityX = 0;
    velocityY = -1;
  } else if (e.key === "ArrowDown" && velocityY !== -1) {
    velocityX = 0;
    velocityY = 1;
  } else if (e.key === "ArrowRight" && velocityX !== -1) {
    velocityX = 1;
    velocityY = 0;
  } else if (e.key === "ArrowLeft" && velocityX !== 1) {
    velocityX = -1;
    velocityY = 0;
  }
}

//====================main game loop===============================
const runGame = ()=>{
  if (gameOver) {
    clearInterval(setIntervalId);
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.remove("hidden");
    return;
  }

  //====================food element===============================
  let html = `<div class="food" style="grid-area: ${foodY} / ${foodX}"></div>`;

  //==================if snake eats food===========================
  if (snakeHeadPositionX === foodX && snakeHeadPositionY === foodY) {
    changeFoodPosition();
    snakeBody.push([foodX, foodY]);
    score++;
    highScore = score >= highScore ? score : highScore;
    localStorage.setItem("high-score", highScore);
    scoreSpan.textContent = `Score: ${score}`;
    highScoreSpan.textContent = `High Score: ${highScore}`;
  }

  //======================move snake body=======================
  for (let i = snakeBody.length - 1; i > 0; i--) {
    snakeBody[i] = snakeBody[i - 1];
  }

  //=====================move head position=====================
  snakeBody[0] = [snakeHeadPositionX, snakeHeadPositionY];

  snakeHeadPositionX += velocityX;
  snakeHeadPositionY += velocityY;

  //=============check if snake hits the wall===================
  if (
    snakeHeadPositionX <= 0 ||
    snakeHeadPositionX > 30 ||
    snakeHeadPositionY <= 0 ||
    snakeHeadPositionY > 30
  ) {
    gameOver = true;
  }

  //==============check if snake hits itself=====================
  for (let i = 0; i < snakeBody.length; i++) {
    html += `<div class="headOfSnake" style="grid-area: ${snakeBody[i][1]} / ${snakeBody[i][0]}"></div>`;
    if (
      i !== 0 &&
      snakeBody[0][1] === snakeBody[i][1] &&
      snakeBody[0][0] === snakeBody[i][0]
    ) {
      gameOver = true;
    }
  }

  //==============render everything on board======================
  gameBoard.innerHTML = html;
}

//===================restart button click=========================
restartButton.addEventListener("click", initGame);


document.addEventListener("keydown", changeDirection);
initGame();

