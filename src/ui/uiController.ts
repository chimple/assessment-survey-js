import { qData, answerData } from '../components/questionData';
import { AudioController } from '../components/audioController';
import { randFrom, shuffleArray } from '../utils/mathUtils';
import { getDataFile } from '../utils/urlUtils';

export class UIController {
  private static instance: UIController | null = null;

  private landingContainerId = 'landWrap';
  public landingContainer: HTMLElement;

  private gameContainerId = 'gameWrap';
  public gameContainer: HTMLElement;

  private endContainerId = 'endWrap';
  public endContainer: HTMLElement;

  private starContainerId = 'starWrapper';
  public starContainer: HTMLElement;

  private chestContainerId = 'chestWrapper';
  public chestContainer: HTMLElement;

  private questionsContainerId = 'qWrap';
  public questionsContainer: HTMLElement;

  private feedbackContainerId = 'feedbackWrap';
  public feedbackContainer: HTMLElement;

  private answersContainerId = 'aWrap';
  public answersContainer: HTMLElement;

  private answerButton1Id = 'answerButton1';
  private answerButton1: HTMLElement;
  private answerButton2Id = 'answerButton2';
  private answerButton2: HTMLElement;
  private answerButton3Id = 'answerButton3';
  private answerButton3: HTMLElement;
  private answerButton4Id = 'answerButton4';
  private answerButton4: HTMLElement;
  private answerButton5Id = 'answerButton5';
  private answerButton5: HTMLElement;
  private answerButton6Id = 'answerButton6';
  private answerButton6: HTMLElement;

  private playButtonId = 'pbutton';
  private playButton: HTMLElement;

  private chestImgId = 'chestImage';
  private chestImg: HTMLElement;

  public nextQuestion = null;

  public contentLoaded: boolean = false;

  public qStart;
  public shown = false;

  public stars = [];
  public shownStarsCount = 0;
  public starPositions: Array<{ x: number; y: number }> = Array<{
    x: number;
    y: number;
  }>();
  public qAnsNum = 0;

  public allStart: number;

  public buttons = [];

  private buttonPressCallback: Function;
  private startPressCallback: Function;

  public buttonsActive: boolean = false;

  private devModeCorrectLabelVisibility: boolean = false;
  private devModeBucketControlsEnabled: boolean = false;

  public animationSpeedMultiplier: number = 1;

  public externalBucketControlsGenerationHandler: (container: HTMLElement, clickCallback: () => void) => void;

  private init(): void {
    // Initialize required containers
    this.landingContainer = document.getElementById(this.landingContainerId);
    this.gameContainer = document.getElementById(this.gameContainerId);
    this.endContainer = document.getElementById(this.endContainerId);
    this.starContainer = document.getElementById(this.starContainerId);
    this.chestContainer = document.getElementById(this.chestContainerId);
    this.questionsContainer = document.getElementById(this.questionsContainerId);
    this.feedbackContainer = document.getElementById(this.feedbackContainerId);
    this.answersContainer = document.getElementById(this.answersContainerId);

    // Initialize required buttons
    this.answerButton1 = document.getElementById(this.answerButton1Id);
    this.answerButton2 = document.getElementById(this.answerButton2Id);
    this.answerButton3 = document.getElementById(this.answerButton3Id);
    this.answerButton4 = document.getElementById(this.answerButton4Id);
    this.answerButton5 = document.getElementById(this.answerButton5Id);
    this.answerButton6 = document.getElementById(this.answerButton6Id);

    this.playButton = document.getElementById(this.playButtonId);

    this.chestImg = document.getElementById(this.chestImgId);

    this.initializeStars();

    this.initEventListeners();
  }

  private initializeStars(): void {
    for (let i = 0; i < 20; i++) {
      const newStar = document.createElement('img');

      // newStar.src = "img/star.png";
      newStar.id = 'star' + i;

      newStar.classList.add('topstarv');

      this.starContainer.appendChild(newStar);

      this.starContainer.innerHTML += '';

      if (i == 9) {
        this.starContainer.innerHTML += '<br>';
      }

      this.stars.push(i);
    }

    shuffleArray(this.stars);
  }

  public SetAnimationSpeedMultiplier(multiplier: number): void {
    UIController.getInstance().animationSpeedMultiplier = multiplier;
  }

  public SetCorrectLabelVisibility(visible: boolean): void {
    this.devModeCorrectLabelVisibility = visible;
  }

  public SetBucketControlsVisibility(visible: boolean): void {
    this.devModeBucketControlsEnabled = visible;
  }

  public static OverlappingOtherStars(
    starPositions: Array<{ x: number; y: number }>,
    x: number,
    y: number,
    minDistance: number
  ): boolean {
    if (starPositions.length < 1) return false;

    for (let i = 0; i < starPositions.length; i++) {
      const dx = starPositions[i].x - x;
      const dy = starPositions[i].y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance) {
        return true;
      }
    }
    return false;
  }

  private initEventListeners(): void {
    // TODO: refactor this
    this.answerButton1.addEventListener('click', () => {
      this.answerButtonPress(1);
    });

    this.buttons.push(this.answerButton1);

    this.answerButton2.addEventListener('click', () => {
      this.answerButtonPress(2);
    });

    this.buttons.push(this.answerButton2);

    this.answerButton3.addEventListener('click', () => {
      this.answerButtonPress(3);
    });

    this.buttons.push(this.answerButton3);

    this.answerButton4.addEventListener('click', () => {
      this.answerButtonPress(4);
    });

    this.buttons.push(this.answerButton4);

    this.answerButton5.addEventListener('click', () => {
      this.answerButtonPress(5);
    });

    this.buttons.push(this.answerButton5);

    this.answerButton6.addEventListener('click', () => {
      this.answerButtonPress(6);
    });

    this.buttons.push(this.answerButton6);

    this.landingContainer.addEventListener('click', () => {
      if (localStorage.getItem(getDataFile()) && UIController.getInstance().contentLoaded) {
        this.showGame();
      }
    });
  }

  public showOptions(): void {
    if (!UIController.getInstance().shown) {
      const newQ = UIController.getInstance().nextQuestion;
      const buttons = UIController.getInstance().buttons;

      const animationSpeedMultiplier = UIController.getInstance().animationSpeedMultiplier;

      let animationDuration = 220 * animationSpeedMultiplier;
      const delayBforeOption = 150 * animationSpeedMultiplier;
      UIController.getInstance().shown = true;
      let optionsDisplayed = 0;

      buttons.forEach((button) => {
        button.style.visibility = 'hidden';
        button.style.animation = '';
        button.innerHTML = '';
      });

      setTimeout(() => {
        for (let i = 0; i < newQ.answers.length; i++) {
          const curAnswer = newQ.answers[i];
          const button = buttons[i] as HTMLButtonElement;

          const isCorrect = curAnswer.answerName === newQ.correct;

          button.innerHTML = 'answerText' in curAnswer ? curAnswer.answerText : '';

          // Add a label inside the button to show the correct answer
          if (isCorrect && UIController.getInstance().devModeCorrectLabelVisibility) {
            const correctLabel = document.createElement('div');
            correctLabel.classList.add('correct-label');
            correctLabel.innerHTML = 'Correct';
            button.appendChild(correctLabel);
          }

          button.style.visibility = 'hidden';
          button.style.boxShadow = '0px 0px 0px 0px rgba(0,0,0,0)';
          setTimeout(
            () => {
              button.style.visibility = 'visible';
              button.style.boxShadow = '0px 6px 8px #606060';
              button.style.animation = `zoomIn ${animationDuration * animationSpeedMultiplier}ms ease forwards`;
              if ('answerImg' in curAnswer) {
                const tmpimg = AudioController.GetImage(curAnswer.answerImg);
                button.appendChild(tmpimg);
              }
              button.addEventListener('animationend', () => {
                optionsDisplayed++;
                if (optionsDisplayed === newQ.answers.length) {
                  UIController.getInstance().enableAnswerButton();
                }
              });
            },
            i * animationDuration * animationSpeedMultiplier * 0.3
          );
        }
      }, delayBforeOption);

      UIController.getInstance().qStart = Date.now();
    }
  }

  private enableAnswerButton(): void {
    UIController.getInstance().buttonsActive = true;
  }

  public static SetFeedbackText(nt: string): void {
    UIController.getInstance().feedbackContainer.innerHTML = nt;
  }

  //functions to show/hide the different containers
  private showLanding(): void {
    this.landingContainer.style.display = 'flex';
    this.gameContainer.style.display = 'none';
    this.endContainer.style.display = 'none';
  }

  public static ShowEnd(): void {
    UIController.getInstance().landingContainer.style.display = 'none';
    UIController.getInstance().gameContainer.style.display = 'none';
    UIController.getInstance().endContainer.style.display = 'flex';
  }

  private showGame(): void {
    this.landingContainer.style.display = 'none';
    this.gameContainer.style.display = 'grid';
    this.endContainer.style.display = 'none';
    this.allStart = Date.now();
    this.startPressCallback();
  }

  public static SetFeedbackVisibile(visible: boolean, isCorrect: boolean) {
    if (visible) {
      UIController.getInstance().feedbackContainer.classList.remove('hidden');
      UIController.getInstance().feedbackContainer.classList.add('visible');
      UIController.getInstance().buttonsActive = false;
      if (isCorrect) {
        UIController.getInstance().feedbackContainer.style.color = 'rgb(109, 204, 122)';
        AudioController.PlayCorrect();
      } else {
        UIController.getInstance().feedbackContainer.style.color = 'red';
      }
    } else {
      UIController.getInstance().feedbackContainer.classList.remove('visible');
      UIController.getInstance().feedbackContainer.classList.add('hidden');
      UIController.getInstance().buttonsActive = false;
    }
  }

  public static ReadyForNext(newQ: qData, reGenerateItems: boolean = true): void {
    if (newQ === null) {
      return;
    }
    UIController.getInstance().answersContainer.style.visibility = 'hidden';
    for (var b in UIController.getInstance().buttons) {
      UIController.getInstance().buttons[b].style.visibility = 'hidden';
    }
    UIController.getInstance().shown = false;
    UIController.getInstance().nextQuestion = newQ;
    UIController.getInstance().questionsContainer.innerHTML = '';
    UIController.getInstance().questionsContainer.style.display = 'none';
    // pB.innerHTML = "<button id='nextqButton'><svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M9 18L15 12L9 6V18Z' fill='currentColor' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></path></svg></button>";
    // UIController.getInstance().playButton.classList.add("audio-button");

    // When the dev mode is active and the bucket next, previous and play buttons are enabled, use the external bucket controls generation handler
    // if (!reGenerateItems) {
    //   return;
    // }
    const isBucketControlsEnabled = UIController.getInstance().devModeBucketControlsEnabled;
    if (isBucketControlsEnabled) {
      UIController.getInstance().externalBucketControlsGenerationHandler(UIController.getInstance().playButton, () => {
        UIController.ShowQuestion();
        //playquestionaudio
        AudioController.PlayAudio(
          newQ.promptAudio,
          UIController.getInstance().showOptions,
          UIController.ShowAudioAnimation
        );
      });
    } else {
      UIController.getInstance().playButton.innerHTML =
        "<button id='nextqButton'><img class=audio-button width='100px' height='100px' src='/img/SoundButton_Idle.png' type='image/svg+xml'> </img></button>";
      var nextQuestionButton = document.getElementById('nextqButton');
      nextQuestionButton.addEventListener('click', function () {
        UIController.ShowQuestion();
        //playquestionaudio
        AudioController.PlayAudio(
          newQ.promptAudio,
          UIController.getInstance().showOptions,
          UIController.ShowAudioAnimation
        );
      });
    }
  }

  public static ShowAudioAnimation(playing: boolean = false) {
    if (!UIController.getInstance().devModeBucketControlsEnabled) {
      const playButtonImg = UIController.getInstance().playButton.querySelector('img');
      if (playing) {
        playButtonImg.src = 'animation/SoundButton.gif';
      } else {
        playButtonImg.src = '/img/SoundButton_Idle.png';
      }
    }
  }

  public static ShowQuestion(newQuestion?: qData): void {
    // pB.innerHTML = "<button id='nextqButton'><svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M9 18L15 12L9 6V18Z' fill='currentColor' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></path></svg></button>";

    // When the dev mode is active and the bucket next, previous and play buttons are enabled, use the external bucket controls generation handler
    const isBucketControlsEnabled = UIController.getInstance().devModeBucketControlsEnabled;
    if (isBucketControlsEnabled) {
      UIController.getInstance().externalBucketControlsGenerationHandler(UIController.getInstance().playButton, () => {
        if ('promptAudio' in newQuestion) {
          AudioController.PlayAudio(newQuestion.promptAudio, undefined, UIController.ShowAudioAnimation);
        }
      });
    } else {
      UIController.getInstance().playButton.innerHTML =
        "<button id='nextqButton'><img class=audio-button width='100px' height='100px' src='/img/SoundButton_Idle.png' type='image/svg+xml'> </img></button>";

      var nextQuestionButton = document.getElementById('nextqButton');
      nextQuestionButton.addEventListener('click', function () {
        if ('promptAudio' in newQuestion) {
          AudioController.PlayAudio(newQuestion.promptAudio, undefined, UIController.ShowAudioAnimation);
        }
      });
    }

    UIController.getInstance().answersContainer.style.visibility = 'visible';

    let qCode = '';

    UIController.getInstance().questionsContainer.innerHTML = '';

    if (typeof newQuestion == 'undefined') {
      newQuestion = UIController.getInstance().nextQuestion;
    }

    if ('promptImg' in newQuestion) {
      var tmpimg = AudioController.GetImage(newQuestion.promptImg);
      UIController.getInstance().questionsContainer.appendChild(tmpimg);
    }

    qCode += newQuestion.promptText;

    qCode += '<BR>';

    UIController.getInstance().questionsContainer.innerHTML += qCode;

    for (var buttonIndex in UIController.getInstance().buttons) {
      UIController.getInstance().buttons[buttonIndex].style.visibility = 'hidden';
    }
  }

  public static AddStar(): void {
    var starToShow = document.getElementById(
      'star' + UIController.getInstance().stars[UIController.getInstance().qAnsNum]
    ) as HTMLImageElement;
    starToShow.src = '../animation/Star.gif';
    starToShow.classList.add('topstarv');
    starToShow.classList.remove('topstarh');
    starToShow.style.position = 'absolute';
    let containerWidth = UIController.getInstance().starContainer.offsetWidth;
    let containerHeight = UIController.getInstance().starContainer.offsetHeight;
    let randomX = 0;
    let randomY = 0;
    do {
      randomX = Math.floor(Math.random() * (containerWidth - containerWidth * 0.2));
      randomY = Math.floor(Math.random() * containerHeight);
    } while (UIController.OverlappingOtherStars(UIController.instance.starPositions, randomX, randomY, 28));
    const animationSpeedMultiplier = UIController.getInstance().animationSpeedMultiplier;
    // Save these random x and y values, make the star appear in the center of the screen, make it 3 times bigger using scale and slowly transition to the random x and y values
    starToShow.style.transform = 'scale(10)';
    starToShow.style.transition = `top ${1 * animationSpeedMultiplier}s ease, left ${1 * animationSpeedMultiplier}s ease, transform ${0.5 * animationSpeedMultiplier}s ease`;
    starToShow.style.zIndex = '500';
    starToShow.style.top = window.innerHeight / 2 + 'px';
    starToShow.style.left = UIController.instance.gameContainer.offsetWidth / 2 - starToShow.offsetWidth / 2 + 'px';
    setTimeout(() => {
      starToShow.style.transition = `top ${2 * animationSpeedMultiplier}s ease, left ${2 * animationSpeedMultiplier}s ease, transform ${2 * animationSpeedMultiplier}s ease`;
      if (randomX < containerWidth / 2 - 30) {
        // Rotate the star to the right a bit
        const rotation = 5 + Math.random() * 8;
        starToShow.style.transform = 'rotate(-' + rotation + 'deg) scale(1)';
      } else {
        // Rotate the star to the left a bit
        const rotation = 5 + Math.random() * 8;
        starToShow.style.transform = 'rotate(' + rotation + 'deg) scale(1)';
      }
      starToShow.style.left = 10 + randomX + 'px';
      starToShow.style.top = randomY + 'px';
      setTimeout(() => {
        starToShow.style.filter = 'drop-shadow(0px 0px 10px yellow)';
      }, 1900 * animationSpeedMultiplier);
    }, 1000 * animationSpeedMultiplier);
    UIController.instance.starPositions.push({ x: randomX, y: randomY });
    UIController.getInstance().qAnsNum += 1;
    UIController.getInstance().shownStarsCount += 1;
  }

  public static ChangeStarImageAfterAnimation(): void {
    var starToShow = document.getElementById(
      'star' + UIController.getInstance().stars[UIController.getInstance().qAnsNum - 1]
    ) as HTMLImageElement;
    starToShow.src = '../img/star_after_animation.gif';
  }

  private answerButtonPress(buttonNum: number): void {
    const allButtonsVisible = this.buttons.every((button) => button.style.visibility === 'visible');
    if (this.buttonsActive === true) {
      AudioController.PlayDing();
      const nPressed = Date.now();
      const dTime = nPressed - this.qStart;
      this.buttonPressCallback(buttonNum, dTime);
    }
  }

  public static ProgressChest() {
    const chestImage = document.getElementById('chestImage') as HTMLImageElement;
    let currentImgSrc = chestImage.src;
    const currentImageNumber = parseInt(currentImgSrc.slice(-6, -4), 10);
    const nextImageNumber = (currentImageNumber % 4) + 1;
    const nextImageSrc = `img/chestprogression/TreasureChestOpen0${nextImageNumber}.svg`;
    chestImage.src = nextImageSrc;
  }

  public static SetContentLoaded(value: boolean): void {
    UIController.getInstance().contentLoaded = value;
  }

  public static SetButtonPressAction(callback: Function): void {
    UIController.getInstance().buttonPressCallback = callback;
  }

  public static SetStartAction(callback: Function): void {
    UIController.getInstance().startPressCallback = callback;
  }

  public static SetExternalBucketControlsGenerationHandler(
    handler: (container: HTMLElement, clickCallback: () => void) => void
  ): void {
    UIController.getInstance().externalBucketControlsGenerationHandler = handler;
  }

  public static getInstance(): UIController {
    if (UIController.instance === null) {
      UIController.instance = new UIController();
      UIController.instance.init();
    }

    return UIController.instance;
  }
}
