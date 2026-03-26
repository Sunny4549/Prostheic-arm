import os
import joblib
import numpy as np

class EMGModel:
    def __init__(self, model_path='emg_model.pkl'):
        self.model_path = model_path
        self.model = None
        self.labels = ["index", "middle", "thumb", "grip", "rest"]
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                print(f"Model loaded from {self.model_path}")
            except Exception as e:
                print(f"Error loading model: {e}")
                self.model = None
        else:
            print(f"Model file {self.model_path} not found. Using heuristic fallback.")
            self.model = None

    def predict(self, emg_data):
        """
        Predicts the hand movement based on 3-channel EMG data.
        emg_data: list of 3 integers [ch1, ch2, ch3]
        Returns: string label and confidence score
        """
        if not emg_data or len(emg_data) != 3:
            return "rest", 0.0

        if self.model:
            try:
                # Reshape for sklearn model
                data_array = np.array(emg_data).reshape(1, -1)
                prediction = self.model.predict(data_array)[0]
                
                # If model supports predict_proba
                confidence = 1.0
                if hasattr(self.model, "predict_proba"):
                    proba = self.model.predict_proba(data_array)[0]
                    confidence = np.max(proba)
                    
                return prediction, confidence
            except Exception as e:
                print(f"Prediction error: {e}")
                return "rest", 0.0
        else:
            # Heuristic fallback for demonstration without a real model
            ch1, ch2, ch3 = emg_data
            threshold = 600
            
            if ch1 > threshold and ch2 > threshold and ch3 > threshold:
                return "grip", 0.85
            elif ch1 > threshold:
                return "thumb", 0.75
            elif ch2 > threshold:
                return "index", 0.75
            elif ch3 > threshold:
                return "middle", 0.75
            else:
                return "rest", 0.90
