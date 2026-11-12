import React, { useState, useEffect, useRef } from 'react';
import { RobotEmotion, JoystickVector, SystemMetrics, ImuData } from '../types/telemetry';
import { robotManager } from '../services/bleService';
import { Smile, Sparkles, Send, Tv, Sliders, Battery, Bluetooth, Cpu, Eye, Paintbrush, RotateCcw, CheckCircle, Zap } from 'lucide-react';

interface OledEmotionMatrixProps {
  currentEmotion: RobotEmotion;
  joystick: JoystickVector;
  system: SystemMetrics;
  imu: ImuData;
}

export const OledEmotionMatrix: React.FC<OledEmotionMatrixProps> = ({
  currentEmotion,
  joystick,
  system,
  imu
}) => {
  const [oledMode, setOledMode] = useState<'emotion' | 'telemetry' | 'editor' | 'custom'>('emotion');
  const [customText, setCustomText] = useState('KINETIC ROBOT V2');
  const [blinkState, setBlinkState] = useState(false);

  // 16 rows by 32 cols interactive pixel art editor grid
  const [pixelGrid, setPixelGrid] = useState<boolean[][]>(() => {
    // Default pleasant robot face template
    const grid = Array.from({ length: 16 }, () => Array(32).fill(false));
    // Draw default stylized eyes
    [4, 5, 6, 7, 8].forEach((r) => {
      [6, 7, 8, 9, 10, 21, 22, 23, 24, 25].forEach((c) => {
        grid[r][c] = true;
      });
    });
    // Cute smile mouth
    grid[12][13] = true;
    grid[12][14] = true;
    grid[12][15] = true;
    grid[12][16] = true;
    grid[12][17] = true;
    grid[12][18] = true;
    grid[11][12] = true;
    grid[11][19] = true;
    return grid;
  });

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<boolean>(true); // true = draw, false = erase
  const [editorSent, setEditorSent] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Periodic natural blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkState(true);
      setTimeout(() => setBlinkState(false), 160);
    }, 4500);
    return () => clearInterval(blinkInterval);
  }, []);

  // Render 128x64 OLED Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset styles
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Canvas native resolution: 128 x 64 pixels (standard SSD1306)
    ctx.fillStyle = '#060e18';
    ctx.fillRect(0, 0, 128, 64);

    // Top 12px status banner
    ctx.fillStyle = '#0a192f';
    ctx.fillRect(0, 0, 128, 11);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 11.5);
    ctx.lineTo(128, 11.5);
    ctx.stroke();

    // Top status icons
    ctx.fillStyle = '#00f0ff';
    ctx.font = '7px monospace';
    ctx.fillText('BLE:OK', 3, 9);
    ctx.fillText(`${system.batteryVoltage.toFixed(1)}V`, 48, 9);
    ctx.fillText(`${Math.round(system.batteryPercent)}%`, 78, 9);
    ctx.fillText(system.isFallen ? 'FLN' : 'BAL', 106, 9);

    const eyePupilX = Math.max(-5, Math.min(5, Math.round(joystick.x * 6)));
    const eyePupilY = Math.max(-4, Math.min(4, Math.round(-joystick.y * 5)));

    // Active screen center coordinates below header (y from 12 to 64):
    const centerX = 64;
    const centerY = 38;

    // MODE 1: EMOTION FACES
    if (oledMode === 'emotion' || oledMode === 'editor') {
      const activeEmotion = system.emergencyStop ? 'ALERT' : system.isFallen ? 'DIZZY' : currentEmotion;

      ctx.fillStyle = activeEmotion === 'ALERT' ? '#ff3b30' : '#00f0ff';
      ctx.strokeStyle = activeEmotion === 'ALERT' ? '#ff3b30' : '#00f0ff';

      if (blinkState && activeEmotion !== 'DIZZY' && activeEmotion !== 'ALERT' && activeEmotion !== 'CONFIDENT' && activeEmotion !== 'SCANNING') {
        // Blinking eyes: simple horizontal slits centered
        ctx.fillRect(24, centerY - 1, 28, 3);
        ctx.fillRect(76, centerY - 1, 28, 3);
      } else {
        switch (activeEmotion) {
          case 'HAPPY':
            // Rounded cheerful eyes
            ctx.beginPath();
            ctx.ellipse(36, centerY - 4, 13, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(92, centerY - 4, 13, 14, 0, 0, Math.PI * 2);
            ctx.fill();

            // Pupil highlights (reacting to joystick direction!)
            ctx.fillStyle = '#060e18';
            ctx.beginPath();
            ctx.arc(36 + eyePupilX, centerY - 4 + eyePupilY, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(92 + eyePupilX, centerY - 4 + eyePupilY, 6, 0, Math.PI * 2);
            ctx.fill();

            // Specular reflection
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(38 + eyePupilX, centerY - 6 + eyePupilY, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(94 + eyePupilX, centerY - 6 + eyePupilY, 2, 0, Math.PI * 2);
            ctx.fill();

            // Cute smiling mouth
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, 51, 8, 0.2, Math.PI - 0.2);
            ctx.stroke();
            break;

          case 'SURPRISED':
            // Astonished wide open round eyes
            ctx.beginPath();
            ctx.arc(36, centerY - 3, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(92, centerY - 3, 15, 0, Math.PI * 2);
            ctx.fill();

            // Small trembling pupils
            ctx.fillStyle = '#060e18';
            ctx.beginPath();
            ctx.arc(36 + eyePupilX, centerY - 3 + eyePupilY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(92 + eyePupilX, centerY - 3 + eyePupilY, 4, 0, Math.PI * 2);
            ctx.fill();

            // Small round surprised mouth
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(centerX, 52, 4, 0, Math.PI * 2);
            ctx.fill();
            break;

          case 'WINK':
            // Left eye joyful wink arc
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(36, centerY, 12, 0.2, Math.PI - 0.2);
            ctx.stroke();

            // Right eye wide cheerful eye
            ctx.beginPath();
            ctx.ellipse(92, centerY - 4, 13, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#060e18';
            ctx.beginPath();
            ctx.arc(92 + eyePupilX, centerY - 4 + eyePupilY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(94 + eyePupilX, centerY - 6 + eyePupilY, 2, 0, Math.PI * 2);
            ctx.fill();

            // Smirk mouth
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(66, 50, 7, 0.3, Math.PI - 0.5);
            ctx.stroke();
            break;

          case 'CURIOUS':
            // Left eye normal, right eye raised high & wide
            ctx.beginPath();
            ctx.ellipse(34, centerY - 2, 11, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(92, centerY - 8, 15, 16, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#060e18';
            ctx.beginPath();
            ctx.arc(34 + eyePupilX, centerY - 2 + eyePupilY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(92 + eyePupilX, centerY - 8 + eyePupilY, 7, 0, Math.PI * 2);
            ctx.fill();
            break;

          case 'DIZZY':
            // Swirling spiral eyes centered
            const time = performance.now() / 150;
            ctx.lineWidth = 2;
            for (let r = 2; r < 14; r += 3) {
              ctx.beginPath();
              ctx.arc(36, centerY - 2, r, time, time + Math.PI * 1.5);
              ctx.stroke();
            }
            for (let r = 2; r < 14; r += 3) {
              ctx.beginPath();
              ctx.arc(92, centerY - 2, r, -time, -time + Math.PI * 1.5);
              ctx.stroke();
            }
            // Wavy mouth
            ctx.beginPath();
            ctx.moveTo(52, 53);
            ctx.bezierCurveTo(58, 49, 62, 57, 68, 51);
            ctx.stroke();
            break;

          // ADJUSTED & MATHEMATICALLY CENTERED: ALERT
          case 'ALERT': {
            ctx.strokeStyle = '#ff3b30';
            ctx.lineWidth = 2.0;
            const boxW = 96;
            const boxH = 38;
            const boxX = centerX - boxW / 2; // 16
            const boxY = centerY - boxH / 2; // 19
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            // Centered flashing text and hazard border
            ctx.fillStyle = '#ff3b30';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 13px monospace';
            ctx.fillText('! E-STOP !', centerX, centerY - 5);
            ctx.font = '8px monospace';
            ctx.fillText('MOTORS DISARMED', centerX, centerY + 9);
            break;
          }

          // ADJUSTED & MATHEMATICALLY CENTERED: CONFIDENT (VISOR)
          case 'CONFIDENT': {
            const visorW = 92;
            const visorH = 14;
            const visorX = centerX - visorW / 2; // 18
            const visorY = centerY - visorH / 2; // 31

            // Base visor bar centered
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(visorX, visorY, visorW, visorH);

            // Centered glowing sweep ping-ponging across full width
            const sweepProgress = (Math.sin(performance.now() / 320) + 1) / 2;
            const sweepW = 20;
            const sweepX = visorX + 2 + sweepProgress * (visorW - sweepW - 4);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sweepX, visorY + 2, sweepW, visorH - 4);

            // End cap bevels
            ctx.fillStyle = '#060e18';
            ctx.fillRect(visorX - 1, visorY, 2, 2);
            ctx.fillRect(visorX + visorW - 1, visorY, 2, 2);
            break;
          }

          // ADJUSTED & MATHEMATICALLY CENTERED: SCANNING (SCANNER)
          case 'SCANNING': {
            const boxW = 96;
            const boxH = 18;
            const boxX = centerX - boxW / 2; // 16
            const boxY = centerY - boxH / 2; // 29

            // Centered radar enclosure
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            // Grid tick marks
            ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
            for (let gx = boxX + 6; gx < boxX + boxW - 6; gx += 10) {
              ctx.fillRect(gx, boxY + boxH / 2 - 1, 2, 2);
            }

            // Sweeping laser scanner cleanly bounded within inner box
            const barW = 22;
            const barProgress = (Math.sin(performance.now() / 360) + 1) / 2;
            const barX = boxX + 2 + barProgress * (boxW - barW - 4);
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(barX, boxY + 2, barW, boxH - 4);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(barX + barW / 2 - 2, boxY + 3, 4, boxH - 6);
            break;
          }

          case 'ANGRY':
            ctx.beginPath();
            ctx.moveTo(22, centerY - 14);
            ctx.lineTo(50, centerY - 4);
            ctx.lineTo(44, centerY + 8);
            ctx.lineTo(20, centerY - 2);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(106, centerY - 14);
            ctx.lineTo(78, centerY - 4);
            ctx.lineTo(84, centerY + 8);
            ctx.lineTo(108, centerY - 2);
            ctx.closePath();
            ctx.fill();
            break;

          case 'SLEEP':
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(36, centerY - 2, 12, 0.2, Math.PI - 0.2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(92, centerY - 2, 12, 0.2, Math.PI - 0.2);
            ctx.stroke();
            ctx.font = '8px monospace';
            ctx.fillText('z', 106, 23);
            ctx.fillText('Z', 114, 17);
            break;

          case 'HEART':
            ctx.beginPath();
            ctx.moveTo(centerX, centerY + 14);
            ctx.bezierCurveTo(centerX, centerY + 10, 44, centerY - 8, 44, centerY - 14);
            ctx.bezierCurveTo(44, centerY - 20, 54, centerY - 20, centerX, centerY - 10);
            ctx.bezierCurveTo(74, centerY - 20, 84, centerY - 20, 84, centerY - 14);
            ctx.bezierCurveTo(84, centerY - 8, centerX, centerY + 10, centerX, centerY + 14);
            ctx.fill();
            break;

          case 'CUSTOM':
            // Render custom pixel art matrix drawn in Editor
            const startX = 32;
            const startY = 20;
            const pxSize = 2;
            ctx.fillStyle = '#00f0ff';
            for (let r = 0; r < 16; r++) {
              for (let c = 0; c < 32; c++) {
                if (pixelGrid[r] && pixelGrid[r][c]) {
                  ctx.fillRect(startX + c * pxSize, startY + r * pxSize, pxSize, pxSize);
                }
              }
            }
            break;

          default:
            ctx.fillRect(24, centerY - 10, 28, 14);
            ctx.fillRect(76, centerY - 10, 28, 14);
            break;
        }
      }
    } else if (oledMode === 'telemetry') {
      // MODE 2: TELEMETRY TEXT HUD
      ctx.fillStyle = '#00f0ff';
      ctx.font = '8px monospace';
      ctx.fillText(`PITCH: ${imu.pitch > 0 ? '+' : ''}${imu.pitch.toFixed(1)}°`, 8, 25);
      ctx.fillText(`ROLL:  ${imu.roll.toFixed(1)}°`, 8, 36);
      ctx.fillText(`GYRO:  ${imu.gyroY.toFixed(0)} d/s`, 8, 47);
      ctx.fillText(`MOT: L${robotManager.motor.leftPwm} R${robotManager.motor.rightPwm}`, 8, 58);

      ctx.strokeStyle = '#00e676';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(80, 22, 42, 36);
      ctx.stroke();
      ctx.fillText('STABLE', 84, 42);
    } else {
      // MODE 3: CUSTOM BANNER
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('ESP32 OLED 128x64', 8, 25);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText(customText.slice(0, 14), 8, 42);
      ctx.fillStyle = '#ff9f0a';
      ctx.font = '7px monospace';
      ctx.fillText('LIVE OTA MIRROR', 8, 56);
    }
  }, [currentEmotion, joystick, system, imu, oledMode, blinkState, customText, pixelGrid]);

  // Pixel grid editor interactions
  const togglePixel = (row: number, col: number, forceState?: boolean) => {
    setPixelGrid((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = forceState !== undefined ? forceState : !next[row][col];
      return next;
    });
  };

  const handlePointerDownGrid = (r: number, c: number) => {
    setIsDrawing(true);
    const targetState = !pixelGrid[r][c];
    setDrawMode(targetState);
    togglePixel(r, c, targetState);
  };

  const handlePointerEnterGrid = (r: number, c: number) => {
    if (!isDrawing) return;
    togglePixel(r, c, drawMode);
  };

  const clearGrid = () => {
    setPixelGrid(Array.from({ length: 16 }, () => Array(32).fill(false)));
  };

  const invertGrid = () => {
    setPixelGrid((prev) => prev.map((row) => row.map((cell) => !cell)));
  };

  const loadTemplate = (name: string) => {
    const grid = Array.from({ length: 16 }, () => Array(32).fill(false));
    if (name === 'CAT') {
      // Robotic cat eyes
      [3, 4, 5, 6, 7].forEach((r) => {
        [6, 7, 8, 9, 22, 23, 24, 25].forEach((c) => (grid[r][c] = true));
      });
      // Pointed ears
      grid[1][5] = true;
      grid[2][6] = true;
      grid[1][26] = true;
      grid[2][25] = true;
      // W mouth
      grid[12][14] = true;
      grid[13][15] = true;
      grid[12][16] = true;
      grid[13][17] = true;
    } else if (name === 'MECHA') {
      // Futuristic mecha visor
      for (let c = 4; c < 28; c++) {
        grid[6][c] = true;
        grid[7][c] = true;
        grid[8][c] = true;
      }
    } else if (name === 'HEARTS') {
      // Heart eyes
      [4, 5, 6, 7, 8].forEach((r) => {
        grid[r][7] = true;
        grid[r][8] = true;
        grid[r][23] = true;
        grid[r][24] = true;
      });
      grid[3][6] = true;
      grid[3][9] = true;
      grid[3][22] = true;
      grid[3][25] = true;
    }
    setPixelGrid(grid);
  };

  const handleSendCustomEmotion = () => {
    robotManager.setCustomEmotionGrid(pixelGrid);
    setEditorSent(true);
    setTimeout(() => setEditorSent(false), 2500);
  };

  const emotionList: { id: RobotEmotion; label: string; desc: string }[] = [
    { id: 'HAPPY', label: 'HAPPY', desc: 'Blinking cheerful eyes' },
    { id: 'CURIOUS', label: 'CURIOUS', desc: 'Raised brow + pupil tracking' },
    { id: 'SURPRISED', label: 'SURPRISED', desc: 'Wide astonished round gaze' },
    { id: 'WINK', label: 'WINK', desc: 'Playful wink animation' },
    { id: 'DIZZY', label: 'DIZZY', desc: 'Spiral eyes on tilt/fall' },
    { id: 'ALERT', label: 'ALERT', desc: 'Centered hazard alert' },
    { id: 'ANGRY', label: 'ANGRY', desc: 'Aggressive high-torque gaze' },
    { id: 'SLEEP', label: 'SLEEP', desc: 'Standby low power mode' },
    { id: 'CONFIDENT', label: 'VISOR', desc: 'Centered cyclops visor sweep' },
    { id: 'SCANNING', label: 'SCANNER', desc: 'Centered laser sweep' },
    { id: 'HEART', label: 'HEART', desc: 'Pixel love animation' },
    { id: 'CUSTOM', label: 'CUSTOM PIXELS', desc: 'Custom user-drawn bitmap' },
  ];

  return (
    <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#1e293b] gap-2">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-[#00f0ff]" />
          <span className="font-space font-semibold text-white tracking-wide text-sm">
            ESP32-B OLED 128x64 // EMOTION MATRIX & EDITOR
          </span>
        </div>

        {/* OLED Mode Tabs */}
        <div className="flex items-center gap-1 bg-[#0b0f17] p-0.5 rounded-[3px] border border-[#1e293b]">
          <button
            onClick={() => setOledMode('emotion')}
            className={`px-2 py-0.5 text-[11px] font-mono rounded-[2px] transition-all ${
              oledMode === 'emotion' ? 'bg-[#0077ff] text-white' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            EMOCIONES
          </button>
          <button
            onClick={() => setOledMode('editor')}
            className={`px-2 py-0.5 text-[11px] font-mono rounded-[2px] transition-all flex items-center gap-1 ${
              oledMode === 'editor' ? 'bg-[#ff9f0a] text-black font-bold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Paintbrush className="w-3 h-3" />
            <span>EDITOR</span>
          </button>
          <button
            onClick={() => setOledMode('telemetry')}
            className={`px-2 py-0.5 text-[11px] font-mono rounded-[2px] transition-all ${
              oledMode === 'telemetry' ? 'bg-[#0077ff] text-white' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            HUD
          </button>
          <button
            onClick={() => setOledMode('custom')}
            className={`px-2 py-0.5 text-[11px] font-mono rounded-[2px] transition-all ${
              oledMode === 'custom' ? 'bg-[#0077ff] text-white' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            TEXTO
          </button>
        </div>
      </div>

      {/* Physical SSD1306 Hardware Bezel */}
      <div className="my-3 flex flex-col items-center">
        <div className="p-3 bg-[#0a1424] border-2 border-[#1e293b] rounded-[6px] shadow-[0_8px_24px_rgba(0,0,0,0.8)] relative flex flex-col items-center">
          {/* PCB Mounting Holes in corners */}
          <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full border border-[#ff9f0a] bg-black" />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-[#ff9f0a] bg-black" />
          <div className="absolute bottom-1.5 left-1.5 w-2 h-2 rounded-full border border-[#ff9f0a] bg-black" />
          <div className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full border border-[#ff9f0a] bg-black" />

          {/* Pin Header labels */}
          <div className="flex items-center gap-4 text-[8px] font-mono text-[#94a3b8] mb-1">
            <span>GND</span>
            <span>VCC</span>
            <span>SCL (IO22)</span>
            <span>SDA (IO21)</span>
          </div>

          {/* Actual 128x64 OLED Glass Display Area */}
          <div className="relative border-4 border-black rounded-[2px] bg-black p-1 shadow-[inset_0_0_12px_rgba(0,0,0,0.9)] overflow-hidden">
            <canvas
              ref={canvasRef}
              width={128}
              height={64}
              style={{
                width: '280px',
                height: '140px',
                imageRendering: 'pixelated',
              }}
              className="rounded-[1px] block oled-grid"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none" />
          </div>

          <div className="flex items-center justify-between w-full mt-1.5 px-2 text-[9px] font-mono text-[#64748b]">
            <span>SSD1306 I2C 0x3C</span>
            <span>128×64 MONOCHROME</span>
          </div>
        </div>
      </div>

      {/* MODE: PIXEL ART EMOTION EDITOR */}
      {oledMode === 'editor' && (
        <div className="flex-1 flex flex-col space-y-3 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e293b] pb-2">
            <span className="text-[#ff9f0a] font-bold flex items-center gap-1.5">
              <Paintbrush className="w-3.5 h-3.5" />
              EDITOR DE EXPRESIONES (MATRIZ 16×32)
            </span>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => loadTemplate('CAT')}
                className="px-2 py-0.5 rounded-[2px] bg-[#1a2438] hover:bg-[#2d3748] text-white border border-[#1e293b]"
              >
                GATO
              </button>
              <button
                onClick={() => loadTemplate('MECHA')}
                className="px-2 py-0.5 rounded-[2px] bg-[#1a2438] hover:bg-[#2d3748] text-white border border-[#1e293b]"
              >
                MECHA
              </button>
              <button
                onClick={() => loadTemplate('HEARTS')}
                className="px-2 py-0.5 rounded-[2px] bg-[#1a2438] hover:bg-[#2d3748] text-white border border-[#1e293b]"
              >
                CORAZONES
              </button>
              <button
                onClick={invertGrid}
                className="px-2 py-0.5 rounded-[2px] bg-[#1a2438] hover:bg-[#2d3748] text-[#94a3b8]"
                title="Invertir píxeles"
              >
                INVERTIR
              </button>
              <button
                onClick={clearGrid}
                className="px-2 py-0.5 rounded-[2px] bg-[#1a2438] hover:bg-[#ff3b30]/20 text-[#ffb4ab]"
                title="Limpiar matriz"
              >
                LIMPIAR
              </button>
            </div>
          </div>

          {/* Interactive Pixel Drawing Grid */}
          <div
            onPointerUp={() => setIsDrawing(false)}
            onPointerLeave={() => setIsDrawing(false)}
            className="p-2 bg-[#0b0f17] border border-[#1e293b] rounded-[3px] flex flex-col items-center justify-center select-none overflow-x-auto"
          >
            <div className="grid grid-rows-16 gap-[1.5px] cursor-crosshair">
              {pixelGrid.map((row, rIdx) => (
                <div key={rIdx} className="flex gap-[1.5px]">
                  {row.map((cell, cIdx) => (
                    <div
                      key={cIdx}
                      onPointerDown={() => handlePointerDownGrid(rIdx, cIdx)}
                      onPointerEnter={() => handlePointerEnterGrid(rIdx, cIdx)}
                      className={`w-2.5 h-2.5 rounded-[1px] transition-colors ${
                        cell
                          ? 'bg-[#00f0ff] shadow-[0_0_4px_#00f0ff]'
                          : 'bg-[#131b2a] hover:bg-[#1a2438]'
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Transmit to ESP32-B Action */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-[#94a3b8]">
              Haz clic y arrastra para dibujar. Se actualiza en tiempo real en la pantalla superior.
            </span>
            <button
              onClick={handleSendCustomEmotion}
              className={`px-3 py-1.5 rounded-[3px] font-bold text-xs flex items-center gap-1.5 transition-all ${
                editorSent
                  ? 'bg-[#00e676] text-black shadow-[0_0_12px_#00e676]'
                  : 'bg-[#0077ff] hover:bg-[#00f0ff] hover:text-black text-white'
              }`}
            >
              {editorSent ? <CheckCircle className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              <span>{editorSent ? '¡ENVIADO A ESP32-B!' : 'TRANSMITIR A ESP32-B'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Emotion Trigger Pad */}
      {oledMode === 'emotion' && (
        <div className="flex-1 flex flex-col">
          <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-[#94a3b8] mb-2 flex items-center justify-between">
            <span>TRIGGER ROBOT EMOTION PACKET (ESP32-B)</span>
            <span className="text-[#00f0ff] font-semibold">ACTUAL: {currentEmotion}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {emotionList.map((emo) => {
              const isSelected = currentEmotion === emo.id;
              return (
                <button
                  key={emo.id}
                  onClick={() => robotManager.setEmotion(emo.id)}
                  className={`p-2 rounded-[3px] border font-mono text-left transition-all ${
                    isSelected
                      ? 'bg-[#0077ff]/30 border-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                      : 'bg-[#0b0f17] border-[#1e293b] hover:border-[#3b494b] hover:bg-[#1a2438]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isSelected ? 'text-[#00f0ff]' : 'text-white'}`}>
                      {emo.label}
                    </span>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-ping" />}
                  </div>
                  <div className="text-[10px] text-[#64748b] truncate mt-0.5">{emo.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Text Mode */}
      {oledMode === 'custom' && (
        <div className="space-y-3">
          <label className="block text-xs font-mono text-[#94a3b8]">
            ENVIAR TEXTO O MENSAJE A PANTALLA OLED
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={16}
              value={customText}
              onChange={(e) => setCustomText(e.target.value.toUpperCase())}
              className="flex-1 bg-[#0b0f17] border border-[#1e293b] rounded-[3px] px-3 py-1.5 font-mono text-sm text-[#00f0ff] focus:outline-none focus:border-[#00f0ff]"
              placeholder="INGRESA TEXTO (MÁX 16 CARACTERES)"
            />
            <button
              onClick={() => {
                robotManager.setEmotion('CONFIDENT');
              }}
              className="px-3 py-1.5 bg-[#0077ff] hover:bg-[#00f0ff] hover:text-black text-white font-mono text-xs font-bold rounded-[3px] flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ENVIAR</span>
            </button>
          </div>
          <p className="text-[11px] font-mono text-[#64748b]">
            Transmite un paquete ASCII a ESP32-B para mostrar en el buffer SSD1306.
          </p>
        </div>
      )}

      {/* Telemetry Mode description */}
      {oledMode === 'telemetry' && (
        <div className="text-xs font-mono text-[#94a3b8] space-y-1">
          <p className="text-[#00e676]">✓ Sincronización I2C en tiempo real a 20 FPS</p>
          <p>Muestra el ángulo de inclinación, PWM de motores y batería en la pantalla física del robot.</p>
        </div>
      )}
    </div>
  );
};
