//===================selecting main elements======================
const gameBoard = document.querySelector(".g-board");
const scoreSpan = document.querySelector(".score");
const highScoreSpan = document.querySelector(".high-score");
const playerNameDisplay = document.getElementById("player-name-display"); 
const gameOverScreen = document.getElementById("game-over-screen");
const finalScoreDisplay = document.getElementById("final-score");
const restartButton = document.getElementById("restart-button");
const welcomeScreen = document.getElementById("welcome-screen");
const startButton = document.getElementById("start-button");
const playerNameInput = document.getElementById("player-name");
const eatSound = document.getElementById("eat-sound");
const gameOverSound = document.getElementById("game-over-sound");

//========================= game variables======================
let gameOver = false;
let foodX, foodY;
let snakeHeadPositionX, snakeHeadPositionY;
let snakeBody;
let velocityX, velocityY;
let setIntervalId;
let score;
let highScore = parseInt(localStorage.getItem("high-score")) || 0;
let gameSpeed = 150; 
let playerName = "";
let gameStarted = false;

highScoreSpan.textContent = `High Score: ${highScore}`;

// ======= initializes or resets the game state, setting the snake's position, score, velocity===================

const initGame = ()=> {
    gameOver = false;
    snakeHeadPositionX = 5;
    snakeHeadPositionY = 8;
    snakeBody = [];
    velocityX = 0;
    velocityY = 0;
    score = 0;
    gameSpeed = 150;
    scoreSpan.textContent = "Score: 0";
    gameOverScreen.classList.add("hidden");
    changeFoodPosition();

    clearInterval(setIntervalId);
    setIntervalId = setInterval(runGame, gameSpeed);
}
//================set random food position on grid====================
const changeFoodPosition = ()=> {
    foodX = Math.floor(Math.random() * 30) + 1;
    foodY = Math.floor(Math.random() * 30) + 1;
}

//=============handle direction changes for the snake=================
const changeDirection = (e)=> {
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
//============ updates the game state, checks for collisions, and manages score and speed===========================

const runGame = () => {
    if (gameOver) {
        clearInterval(setIntervalId);
        finalScoreDisplay.textContent = score;
        gameOverScreen.classList.remove("hidden");

       
        gameOverSound.play();  
        return;

    }

    let html = `<div class="food" style="grid-area: ${foodY} / ${foodX}"></div>`;

    if (snakeHeadPositionX === foodX && snakeHeadPositionY === foodY) {
        changeFoodPosition();
        snakeBody.push([foodX, foodY]);
        score++;
        highScore = score >= highScore ? score : highScore;
        localStorage.setItem("high-score", highScore);
        scoreSpan.textContent = `Score: ${score}`;
        highScoreSpan.textContent = `High Score: ${highScore}`;

        
        eatSound.pause();
        eatSound.currentTime = 0; 
        eatSound.play(); 

      
        setTimeout(() => {
            eatSound.pause();
        }, 600); 

        gameSpeed = Math.max(gameSpeed - 5, 50); 
        clearInterval(setIntervalId);
        setIntervalId = setInterval(runGame, gameSpeed);
    }

    for (let i = snakeBody.length - 1; i > 0; i--) {
        snakeBody[i] = snakeBody[i - 1];
    }

    snakeBody[0] = [snakeHeadPositionX, snakeHeadPositionY];

    snakeHeadPositionX += velocityX;
    snakeHeadPositionY += velocityY;

    if (
        snakeHeadPositionX <= 0 || snakeHeadPositionX > 30 || snakeHeadPositionY <= 0 || snakeHeadPositionY > 30) {
        gameOver = true;
    }

    for (let i = 0; i < snakeBody.length; i++) {
        html += `<div class="headOfSnake" style="grid-area: ${snakeBody[i][1]} / ${snakeBody[i][0]}"></div>`;
        if (i !== 0 && snakeBody[0][1] === snakeBody[i][1] && snakeBody[0][0] === snakeBody[i][0]) {
            gameOver = true;
        }
    }

    gameBoard.innerHTML = html;
}
//========================= restart button ===========================
restartButton.addEventListener("click", () => {
    welcomeScreen.style.display = "block";
    gameOverScreen.classList.add("hidden");
    playerNameInput.classList.remove("error");
});

//========================= start button ===========================
startButton.addEventListener("click", () => {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        playerNameInput.classList.add("error"); 
        return;
    }
    welcomeScreen.style.display = "none";
    gameStarted = true;
    playerNameDisplay.textContent = playerName;  
    initGame();
});

document.addEventListener("keydown", (e) => {
    if (gameStarted) {
        changeDirection(e);
    }
});
