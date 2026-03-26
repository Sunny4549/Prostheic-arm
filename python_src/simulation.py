import pygame
import math

# Colors
BG_COLOR = (30, 30, 30)
PALM_COLOR = (200, 150, 120)
FINGER_COLOR = (220, 170, 140)
JOINT_COLOR = (180, 120, 90)
TEXT_COLOR = (255, 255, 255)
GRAPH_COLORS = [(255, 100, 100), (100, 255, 100), (100, 100, 255)]

class Finger:
    def __init__(self, name, base_pos, length, width, base_angle):
        self.name = name
        self.base_pos = base_pos
        self.length = length
        self.width = width
        self.base_angle = base_angle  # Angle relative to palm
        
        # 3 segments per finger (except thumb which has 2 main ones, but we'll use 3 for simplicity)
        self.segments = 3
        self.segment_length = length / self.segments
        
        # Current bend angles for each joint (0 = straight, 90 = fully bent)
        self.target_bend = 0.0
        self.current_bend = 0.0
        self.bend_speed = 5.0  # Degrees per frame

    def update(self):
        # Interpolate towards target bend
        if self.current_bend < self.target_bend:
            self.current_bend = min(self.current_bend + self.bend_speed, self.target_bend)
        elif self.current_bend > self.target_bend:
            self.current_bend = max(self.current_bend - self.bend_speed, self.target_bend)

    def draw(self, surface):
        current_pos = self.base_pos
        current_angle = self.base_angle
        
        for i in range(self.segments):
            # Each joint bends a bit more
            joint_angle = current_angle + (self.current_bend * (i + 1) / self.segments)
            
            # Calculate end position of this segment
            rad_angle = math.radians(joint_angle)
            end_x = current_pos[0] + math.cos(rad_angle) * self.segment_length
            end_y = current_pos[1] - math.sin(rad_angle) * self.segment_length  # -sin because y goes down
            end_pos = (end_x, end_y)
            
            # Draw segment
            pygame.draw.line(surface, FINGER_COLOR, current_pos, end_pos, self.width)
            # Draw joint
            pygame.draw.circle(surface, JOINT_COLOR, (int(current_pos[0]), int(current_pos[1])), self.width // 2 + 2)
            
            current_pos = end_pos
            current_angle = joint_angle
            
        # Draw fingertip
        pygame.draw.circle(surface, FINGER_COLOR, (int(current_pos[0]), int(current_pos[1])), self.width // 2)

class HandSimulation:
    def __init__(self, width=800, height=600):
        pygame.init()
        self.width = width
        self.height = height
        self.screen = pygame.display.set_mode((width, height))
        pygame.display.set_caption("EMG Virtual Prosthetic Hand")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("Arial", 24)
        self.large_font = pygame.font.SysFont("Arial", 36, bold=True)
        
        # Hand setup
        self.palm_center = (width // 2, height // 2 + 100)
        self.palm_radius = 60
        
        # Initialize fingers (name, base_pos, length, width, base_angle)
        self.fingers = {
            "thumb": Finger("thumb", (self.palm_center[0] - 50, self.palm_center[1] + 20), 80, 20, 140),
            "index": Finger("index", (self.palm_center[0] - 30, self.palm_center[1] - 50), 100, 18, 105),
            "middle": Finger("middle", (self.palm_center[0], self.palm_center[1] - 60), 110, 18, 90),
            "ring": Finger("ring", (self.palm_center[0] + 30, self.palm_center[1] - 50), 100, 18, 75),
            "pinky": Finger("pinky", (self.palm_center[0] + 50, self.palm_center[1] - 30), 80, 16, 60)
        }
        
        # Graph history
        self.history_length = 100
        self.emg_history = [[0]*self.history_length for _ in range(3)]

    def set_movement(self, movement):
        # Reset all
        for f in self.fingers.values():
            f.target_bend = 0.0
            
        # Apply specific bends
        if movement == "grip":
            for f in self.fingers.values():
                f.target_bend = 80.0
        elif movement == "index":
            self.fingers["index"].target_bend = 80.0
        elif movement == "middle":
            self.fingers["middle"].target_bend = 80.0
        elif movement == "thumb":
            self.fingers["thumb"].target_bend = 60.0
        # "rest" leaves all at 0.0

    def update_graph(self, emg_data):
        for i in range(3):
            self.emg_history[i].pop(0)
            self.emg_history[i].append(emg_data[i])

    def draw_graph(self):
        graph_rect = pygame.Rect(20, self.height - 120, 300, 100)
        pygame.draw.rect(self.screen, (50, 50, 50), graph_rect)
        pygame.draw.rect(self.screen, (100, 100, 100), graph_rect, 2)
        
        for i in range(3):
            points = []
            for j, val in enumerate(self.emg_history[i]):
                x = graph_rect.x + (j / self.history_length) * graph_rect.width
                # Scale value (assuming max 1023)
                y = graph_rect.bottom - (val / 1024.0) * graph_rect.height
                points.append((x, y))
            if len(points) > 1:
                pygame.draw.lines(self.screen, GRAPH_COLORS[i], False, points, 2)

    def render(self, current_movement, confidence, emg_data, fps):
        self.screen.fill(BG_COLOR)
        
        # Update and draw fingers
        for f in self.fingers.values():
            f.update()
            f.draw(self.screen)
            
        # Draw palm
        pygame.draw.circle(self.screen, PALM_COLOR, self.palm_center, self.palm_radius)
        
        # Draw wrist
        pygame.draw.rect(self.screen, PALM_COLOR, (self.palm_center[0] - 40, self.palm_center[1] + 20, 80, 100))
        
        # Draw UI text
        mov_text = self.large_font.render(f"Prediction: {current_movement.upper()}", True, TEXT_COLOR)
        conf_text = self.font.render(f"Confidence: {confidence:.2f}", True, TEXT_COLOR)
        emg_text = self.font.render(f"EMG: {emg_data}", True, TEXT_COLOR)
        fps_text = self.font.render(f"FPS: {int(fps)}", True, TEXT_COLOR)
        
        self.screen.blit(mov_text, (20, 20))
        self.screen.blit(conf_text, (20, 60))
        self.screen.blit(emg_text, (20, 90))
        self.screen.blit(fps_text, (self.width - 100, 20))
        
        # Draw Graph
        self.draw_graph()
        
        pygame.display.flip()
