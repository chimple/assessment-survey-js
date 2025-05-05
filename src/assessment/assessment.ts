//this is where the logic for handling the buckets will go
//
//once we start adding in the assessment functionality
import { UIController } from '../ui/uiController';
import { qData, answerData } from '../components/questionData';
import { AnalyticsEvents } from '../analytics/analyticsEvents';
import { App } from '../App';
import { bucket, bucketItem } from './bucketData';
import { BaseQuiz } from '../baseQuiz';
import { fetchAssessmentBuckets } from '../utils/jsonUtils';
import { TreeNode, sortedArrayToIDsBST } from '../components/tNode';
import { MathUtils, randFrom, shuffleArray } from '../utils/mathUtils';
import { AudioController } from '../components/audioController';

enum searchStage {
  BinarySearch,
  LinearSearchUp,
  LinearSearchDown,
}

enum BucketGenMode {
  RandomBST,
  LinearArrayBased,
}

export class Assessment extends BaseQuiz {
  public unityBridge;

  public currentNode: TreeNode;
  public currentQuestion: qData;
  public bucketArray: number[];
  public questionNumber: number;

  public buckets: bucket[];
  public currentBucket: bucket;
  public numBuckets: number;
  public basalBucket: number;
  public ceilingBucket: number;

  public currentLinearBucketIndex: number;
  public currentLinearTargetIndex: number;

  protected bucketGenMode: BucketGenMode = BucketGenMode.RandomBST;

  private MAX_STARS_COUNT_IN_LINEAR_MODE = 20;

  constructor(dataURL: string, unityBridge: any) {
    super();
    this.dataURL = dataURL;
    this.unityBridge = unityBridge;
    this.questionNumber = 0;
    console.log('app initialized');
    this.setupUIHandlers();
  }
  private setupUIHandlers(): void {
    UIController.SetButtonPressAction(this.handleAnswerButtonPress);
    UIController.SetStartAction(this.startAssessment);
    UIController.SetExternalBucketControlsGenerationHandler(this.generateDevModeBucketControlsInContainer);
  }
  public Run(applink: App): void {
    this.app = applink;
    this.buildBuckets(this.bucketGenMode).then((result) => {
      console.log(this.currentBucket);
      this.unityBridge.SendLoaded();
    });
  }

  public handleBucketGenModeChange(event: Event): void {
    // TODO: Implement handleBucketGenModeChange
    this.bucketGenMode = parseInt(this.devModeBucketGenSelect.value) as BucketGenMode;
    this.buildBuckets(this.bucketGenMode).then(() => {
      // Finished building buckets
    });
    this.updateBucketInfo();
  }

  public handleCorrectLabelShownChange(): void {
    UIController.getInstance().SetCorrectLabelVisibility(this.isCorrectLabelShown);
  }

  public handleAnimationSpeedMultiplierChange(): void {
    UIController.getInstance().SetAnimationSpeedMultiplier(this.animationSpeedMultiplier);
  }

  public handleBucketInfoShownChange(): void {
    this.updateBucketInfo();
  }

  public handleBucketControlsShownChange(): void {
    UIController.getInstance().SetBucketControlsVisibility(this.isBucketControlsEnabled);
  }

  public generateDevModeBucketControlsInContainer = (container: HTMLElement, clickHandler: () => void) => {
    if (this.isInDevMode && this.bucketGenMode === BucketGenMode.LinearArrayBased) {
      // Create buttons for the current bucket items, that are clickable and will trigger the item audio
      // Add 2 buttons, one for moving up and one for moving down the bucket tree
      // Empty the container before adding new buttons
      container.innerHTML = '';
      for (let i = 0; i < this.currentBucket.items.length; i++) {
        let item = this.currentBucket.items[i];
        let itemButton = document.createElement('button');
        let index = i;
        itemButton.innerText = item.itemName;
        itemButton.style.margin = '2px';
        itemButton.onclick = () => {
          this.currentLinearTargetIndex = index;
          this.currentBucket.usedItems = [];
          console.log('Clicked on item ' + item.itemName + ' at index ' + this.currentLinearTargetIndex);
          // UIController.ReadyForNext(this.buildNewQuestion(), false);
          const newQ = this.buildNewQuestion();
          UIController.getInstance().answersContainer.style.visibility = 'hidden';
          for (let b in UIController.getInstance().buttons) {
            UIController.getInstance().buttons[b].style.visibility = 'hidden';
          }
          UIController.getInstance().shown = false;
          UIController.getInstance().nextQuestion = newQ;
          UIController.getInstance().questionsContainer.innerHTML = '';
          UIController.getInstance().questionsContainer.style.display = 'none';
          UIController.ShowQuestion(newQ);
          AudioController.PlayAudio(
            this.buildNewQuestion().promptAudio,
            UIController.getInstance().showOptions,
            UIController.ShowAudioAnimation
          );
          // clickHandler();
        };
        container.append(itemButton);
      }
      // Create 2 more buttons for moving up and down the bucket tree
      let prevButton = document.createElement('button');
      prevButton.innerText = 'Prev Bucket';
      if (this.currentLinearBucketIndex == 0) {
        prevButton.disabled = true;
      }
      prevButton.addEventListener('click', () => {
        if (this.currentLinearBucketIndex > 0) {
          this.currentLinearBucketIndex--;
          this.currentLinearTargetIndex = 0;
          this.tryMoveBucket(false);
          UIController.ReadyForNext(this.buildNewQuestion());
          this.updateBucketInfo();
        }
        if (this.currentLinearBucketIndex == 0) {
          prevButton.disabled = true;
        }
      });
      let nextButton = document.createElement('button');
      nextButton.innerText = 'Next Bucket';
      if (this.currentLinearBucketIndex == this.buckets.length - 1) {
        nextButton.disabled = true;
      }
      nextButton.addEventListener('click', () => {
        if (this.currentLinearBucketIndex < this.buckets.length - 1) {
          this.currentLinearBucketIndex++;
          this.currentLinearTargetIndex = 0;
          this.tryMoveBucket(false);
          UIController.ReadyForNext(this.buildNewQuestion());
          this.updateBucketInfo();
        }
      });

      // Append the buttons to the container
      let buttonsContainer = document.createElement('div');
      buttonsContainer.style.display = 'flex';
      buttonsContainer.style.flexDirection = 'row';
      buttonsContainer.style.justifyContent = 'center';
      buttonsContainer.style.alignItems = 'center';
      buttonsContainer.appendChild(prevButton);
      buttonsContainer.appendChild(nextButton);

      container.appendChild(buttonsContainer);
    }
  };

  public updateBucketInfo = () => {
    if (this.currentBucket != null) {
      this.devModeBucketInfoContainer.innerHTML = `Bucket: ${this.currentBucket.bucketID}<br/>Correct: ${this.currentBucket.numCorrect}<br/>Tried: ${this.currentBucket.numTried}<br/>Failed: ${this.currentBucket.numConsecutiveWrong}`;
    }
  };

  public startAssessment = () => {
    MathUtils.duration = Date.now();
    MathUtils.wrongMove = 0;
    MathUtils.correctMove = 0;

    UIController.ReadyForNext(this.buildNewQuestion());
    if (this.isInDevMode) {
      this.hideDevModeButton();
    }
  };

  public buildBuckets = async (bucketGenMode: BucketGenMode) => {
    // If we don't have the buckets loaded, load them and initialize the current node, which is the starting point
    if (this.buckets === undefined || this.buckets.length === 0) {
      const res = fetchAssessmentBuckets(this.app.GetDataURL()).then((result) => {
        this.buckets = result;
        this.numBuckets = result.length;
        console.log('buckets: ' + this.buckets);
        this.bucketArray = Array.from(Array(this.numBuckets), (_, i) => i + 1);
        console.log('empty array ' + this.bucketArray);
        let usedIndices = new Set<number>();
        usedIndices.add(0);
        let rootOfIDs = sortedArrayToIDsBST(
          this.buckets[0].bucketID - 1,
          this.buckets[this.buckets.length - 1].bucketID,
          usedIndices
        );
        // console.log("Generated the buckets root ----------------------------------------------");
        // console.log(rootOfIDs);
        let bucketsRoot = this.convertToBucketBST(rootOfIDs, this.buckets);
        console.log('Generated the buckets root ----------------------------------------------');
        console.log(bucketsRoot);
        this.basalBucket = this.numBuckets + 1;
        this.ceilingBucket = -1;
        this.currentNode = bucketsRoot;
        this.tryMoveBucket(false);
      });
      return res;
    } else {
      if (bucketGenMode === BucketGenMode.RandomBST) {
        // If we have the buckets loaded, we can initialize the current node, which is the starting point
        return new Promise<void>((resolve, reject) => {
          let usedIndices = new Set<number>();
          usedIndices.add(0);
          let rootOfIDs = sortedArrayToIDsBST(
            this.buckets[0].bucketID - 1,
            this.buckets[this.buckets.length - 1].bucketID,
            usedIndices
          );
          // console.log("Generated the buckets root ----------------------------------------------");
          // console.log(rootOfIDs);
          let bucketsRoot = this.convertToBucketBST(rootOfIDs, this.buckets);
          console.log('Generated the buckets root ----------------------------------------------');
          console.log(bucketsRoot);
          this.basalBucket = this.numBuckets + 1;
          this.ceilingBucket = -1;
          this.currentNode = bucketsRoot;
          this.tryMoveBucket(false);
          resolve();
        });
      } else if (bucketGenMode === BucketGenMode.LinearArrayBased) {
        return new Promise<void>((resolve, reject) => {
          this.currentLinearBucketIndex = 0;
          this.currentLinearTargetIndex = 0;
          this.tryMoveBucket(false);
          resolve();
        });
      }
    }
  };

  /**
   * Converts a binary search tree of numbers to a binary search tree of bucket objects
   * @param node Is a root node of a binary search tree
   * @param buckets Is an array of bucket objects
   * @returns A root node of a binary search tree where the value of each node is a bucket object
   */
  public convertToBucketBST = (node: TreeNode, buckets: bucket[]) => {
    // Traverse each element take the value and find that bucket in the buckets array and assign that bucket instead of the number value
    if (node === null) return node;

    let bucketId = node.value;
    node.value = buckets.find((bucket) => bucket.bucketID === bucketId);
    if (node.left !== null) node.left = this.convertToBucketBST(node.left, buckets);
    if (node.right !== null) node.right = this.convertToBucketBST(node.right, buckets);

    return node;
  };

  public initBucket = (bucket: bucket) => {
    this.currentBucket = bucket;
    this.currentBucket.usedItems = [];
    this.currentBucket.numTried = 0;
    this.currentBucket.numCorrect = 0;
    this.currentBucket.numConsecutiveWrong = 0;
    this.currentBucket.tested = true;
    this.currentBucket.passed = false;
  };

  public handleAnswerButtonPress = (answer: number, elapsed: number) => {
    if (this.bucketGenMode === BucketGenMode.RandomBST) {
      AnalyticsEvents.sendAnswered(this.currentQuestion, answer, elapsed);
    }
    this.updateCurrentBucketValuesAfterAnswering(answer);
    this.updateFeedbackAfterAnswer(answer);

    setTimeout(() => {
      console.log('Completed first Timeout');
      this.onQuestionEnd();
    }, 2000 * this.animationSpeedMultiplier);
  };

  private updateFeedbackAfterAnswer(answer: number) {
    if (
      this.bucketGenMode === BucketGenMode.LinearArrayBased &&
      UIController.getInstance().shownStarsCount < this.MAX_STARS_COUNT_IN_LINEAR_MODE
    ) {
      UIController.AddStar();
    } else if (this.bucketGenMode === BucketGenMode.RandomBST) {
      UIController.AddStar();
    }
    UIController.SetFeedbackVisibile(
      true,
      this.currentQuestion.answers[answer - 1].answerName == this.currentQuestion.correct
    );
  }
  private updateCurrentBucketValuesAfterAnswering(answer: number) {
    this.currentBucket.numTried += 1;
    if (this.currentQuestion.answers[answer - 1].answerName == this.currentQuestion.correct) {
      this.currentBucket.numCorrect += 1;
      this.currentBucket.numConsecutiveWrong = 0;
      MathUtils.correctMove += 1;
      console.log('Answered correctly');
    } else {
      MathUtils.wrongMove += 1;
      this.currentBucket.numConsecutiveWrong += 1;
      console.log('Answered incorrectly, ' + this.currentBucket.numConsecutiveWrong);
    }
  }
  public onQuestionEnd = () => {
    let questionEndTimeout = this.HasQuestionsLeft()
      ? 500 * this.animationSpeedMultiplier
      : 4000 * this.animationSpeedMultiplier;

    const endOperations = () => {
      UIController.SetFeedbackVisibile(false, false);
      if (
        this.bucketGenMode === BucketGenMode.LinearArrayBased &&
        UIController.getInstance().shownStarsCount < this.MAX_STARS_COUNT_IN_LINEAR_MODE
      ) {
        UIController.ChangeStarImageAfterAnimation();
      } else if (this.bucketGenMode === BucketGenMode.RandomBST) {
        UIController.ChangeStarImageAfterAnimation();
      }
      if (this.HasQuestionsLeft()) {
        if (this.bucketGenMode === BucketGenMode.LinearArrayBased && !this.isBucketControlsEnabled) {
          if (this.currentLinearTargetIndex < this.buckets[this.currentLinearBucketIndex].items.length) {
            this.currentLinearTargetIndex++;
            // We need to reset the used items array when we move to the next question in linear mode
            this.currentBucket.usedItems = [];
          }

          if (
            this.currentLinearTargetIndex >= this.buckets[this.currentLinearBucketIndex].items.length &&
            this.currentLinearBucketIndex < this.buckets.length
          ) {
            this.currentLinearBucketIndex++;
            this.currentLinearTargetIndex = 0;
            if (this.currentLinearBucketIndex < this.buckets.length) {
              this.tryMoveBucket(false);
            } else {
              console.log('No questions left');
              this.onEnd();
              return;
            }
          }
        }

        UIController.ReadyForNext(this.buildNewQuestion());
      } else {
        console.log('No questions left');
        this.onEnd();
      }
    };

    // Create a promise that resolves after the specified timeout
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, questionEndTimeout);
    });

    // Execute endOperations after timeoutPromise resolves
    timeoutPromise.then(() => {
      endOperations();

      // Completed end operations, should update bucket info if in dev mode
      if (this.isInDevMode) {
        this.updateBucketInfo();
      }
    });
  };
  public buildNewQuestion = () => {
    if (this.isLinearArrayExhausted()) {
      return null;
    }

    const targetItem = this.selectTargetItem();
    const foils = this.generateFoils(targetItem);
    const answerOptions = this.shuffleAnswerOptions([targetItem, ...foils]);

    const newQuestion = this.createQuestion(targetItem, answerOptions);
    this.currentQuestion = newQuestion;
    this.questionNumber += 1;

    return newQuestion;
  };

  private isLinearArrayExhausted = (): boolean => {
    return (
      this.bucketGenMode === BucketGenMode.LinearArrayBased &&
      this.currentLinearTargetIndex >= this.buckets[this.currentLinearBucketIndex].items.length
    );
  };

  private selectTargetItem = (): any => {
    let targetItem;

    if (this.bucketGenMode === BucketGenMode.RandomBST) {
      targetItem = this.selectRandomUnusedItem();
    } else if (this.bucketGenMode === BucketGenMode.LinearArrayBased) {
      targetItem = this.buckets[this.currentLinearBucketIndex].items[this.currentLinearTargetIndex];
      this.currentBucket.usedItems.push(targetItem);
    }

    return targetItem;
  };

  private selectRandomUnusedItem = (): any => {
    let item;
    do {
      item = randFrom(this.currentBucket.items);
    } while (this.currentBucket.usedItems.includes(item));

    this.currentBucket.usedItems.push(item);
    return item;
  };

  private generateFoils = (targetItem: any): any[] => {
    let foil1, foil2, foil3;

    if (this.bucketGenMode === BucketGenMode.RandomBST) {
      foil1 = this.generateRandomFoil(targetItem);
      foil2 = this.generateRandomFoil(targetItem, foil1);
      foil3 = this.generateRandomFoil(targetItem, foil1, foil2);
    } else if (this.bucketGenMode === BucketGenMode.LinearArrayBased) {
      foil1 = this.generateLinearFoil(targetItem);
      foil2 = this.generateLinearFoil(targetItem, foil1);
      foil3 = this.generateLinearFoil(targetItem, foil1, foil2);
    }

    return [foil1, foil2, foil3];
  };

  private generateRandomFoil = (targetItem: any, ...existingFoils: any[]): any => {
    let foil;
    do {
      foil = randFrom(this.currentBucket.items);
    } while ([targetItem, ...existingFoils].includes(foil));
    return foil;
  };

  private generateLinearFoil = (targetItem: any, ...existingFoils: any[]): any => {
    let foil;
    do {
      foil = randFrom(this.buckets[this.currentLinearBucketIndex].items);
    } while ([targetItem, ...existingFoils].includes(foil));
    return foil;
  };

  private shuffleAnswerOptions = (options: any[]): any[] => {
    shuffleArray(options);
    return options;
  };

  private createQuestion = (targetItem: any, answerOptions: any[]): any => {
    return {
      qName: `question-${this.questionNumber}-${targetItem.itemName}`,
      qNumber: this.questionNumber,
      qTarget: targetItem.itemName,
      promptText: '',
      bucket: this.currentBucket.bucketID,
      promptAudio: targetItem.itemName,
      correct: targetItem.itemText,
      answers: answerOptions.map((option) => ({
        answerName: option.itemName,
        answerText: option.itemText,
      })),
    };
  };

  public tryMoveBucket = (passed: boolean) => {
    if (this.bucketGenMode === BucketGenMode.RandomBST) {
      this.tryMoveBucketRandomBST(passed);
    } else if (this.bucketGenMode === BucketGenMode.LinearArrayBased) {
      this.tryMoveBucketLinearArrayBased(passed);
    }
  };

  public tryMoveBucketRandomBST = (passed: boolean) => {
    const newBucket = this.currentNode.value as bucket;
    if (this.currentBucket != null) {
      this.currentBucket.passed = passed;
      AnalyticsEvents.sendBucket(this.currentBucket, passed);
    }
    console.log('new  bucket is ' + newBucket.bucketID);
    AudioController.PreloadBucket(newBucket, this.app.GetDataURL());
    this.initBucket(newBucket);
  };

  public tryMoveBucketLinearArrayBased = (passed: boolean) => {
    const newBucket = this.buckets[this.currentLinearBucketIndex];
    // Avoid passing bucketPassed event to the analytics when we are in linear dev mode
    // if (this.currentBucket != null) {
    // 	this.currentBucket.passed = passed;
    // 	AnalyticsEvents.sendBucket(this.currentBucket, passed);
    // }
    console.log('New Bucket: ' + newBucket.bucketID);
    AudioController.PreloadBucket(newBucket, this.app.GetDataURL());
    this.initBucket(newBucket);
  };

  public HasQuestionsLeft = () => {
    if (this.currentBucket.passed) return false;

    if (this.bucketGenMode === BucketGenMode.LinearArrayBased) {
      return this.hasLinearQuestionsLeft();
    }

    if (this.currentBucket.numCorrect >= 4) {
      return this.handlePassedBucket();
    } else if (this.currentBucket.numConsecutiveWrong >= 2 || this.currentBucket.numTried >= 5) {
      return this.handleFailedBucket();
    }

    return true;
  };

  private hasLinearQuestionsLeft = (): boolean => {
    if (
      this.currentLinearBucketIndex >= this.buckets.length &&
      this.currentLinearTargetIndex >= this.buckets[this.currentLinearBucketIndex].items.length
    ) {
      // No more questions left
      return false;
    } else {
      return true;
    }
  };

  private handlePassedBucket = (): boolean => {
    console.log('Passed this bucket ' + this.currentBucket.bucketID);

    if (this.currentBucket.bucketID >= this.numBuckets) {
      // Passed the highest bucket
      return this.passHighestBucket();
    } else {
      return this.moveUpToNextBucket();
    }
  };

  private handleFailedBucket = (): boolean => {
    console.log('Failed this bucket ' + this.currentBucket.bucketID);

    if (this.currentBucket.bucketID < this.basalBucket) {
      this.basalBucket = this.currentBucket.bucketID;
    }

    if (this.currentBucket.bucketID <= 1) {
      // Failed the lowest bucket
      return this.failLowestBucket();
    } else {
      return this.moveDownToPreviousBucket();
    }
  };

  private passHighestBucket = (): boolean => {
    console.log('Passed highest bucket');
    this.currentBucket.passed = true;

    if (this.bucketGenMode === BucketGenMode.RandomBST) {
      AnalyticsEvents.sendBucket(this.currentBucket, true);
    }

    UIController.ProgressChest();
    return false;
  };

  private moveUpToNextBucket = (): boolean => {
    if (this.currentNode.right != null) {
      // Move down to the right
      console.log('Moving to right node');
      if (this.bucketGenMode === BucketGenMode.RandomBST) {
        this.currentNode = this.currentNode.right;
      } else {
        this.currentLinearBucketIndex++;
      }
      this.tryMoveBucket(true);
    } else {
      // Reached root node
      console.log('Reached root node');
      this.currentBucket.passed = true;

      if (this.bucketGenMode === BucketGenMode.RandomBST) {
        AnalyticsEvents.sendBucket(this.currentBucket, true);
      }

      UIController.ProgressChest();
      return false;
    }

    return true;
  };

  private failLowestBucket = (): boolean => {
    console.log('Failed lowest bucket !');
    this.currentBucket.passed = false;

    if (this.bucketGenMode === BucketGenMode.RandomBST) {
      AnalyticsEvents.sendBucket(this.currentBucket, false);
    }

    return false;
  };

  private moveDownToPreviousBucket = (): boolean => {
    console.log('Moving down bucket !');

    if (this.currentNode.left != null) {
      // Move down to the left
      console.log('Moving to left node');
      if (this.bucketGenMode === BucketGenMode.RandomBST) {
        this.currentNode = this.currentNode.left;
      } else {
        this.currentLinearBucketIndex++;
      }
      this.tryMoveBucket(false);
    } else {
      // Reached root node
      console.log('Reached root node !');
      this.currentBucket.passed = false;

      if (this.bucketGenMode === BucketGenMode.RandomBST) {
        AnalyticsEvents.sendBucket(this.currentBucket, false);
      }

      return false;
    }

    return true;
  };

  public override onEnd(): void {
    AnalyticsEvents.sendFinished(this.buckets, this.basalBucket, this.ceilingBucket);
    UIController.ShowEnd();
    this.app.unityBridge.SendClose();
  }
}
