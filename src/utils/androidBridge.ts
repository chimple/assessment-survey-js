import { AnalyticsEvents } from '../analytics/analyticsEvents';
import { logEvent } from 'firebase/analytics';

//**************** Android bridge interface and declarations */
interface AndroidBridge {
  sendDataToContainer: (key: string, data: any) => void; // Method to send data to Android container
  requestDataFromContainer: (data: any) => any; // Method to request data from Android container
  sendAssessmentInfoToJS: () => void; // Method to request assessment data from Android
  sendUserInfoToJS: () => void; // Method to request user information from Android
  // Add more methods as needed for the JavaScript interface from Android
}

export interface LevelCompletedEvent {
    right_moves: number,
    wrong_moves: number,
    success_or_failure: string;
    level_number: string;
    number_of_successful_puzzles: number;
    duration: number;
    score: number;
}  

declare global {
  interface Window {
    Android?: AndroidBridge;
  }
}

type CallbackMap = {
  [key: string]: (data: any) => void;
};

const _callbacks: CallbackMap = {};

export const AndroidBridge = {
  sendDataToContainer(key: string, data: any) {
    try {
      console.log(`Attempting to send ${key} to container:`, JSON.stringify(data));
      if (window.Android?.sendDataToContainer) {
        // Stringify the data before sending to avoid [object Object] issues
        const jsonData = typeof data === 'object' ? JSON.stringify(data) : data;
        window.Android.sendDataToContainer(key, jsonData);
      } else {
        console.warn("Android bridge not available: sendDataToContainer");
      }
    } catch (error) {
      console.error("Error sending data to container:", error);
    }
  },

  requestDataFromContainer(type: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (window.Android?.requestDataFromContainer) {
        _callbacks[type] = resolve; // Store callback by type
        window.Android.requestDataFromContainer(type);
      } else {
        reject("Android bridge not available");
      }
    });
  },

  requestAssessmentInfo(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (window.Android?.sendAssessmentInfoToJS) {
          // Store the callback in the _callbacks map
          _callbacks["assessmentInfo"] = resolve;
          
          // Request the assessment info from Android
          window.Android.sendAssessmentInfoToJS();
        } else {
          reject("Android bridge not available: sendAssessmentInfoToJS");
        }
      } catch (error) {
        reject(error);
      }
    });
  },

  requestUserInfo(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (window.Android?.sendUserInfoToJS) {
          // Store the callback in the _callbacks map
          _callbacks["userInfo"] = resolve;
          
          // Request the user info from Android
          window.Android.sendUserInfoToJS();
        } else {
          reject("Android bridge not available: sendUserInfoToJS");
        }
      } catch (error) {
        reject(error);
      }
    });
  },

  sendAssessmentResults(results: any) {
    try {
      this.sendDataToContainer("assessmentResults", results);
      
      // Send an analytics event with the assessment results
      if (results && typeof results === 'object') {
        // Use a simpler approach that doesn't rely on protected properties
        logEvent(null, 'assessment_results', {
          type: 'assessment_results',
          data: results
        });
      }
    } catch (error) {
      console.error("Error sending assessment results:", error);
    }
  },

  _handleDataFromAndroid(responseJson: string) {
    try {
      const data = JSON.parse(responseJson);
      const type = data?.type;

      // Handle assessment info specifically
      if (type === "assessmentInfo" && data.data) {
        this._handleAssessmentInfo(data);
        return;
      }

      // Handle user info specifically
      if (type === "userInfo" && data.data) {
        this._handleUserInfo(data);
        return;
      }

      if (type && _callbacks[type]) {
        _callbacks[type](data); // Resolve the Promise
        delete _callbacks[type]; // Clean up after resolving
      } else {
        console.warn("No callback found for type:", type);
      }
    } catch (e) {
      console.error("Failed to parse data from Android:", e);
    }
  },

  _handleAssessmentInfo(data: any) {
    try {
      if (data && data.data) {
        const assessmentInfo = data.data;
        
        // Save to localStorage
        localStorage.setItem("assessmentInfo", JSON.stringify(assessmentInfo));
        
        console.log("Received and saved assessment info from Android:", assessmentInfo);
        
        // Use the callback system
        if (_callbacks["assessmentInfo"]) {
          _callbacks["assessmentInfo"](assessmentInfo);
          delete _callbacks["assessmentInfo"];
        }
      }
    } catch (e) {
      console.error("Failed to process assessment info from Android:", e);
    }
  },

  _handleUserInfo(data: any) {
    try {
      if (data && data.data) {
        const userInfo = data.data;
        
        // Save to localStorage
        localStorage.setItem("userInfo", JSON.stringify(userInfo));
        
        console.log("Received and saved user info from Android:", userInfo);
        
        // Use the callback system
        if (_callbacks["userInfo"]) {
          _callbacks["userInfo"](userInfo);
          delete _callbacks["userInfo"];
        }
      }
    } catch (e) {
      console.error("Failed to process user info from Android:", e);
    }
  }
};

// Add this to the window to allow Android to call _handleDataFromAndroid
(window as any).handleDataFromAndroid = (responseJson: string) => {
  AndroidBridge._handleDataFromAndroid(responseJson);
};