import serial
import time
import random
import threading

class SerialReader:
    def __init__(self, port='COM3', baudrate=9600, use_mock=False):
        self.port = port
        self.baudrate = baudrate
        self.use_mock = use_mock
        self.serial_conn = None
        self.running = False
        self.latest_data = [0, 0, 0]
        self.lock = threading.Lock()
        self.connected = False

    def connect(self):
        if self.use_mock:
            self.connected = True
            print("Using MOCK data mode.")
            return True
        
        try:
            self.serial_conn = serial.Serial(self.port, self.baudrate, timeout=1)
            self.connected = True
            print(f"Connected to {self.port} at {self.baudrate} baud.")
            return True
        except Exception as e:
            print(f"Failed to connect to {self.port}: {e}")
            print("Falling back to MOCK data mode.")
            self.use_mock = True
            self.connected = True
            return False

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.close()

    def _read_loop(self):
        while self.running:
            if self.use_mock:
                # Generate random mock EMG data
                with self.lock:
                    self.latest_data = [
                        random.randint(0, 1023),
                        random.randint(0, 1023),
                        random.randint(0, 1023)
                    ]
                time.sleep(0.1)
            else:
                try:
                    if self.serial_conn and self.serial_conn.in_waiting > 0:
                        line = self.serial_conn.readline().decode('utf-8').strip()
                        parts = line.split(',')
                        if len(parts) == 3:
                            with self.lock:
                                self.latest_data = [int(p) for p in parts]
                except Exception as e:
                    print(f"Serial read error: {e}")
                    time.sleep(1)

    def get_data(self):
        with self.lock:
            return list(self.latest_data)
