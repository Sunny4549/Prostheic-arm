import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Usb, Activity, Code, Keyboard, AlertCircle } from 'lucide-react';
import { cn } from './lib/utils';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';

// Types
type Movement = 'rest' | 'index' | 'middle' | 'thumb' | 'grip';

interface FingerConfig {
  name: string;
  baseX: number;
  baseY: number;
  length: number;
  width: number;
  baseAngle: number;
}

const FINGERS: Record<string, FingerConfig> = {
  thumb: { name: 'thumb', baseX: 130, baseY: 220, length: 80, width: 20, baseAngle: 140 },
  index: { name: 'index', baseX: 160, baseY: 140, length: 100, width: 18, baseAngle: 105 },
  middle: { name: 'middle', baseX: 200, baseY: 130, length: 110, width: 18, baseAngle: 90 },
  ring: { name: 'ring', baseX: 240, baseY: 140, length: 100, width: 18, baseAngle: 75 },
  pinky: { name: 'pinky', baseX: 270, baseY: 160, length: 80, width: 16, baseAngle: 60 },
};

// SVG Hand Component
const HandSimulation = ({ movement }: { movement: Movement }) => {
  const [bends, setBends] = useState<Record<string, number>>({
    thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0
  });

  // Animation loop for smooth bending
  useEffect(() => {
    const targetBends = {
      thumb: movement === 'thumb' || movement === 'grip' ? 60 : 0,
      index: movement === 'index' || movement === 'grip' ? 80 : 0,
      middle: movement === 'middle' || movement === 'grip' ? 80 : 0,
      ring: movement === 'grip' ? 80 : 0,
      pinky: movement === 'grip' ? 80 : 0,
    };

    let animationFrameId: number;
    
    const animate = () => {
      setBends(prev => {
        const next = { ...prev };
        let changed = false;
        for (const key in targetBends) {
          const target = targetBends[key as keyof typeof targetBends];
          const current = prev[key];
          if (Math.abs(current - target) > 1) {
            next[key] = current + (target - current) * 0.2; // Easing
            changed = true;
          } else {
            next[key] = target;
          }
        }
        if (changed) {
          animationFrameId = requestAnimationFrame(animate);
        }
        return next;
      });
    };
    
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [movement]);

  const renderFinger = (config: FingerConfig) => {
    const segments = 3;
    const segmentLength = config.length / segments;
    const currentBend = bends[config.name] || 0;
    
    let currentX = config.baseX;
    let currentY = config.baseY;
    let currentAngle = config.baseAngle;
    
    const paths = [];
    const joints = [];
    
    for (let i = 0; i < segments; i++) {
      const jointAngle = currentAngle + (currentBend * (i + 1) / segments);
      const rad = (jointAngle * Math.PI) / 180;
      
      const nextX = currentX + Math.cos(rad) * segmentLength;
      const nextY = currentY - Math.sin(rad) * segmentLength;
      
      paths.push(
        <line 
          key={`line-${config.name}-${i}`}
          x1={currentX} y1={currentY} 
          x2={nextX} y2={nextY} 
          stroke="#dcaa8c" 
          strokeWidth={config.width} 
          strokeLinecap="round" 
        />
      );
      
      joints.push(
        <circle 
          key={`joint-${config.name}-${i}`}
          cx={currentX} cy={currentY} 
          r={config.width / 2 + 1} 
          fill="#b4785a" 
        />
      );
      
      currentX = nextX;
      currentY = nextY;
      currentAngle = jointAngle;
    }
    
    // Fingertip
    joints.push(
      <circle 
        key={`tip-${config.name}`}
        cx={currentX} cy={currentY} 
        r={config.width / 2} 
        fill="#dcaa8c" 
      />
    );
    
    return (
      <g key={config.name}>
        {paths}
        {joints}
      </g>
    );
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800">
      <svg width="400" height="400" viewBox="0 0 400 400">
        {/* Wrist */}
        <rect x="160" y="240" width="80" height="100" fill="#c89678" rx="10" />
        {/* Palm */}
        <circle cx="200" cy="200" r="60" fill="#c89678" />
        
        {/* Fingers */}
        {Object.values(FINGERS).map(renderFinger)}
      </svg>
    </div>
  );
};

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [useMock, setUseMock] = useState(false); // Default to false to encourage real Arduino usage
  const [emgData, setEmgData] = useState([0, 0, 0]);
  const [history, setHistory] = useState<any[]>([]);
  const [prediction, setPrediction] = useState<Movement>('rest');
  const [confidence, setConfidence] = useState(0);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'sim' | 'code'>('sim');
  
  // Web Serial API State
  const [serialPort, setSerialPort] = useState<any>(null);
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [serialError, setSerialError] = useState<string | null>(null);

  const [pythonCode, setPythonCode] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState('main.py');

  // Load Python code
  useEffect(() => {
    const loadCode = async () => {
      try {
        const codeMap: Record<string, string> = {};
        
        codeMap['main.py'] = `import pygame\nimport sys\nfrom serial_reader import SerialReader\nfrom model import EMGModel\nfrom simulation import HandSimulation\n\ndef main():\n    print("Starting EMG Virtual Prosthetic Hand Simulation...")\n    \n    # Initialize components\n    # Set use_mock=False to read from real Arduino AD8232\n    reader = SerialReader(port='COM3', baudrate=9600, use_mock=False) \n    reader.connect()\n    reader.start()\n    \n    model = EMGModel(model_path='emg_model.pkl')\n    sim = HandSimulation(width=800, height=600)\n    \n    running = True\n    keyboard_mode = False\n    manual_movement = "rest"\n    \n    while running:\n        for event in pygame.event.get():\n            if event.type == pygame.QUIT:\n                running = False\n            elif event.type == pygame.KEYDOWN:\n                if event.key == pygame.K_ESCAPE:\n                    running = False\n                elif event.key == pygame.K_k:\n                    keyboard_mode = not keyboard_mode\n                \n                if keyboard_mode:\n                    if event.key == pygame.K_1: manual_movement = "index"\n                    elif event.key == pygame.K_2: manual_movement = "middle"\n                    elif event.key == pygame.K_3: manual_movement = "thumb"\n                    elif event.key == pygame.K_4: manual_movement = "grip"\n                    elif event.key == pygame.K_0: manual_movement = "rest"\n\n        emg_data = reader.get_data()\n        sim.update_graph(emg_data)\n        \n        if keyboard_mode:\n            movement = manual_movement\n            confidence = 1.0\n        else:\n            movement, confidence = model.predict(emg_data)\n            \n        sim.set_movement(movement)\n        fps = sim.clock.get_fps()\n        sim.render(movement, confidence, emg_data, fps)\n        sim.clock.tick(60)\n\n    reader.stop()\n    pygame.quit()\n    sys.exit()\n\nif __name__ == "__main__":\n    main()`;
        
        codeMap['model.py'] = `import os\nimport joblib\nimport numpy as np\n\nclass EMGModel:\n    def __init__(self, model_path='emg_model.pkl'):\n        self.model_path = model_path\n        self.model = None\n        self.labels = ["index", "middle", "thumb", "grip", "rest"]\n        self.load_model()\n\n    def load_model(self):\n        if os.path.exists(self.model_path):\n            try:\n                self.model = joblib.load(self.model_path)\n            except Exception as e:\n                print(f"Error loading model: {e}")\n                self.model = None\n        else:\n            self.model = None\n\n    def predict(self, emg_data):\n        if not emg_data or len(emg_data) != 3:\n            return "rest", 0.0\n\n        if self.model:\n            try:\n                data_array = np.array(emg_data).reshape(1, -1)\n                prediction = self.model.predict(data_array)[0]\n                confidence = 1.0\n                if hasattr(self.model, "predict_proba"):\n                    proba = self.model.predict_proba(data_array)[0]\n                    confidence = np.max(proba)\n                return prediction, confidence\n            except Exception as e:\n                return "rest", 0.0\n        else:\n            # Heuristic fallback\n            ch1, ch2, ch3 = emg_data\n            threshold = 600\n            if ch1 > threshold and ch2 > threshold and ch3 > threshold:\n                return "grip", 0.85\n            elif ch1 > threshold:\n                return "thumb", 0.75\n            elif ch2 > threshold:\n                return "index", 0.75\n            elif ch3 > threshold:\n                return "middle", 0.75\n            else:\n                return "rest", 0.90`;
        
        codeMap['serial_reader.py'] = `import serial\nimport time\nimport random\nimport threading\n\nclass SerialReader:\n    def __init__(self, port='COM3', baudrate=9600, use_mock=False):\n        self.port = port\n        self.baudrate = baudrate\n        self.use_mock = use_mock\n        self.serial_conn = None\n        self.running = False\n        self.latest_data = [0, 0, 0]\n        self.lock = threading.Lock()\n\n    def connect(self):\n        if self.use_mock:\n            return True\n        try:\n            self.serial_conn = serial.Serial(self.port, self.baudrate, timeout=1)\n            return True\n        except Exception as e:\n            print(f"Failed to connect to {self.port}: {e}")\n            self.use_mock = True\n            return False\n\n    def start(self):\n        self.running = True\n        self.thread = threading.Thread(target=self._read_loop, daemon=True)\n        self.thread.start()\n\n    def stop(self):\n        self.running = False\n        if self.serial_conn and self.serial_conn.is_open:\n            self.serial_conn.close()\n\n    def _read_loop(self):\n        while self.running:\n            if self.use_mock:\n                with self.lock:\n                    self.latest_data = [\n                        random.randint(0, 1023),\n                        random.randint(0, 1023),\n                        random.randint(0, 1023)\n                    ]\n                time.sleep(0.1)\n            else:\n                try:\n                    if self.serial_conn and self.serial_conn.in_waiting > 0:\n                        line = self.serial_conn.readline().decode('utf-8').strip()\n                        parts = line.split(',')\n                        if len(parts) == 3:\n                            with self.lock:\n                                self.latest_data = [int(p) for p in parts]\n                except Exception as e:\n                    time.sleep(1)\n\n    def get_data(self):\n        with self.lock:\n            return list(self.latest_data)`;
        
        codeMap['simulation.py'] = `# Pygame simulation logic (See downloaded files for full code)\nimport pygame\nimport math\n\nclass Finger:\n    # ... finger logic ...\n    pass\n\nclass HandSimulation:\n    # ... pygame rendering logic ...\n    pass`;
        
        codeMap['requirements.txt'] = `pygame==2.5.2\npyserial==3.5\nscikit-learn==1.3.2\nnumpy==1.26.4\njoblib==1.3.2`;
        
        codeMap['README.md'] = `# EMG-Based Virtual Prosthetic Hand Simulation\n\nA real-time system that reads EMG signals, predicts finger movements using a trained ML model, and visualizes the result as an animated virtual hand using Pygame.\n\n## Requirements\n\n- Python 3.8+\n- Arduino (optional, can use mock data mode)\n\n## Installation\n\n1. Install dependencies:\n   \`\`\`bash\n   pip install -r requirements.txt\n   \`\`\`\n\n2. (Optional) Place your trained model \`emg_model.pkl\` in the same directory. If not present, the system will use a heuristic fallback model for demonstration.\n\n## Running the Simulation\n\n\`\`\`bash\npython main.py\n\`\`\`\n\n## Controls\n\n- \`K\`: Toggle Keyboard Mode (overrides EMG data)\n- \`1\`: Bend Index Finger (Keyboard Mode)\n- \`2\`: Bend Middle Finger (Keyboard Mode)\n- \`3\`: Bend Thumb (Keyboard Mode)\n- \`4\`: Grip (Keyboard Mode)\n- \`0\`: Rest (Keyboard Mode)\n- \`ESC\`: Exit`;

        setPythonCode(codeMap);
      } catch (e) {
        console.error(e);
      }
    };
    loadCode();
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!keyboardMode) return;
      
      switch(e.key) {
        case '1': setPrediction('index'); setConfidence(1.0); break;
        case '2': setPrediction('middle'); setConfidence(1.0); break;
        case '3': setPrediction('thumb'); setConfidence(1.0); break;
        case '4': setPrediction('grip'); setConfidence(1.0); break;
        case '0': setPrediction('rest'); setConfidence(1.0); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardMode]);

  // Connect to Arduino via Web Serial API
  const connectToArduino = async () => {
    try {
      setSerialError(null);
      if (!('serial' in navigator)) {
        setSerialError('Web Serial API not supported in this browser. Please use Chrome or Edge.');
        return;
      }
      
      // Request a port and open a connection
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      
      setSerialPort(port);
      setIsSerialConnected(true);
      setUseMock(false); // Automatically disable mock mode when real hardware is connected
      setIsRunning(true); // Auto-start reading
    } catch (err: any) {
      console.error('Error connecting to serial port:', err);
      setSerialError(err.message || 'Failed to connect to Arduino.');
    }
  };

  // Shared function to process incoming data (Mock or Serial)
  const handleNewData = useCallback((newData: number[]) => {
    setEmgData(newData);
    
    // Update history for graph
    setHistory(prev => {
      const newHist = [...prev, { ch1: newData[0], ch2: newData[1], ch3: newData[2] }];
      if (newHist.length > 50) newHist.shift();
      return newHist;
    });

    // Heuristic prediction (matching Python fallback)
    const threshold = 600; // Adjust this threshold based on your AD8232 baseline
    let pred: Movement = 'rest';
    let conf = 0.90;

    if (newData[0] > threshold && newData[1] > threshold && newData[2] > threshold) {
      pred = 'grip'; conf = 0.85;
    } else if (newData[0] > threshold) {
      pred = 'thumb'; conf = 0.75;
    } else if (newData[1] > threshold) {
      pred = 'index'; conf = 0.75;
    } else if (newData[2] > threshold) {
      pred = 'middle'; conf = 0.75;
    }

    setPrediction(pred);
    setConfidence(conf);
  }, []);

  // Mock Data Generation Effect
  useEffect(() => {
    if (!isRunning || keyboardMode || !useMock) return;

    const interval = setInterval(() => {
      const newData = [
        Math.floor(Math.random() * 1024),
        Math.floor(Math.random() * 1024),
        Math.floor(Math.random() * 1024)
      ];
      handleNewData(newData);
    }, 100); // 10Hz update rate

    return () => clearInterval(interval);
  }, [isRunning, keyboardMode, useMock, handleNewData]);

  // Real Arduino Serial Reading Effect
  useEffect(() => {
    let keepReading = false;
    let reader: any = null;

    const startReading = async () => {
      if (!serialPort) return;
      keepReading = true;
      
      try {
        reader = serialPort.readable.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (keepReading) {
          const { value, done } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const parts = line.trim().split(',');
            if (parts.length === 3) {
              const parsed = parts.map(Number);
              if (!parsed.some(isNaN)) {
                handleNewData(parsed);
              }
            }
          }
        }
      } catch (error) {
        console.error('Serial read error:', error);
        setIsSerialConnected(false);
        setSerialError('Connection lost or read error.');
      } finally {
        if (reader) {
          reader.releaseLock();
        }
      }
    };

    if (isRunning && !useMock && !keyboardMode && isSerialConnected) {
      startReading();
    }

    return () => {
      keepReading = false;
      if (reader) {
        reader.cancel().catch(console.error);
      }
    };
  }, [isRunning, useMock, keyboardMode, isSerialConnected, serialPort, handleNewData]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="font-semibold text-lg leading-tight">EMG Prosthetic Simulator</h1>
            <p className="text-xs text-zinc-400">Real-time ML prediction visualization</p>
          </div>
        </div>
        
        <div className="flex bg-zinc-800/50 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('sim')}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'sim' ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200")}
          >
            Web Preview
          </button>
          <button 
            onClick={() => setActiveTab('code')}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2", activeTab === 'code' ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200")}
          >
            <Code size={16} />
            Python Code
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'sim' ? (
          <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-y-auto">
            
            {/* Left Column: Controls & Data */}
            <div className="flex flex-col gap-6">
              {/* Controls Card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Connection</h2>
                
                {serialError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-xs">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{serialError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3 mb-6">
                  <button 
                    onClick={connectToArduino}
                    disabled={isSerialConnected}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors",
                      isSerialConnected ? "bg-zinc-800 text-emerald-400 cursor-default" : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    )}
                  >
                    <Usb size={18} />
                    {isSerialConnected ? 'Arduino Connected' : 'Connect Arduino (AD8232)'}
                  </button>

                  <button 
                    onClick={() => setIsRunning(!isRunning)}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors",
                      isRunning ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    )}
                  >
                    {isRunning ? <Square size={18} /> : <Play size={18} />}
                    {isRunning ? 'Stop Reading' : 'Start Reading'}
                  </button>
                </div>

                <div className="space-y-3">
                  <div 
                    onClick={() => {
                      setUseMock(!useMock);
                      if (isSerialConnected && !useMock) {
                        // If switching to mock while connected, we might want to warn them, but we'll just allow it.
                      }
                    }}
                    className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-950/50 cursor-pointer hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Activity size={18} className="text-zinc-400" />
                      <div className="flex flex-col">
                        <span className="text-sm">Mock Data Mode</span>
                        {useMock && isSerialConnected && <span className="text-[10px] text-amber-400">Overrides Arduino</span>}
                      </div>
                    </div>
                    <div className={cn("w-10 h-5 rounded-full relative transition-colors", useMock ? "bg-blue-500" : "bg-zinc-700")}>
                      <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-all", useMock ? "left-6" : "left-1")} />
                    </div>
                  </div>

                  <div 
                    onClick={() => setKeyboardMode(!keyboardMode)}
                    className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-950/50 cursor-pointer hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Keyboard size={18} className="text-zinc-400" />
                      <span className="text-sm">Keyboard Override (0-4)</span>
                    </div>
                    <div className={cn("w-10 h-5 rounded-full relative transition-colors", keyboardMode ? "bg-blue-500" : "bg-zinc-700")}>
                      <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-all", keyboardMode ? "left-6" : "left-1")} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Prediction Card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex-1">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">ML Prediction</h2>
                
                <div className="flex flex-col items-center justify-center h-40 bg-zinc-950 rounded-lg border border-zinc-800 mb-4">
                  <div className="text-5xl font-bold text-white uppercase tracking-tight mb-2">
                    {prediction}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-zinc-400">Confidence:</div>
                    <div className="text-sm font-mono text-emerald-400">{(confidence * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {['CH1', 'CH2', 'CH3'].map((ch, i) => (
                    <div key={ch} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-col items-center">
                      <span className="text-xs text-zinc-500 mb-1">{ch}</span>
                      <span className="font-mono text-lg">{emgData[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle Column: Hand Simulation */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 relative min-h-[400px]">
                <div className="absolute top-4 left-4 z-10 bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 px-3 py-1.5 rounded-md text-xs font-mono text-zinc-400">
                  FPS: 60
                </div>
                <HandSimulation movement={prediction} />
              </div>

              {/* Live Graph */}
              <div className="h-48 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Live EMG Signals</h2>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <YAxis domain={[0, 1024]} hide />
                      <Line type="monotone" dataKey="ch1" stroke="#ff6b6b" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="ch2" stroke="#4dabf7" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="ch3" stroke="#51cf66" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex">
            {/* File Explorer */}
            <div className="w-64 border-r border-zinc-800 bg-zinc-900/50 p-4 overflow-y-auto">
              <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Python Project Files</h2>
              <div className="space-y-1">
                {Object.keys(pythonCode).map(file => (
                  <button
                    key={file}
                    onClick={() => setActiveFile(file)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm font-mono transition-colors",
                      activeFile === file ? "bg-blue-500/10 text-blue-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    )}
                  >
                    {file}
                  </button>
                ))}
              </div>
              
              <div className="mt-8 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                <h3 className="text-xs font-medium text-zinc-300 mb-2">Download Instructions</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  The complete Python project files have been generated in the <code className="text-zinc-300">/python_src</code> directory of this workspace. You can export the project as a ZIP to run it locally with Pygame.
                </p>
              </div>
            </div>
            
            {/* Code Viewer */}
            <div className="flex-1 bg-zinc-950 overflow-y-auto p-6">
              <pre className="font-mono text-sm text-zinc-300">
                <code>{pythonCode[activeFile]}</code>
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
