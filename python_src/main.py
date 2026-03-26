import pygame
import sys
from serial_reader import SerialReader
from model import EMGModel
from simulation import HandSimulation

def main():
    print("Starting EMG Virtual Prosthetic Hand Simulation...")
    
    # Initialize components
    # Set use_mock=True to test without Arduino
    reader = SerialReader(port='COM3', baudrate=9600, use_mock=True) 
    reader.connect()
    reader.start()
    
    model = EMGModel(model_path='emg_model.pkl')
    sim = HandSimulation(width=800, height=600)
    
    running = True
    keyboard_mode = False
    manual_movement = "rest"
    
    while running:
        # 1. Handle Events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                elif event.key == pygame.K_k:
                    keyboard_mode = not keyboard_mode
                    print(f"Keyboard mode: {'ON' if keyboard_mode else 'OFF'}")
                
                # Keyboard overrides
                if keyboard_mode:
                    if event.key == pygame.K_1: manual_movement = "index"
                    elif event.key == pygame.K_2: manual_movement = "middle"
                    elif event.key == pygame.K_3: manual_movement = "thumb"
                    elif event.key == pygame.K_4: manual_movement = "grip"
                    elif event.key == pygame.K_0: manual_movement = "rest"

        # 2. Get Data
        emg_data = reader.get_data()
        sim.update_graph(emg_data)
        
        # 3. Predict Movement
        if keyboard_mode:
            movement = manual_movement
            confidence = 1.0
        else:
            movement, confidence = model.predict(emg_data)
            
        # 4. Update Simulation
        sim.set_movement(movement)
        
        # 5. Render
        fps = sim.clock.get_fps()
        sim.render(movement, confidence, emg_data, fps)
        
        # Maintain ~60 FPS
        sim.clock.tick(60)

    # Cleanup
    reader.stop()
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()
