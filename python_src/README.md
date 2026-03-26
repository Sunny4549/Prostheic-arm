# EMG-Based Virtual Prosthetic Hand Simulation

A real-time system that reads EMG signals, predicts finger movements using a trained ML model, and visualizes the result as an animated virtual hand using Pygame.

## Requirements

- Python 3.8+
- Arduino (optional, can use mock data mode)

## Installation

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. (Optional) Place your trained model `emg_model.pkl` in the same directory. If not present, the system will use a heuristic fallback model for demonstration.

## Running the Simulation

```bash
python main.py
```

## Controls

- `K`: Toggle Keyboard Mode (overrides EMG data)
- `1`: Bend Index Finger (Keyboard Mode)
- `2`: Bend Middle Finger (Keyboard Mode)
- `3`: Bend Thumb (Keyboard Mode)
- `4`: Grip (Keyboard Mode)
- `0`: Rest (Keyboard Mode)
- `ESC`: Exit

## Architecture

- `main.py`: Entry point, ties components together.
- `serial_reader.py`: Handles threaded serial communication with Arduino.
- `model.py`: Loads scikit-learn model and makes predictions.
- `simulation.py`: Pygame rendering logic for the animated hand and graphs.
