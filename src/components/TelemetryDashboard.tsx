import React, { useEffect, useRef, useState } from 'react';
import { 
  ImuData, 
  MotorTelemetry, 
  SystemMetrics, 
  RobotConfig, 
  DetailedBatteryMetrics, 
  VoltageDividerConfig,
  SensorSmoothingMode 
} from '../types/telemetry';
import { robotManager } from '../services/bleService';
import { 
  Activity, 
  Zap, 
  Cpu, 
  Battery, 
  Gauge, 
  Sliders, 
  Play, 
  Pause, 
  Eye, 
  CheckCircle2, 
  Sparkles,
  TrendingDown,
  Info,
  ChevronDown,
  ChevronUp,
  CpuIcon,
  BarChart3
} from 'lucide-react';
import { BatteryHealthChart } from './BatteryHealthChart';

interface TelemetryDashboardProps {
  imu: ImuData;
  motor: MotorTelemetry;
  system: SystemMetrics;
  config: RobotConfig;
  detailedBattery: DetailedBatteryMetrics;
  voltageDivider: VoltageDividerConfig;
  smoothingMode: SensorSmoothingMode;
  smoothedImu: ImuData;
  smoothedMotor: MotorTelemetry;
}

export const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  imu,
  motor,
  system,
  config,
  detailedBattery,
  voltageDivider,
  smoothingMode,
  smoothedImu,
  smoothedMotor
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [timeWindowSec, setTimeWindowSec] = useState<number>(5);
  const [showDividerConfig, setShowDividerConfig] = useState<boolean>(false);
  const [showBatteryChart, setShowBatteryChart] = useState<boolean>(true);

  // Local state for voltage divider inputs
  const [r1Input, setR1Input] = useState<number>(voltageDivider.r1Ohms);
  const [r2Input, setR2Input] = useState<number>(voltageDivider.r2Ohms);
  const [calibInput, setCalibInput] = useState<number>(voltageDivider.calibMultiplier);
  const [capacityInput, setCapacityInput] = useState<number>(voltageDivider.capacityMah);
  const [batteryTypeInput, setBatteryTypeInput] = useState(voltageDivider.batteryType);

  // Circular ring buffers for low-latency 60FPS graph rendering
  const historyRef = useRef<{
    pitch: number[];
    motorPwm: number[];
    gyroY: number[];
    timestamps: number[];
  }>({
    pitch: [],
    motorPwm: [],
    gyroY: [],
    timestamps: []
  });

  // Collect high-frequency raw history points for the oscillogram
  useEffect(() => {
    if (isPaused) return;
    const hist = historyRef.current;
    const maxPoints = timeWindowSec * 60; // 60fps sampling
    hist.pitch.push(imu.pitch);
    hist.motorPwm.push((motor.leftPwm + motor.rightPwm) / 2);
    hist.gyroY.push(imu.gyroY);
    hist.timestamps.push(Date.now());

    if (hist.pitch.length > maxPoints) {
      hist.pitch.shift();
      hist.motorPwm.shift();
      hist.gyroY.shift();
      hist.timestamps.shift();
    }
  }, [imu, motor, isPaused, timeWindowSec]);

  // High-performance canvas render loop for oscillogram
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const hist = historyRef.current;
      const len = hist.pitch.length;

      // Dark tactical canvas background
      ctx.fillStyle = '#0b0f17';
      ctx.fillRect(0, 0, w, h);

      // Grid Lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;

      // Horizontal center line (Zero axis)
      const zeroY = h / 2;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(w, zeroY);
      ctx.stroke();

      // Horizontal grid lines (+/- 10 deg, +/- 20 deg)
      const scaleY = (h * 0.4) / 30; // 30 degrees = 40% height
      [-20, -10, 10, 20].forEach((deg) => {
        const y = zeroY - deg * scaleY;
        ctx.beginPath();
        ctx.strokeStyle = '#141c2b';
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      });

      // Target balance angle line (Amber dashed)
      const targetY = zeroY - config.targetPitchOffset * scaleY;
      ctx.strokeStyle = 'rgba(255, 159, 10, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, targetY);
      ctx.lineTo(w, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (len > 1) {
        const stepX = w / (len - 1);

        // 1. Plot Motor PWM (Telemetry Blue #0077FF / 0.5 opacity)
        ctx.strokeStyle = 'rgba(0, 119, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = i * stepX;
          const y = zeroY - (hist.motorPwm[i] / 255) * (h * 0.45);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 2. Plot Gyro Angular Velocity (Tuning Amber #FF9F0A / 0.5 opacity)
        ctx.strokeStyle = 'rgba(255, 159, 10, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = i * stepX;
          const y = zeroY - (hist.gyroY[i] / 120) * (h * 0.4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 3. Plot MPU6050 Pitch Angle (Electric Cyan #00F0FF, bold 2px)
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = i * stepX;
          const y = zeroY - hist.pitch[i] * scaleY;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Pulse dot on current live value
        const lastX = (len - 1) * stepX;
        const lastY = zeroY - hist.pitch[len - 1] * scaleY;
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [config.targetPitchOffset]);

  const handleApplyDivider = () => {
    let cells = 3;
    if (batteryTypeInput === '2S_LIPO') cells = 2;
    if (batteryTypeInput === '4S_LIPO') cells = 4;

    robotManager.updateVoltageDivider({
      r1Ohms: r1Input,
      r2Ohms: r2Input,
      calibMultiplier: calibInput,
      capacityMah: capacityInput,
      batteryType: batteryTypeInput,
      cellCount: cells
    });
  };

  // Select whether to display raw or smoothed values on cards
  const displayPitch = smoothingMode === 'raw' ? imu.pitch : smoothedImu.pitch;
  const displayGyroY = smoothingMode === 'raw' ? imu.gyroY : smoothedImu.gyroY;
  const displayPwmL = smoothingMode === 'raw' ? motor.leftPwm : smoothedMotor.leftPwm;
  const displayPwmR = smoothingMode === 'raw' ? motor.rightPwm : smoothedMotor.rightPwm;
  const displayRpmL = smoothingMode === 'raw' ? motor.leftRpm : smoothedMotor.leftRpm;
  const displayRpmR = smoothingMode === 'raw' ? motor.rightRpm : smoothedMotor.rightRpm;
  const displayCurrent = smoothingMode === 'raw' ? motor.currentDrawA : smoothedMotor.currentDrawA;

  // Render battery sparkline SVG path
  const vHistory = detailedBattery.voltageHistory || [detailedBattery.batteryVoltage];
  const minV = Math.min(...vHistory, detailedBattery.batteryVoltage - 0.05);
  const maxV = Math.max(...vHistory, detailedBattery.batteryVoltage + 0.05);
  const rangeV = Math.max(0.1, maxV - minV);

  const sparklineWidth = 140;
  const sparklineHeight = 36;
  const sparklinePoints = vHistory.map((val, idx) => {
    const x = vHistory.length > 1 ? (idx / (vHistory.length - 1)) * sparklineWidth : sparklineWidth / 2;
    const y = sparklineHeight - ((val - minV) / rangeV) * (sparklineHeight - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="space-y-4">
      {/* Sensor Display Stabilization & Oscillogram Controls Bar */}
      <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Human-Readable Smoothing Mode Selector */}
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#00f0ff]" />
          <span className="text-[#94a3b8] uppercase font-semibold">DIGITAL DISPLAY DAMPING:</span>
          <div className="flex items-center gap-1 bg-[#0b0f17] p-0.5 rounded-[3px] border border-[#1e293b]">
            <button
              onClick={() => robotManager.setSmoothingMode('raw')}
              className={`px-2.5 py-1 rounded-[2px] transition-all ${
                smoothingMode === 'raw'
                  ? 'bg-[#ff9f0a] text-black font-bold shadow-[0_0_8px_#ff9f0a]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Raw 100Hz unfiltered numerical readings"
            >
              RAW 100HZ
            </button>
            <button
              onClick={() => robotManager.setSmoothingMode('smooth_fast')}
              className={`px-2.5 py-1 rounded-[2px] transition-all ${
                smoothingMode === 'smooth_fast'
                  ? 'bg-[#0077ff] text-white font-bold shadow-[0_0_8px_#0077ff]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Fast response with digit jitter reduction"
            >
              SMOOTH (FAST)
            </button>
            <button
              onClick={() => robotManager.setSmoothingMode('smooth_readable')}
              className={`px-2.5 py-1 rounded-[2px] transition-all ${
                smoothingMode === 'smooth_readable'
                  ? 'bg-[#00e676] text-black font-bold shadow-[0_0_8px_#00e676]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Calm steady reading for stress-free cockpit monitoring"
            >
              STEADY (READABLE)
            </button>
          </div>
        </div>

        {/* Status Callout, Voltage Divider & Recharts Battery Health Toggle */}
        <div className="flex items-center gap-2">
          <span className="hidden lg:inline-block text-[11px] text-[#64748b]">
            Control loop: 100Hz · Visuals: 60 FPS
          </span>
          <button
            onClick={() => setShowBatteryChart(!showBatteryChart)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] border transition-colors ${
              showBatteryChart
                ? 'bg-[#00e676]/20 border-[#00e676] text-[#00e676]'
                : 'bg-[#1a2438] border-[#1e293b] text-[#94a3b8] hover:text-white'
            }`}
            title="Visualizar tendencias históricas de batería y predicción de descarga con Recharts"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>SALUD BATERÍA (RECHARTS)</span>
          </button>
          <button
            onClick={() => setShowDividerConfig(!showDividerConfig)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] border transition-colors ${
              showDividerConfig
                ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff]'
                : 'bg-[#1a2438] border-[#1e293b] text-[#94a3b8] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>DIVISOR</span>
            {showDividerConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Real-time Oscillogram Scope */}
      <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1e293b]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00f0ff]" />
            <span className="font-space font-semibold text-white tracking-wide text-sm">
              REAL-TIME LOW-LATENCY OSCILLOGRAM (HIGH FREQUENCY 60FPS)
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1.5 text-[#00f0ff]">
                <span className="w-3 h-0.5 bg-[#00f0ff]" /> PITCH (θ)
              </span>
              <span className="flex items-center gap-1.5 text-[#0077ff]">
                <span className="w-3 h-0.5 bg-[#0077ff]" /> MOTOR PWM
              </span>
              <span className="flex items-center gap-1.5 text-[#ff9f0a]">
                <span className="w-3 h-0.5 bg-[#ff9f0a]" /> GYRO (ω)
              </span>
            </div>

            {/* Time Window Buttons */}
            <div className="flex items-center gap-1 bg-[#0b0f17] p-0.5 rounded-[2px] border border-[#1e293b] text-xs font-mono">
              {[3, 5, 10].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setTimeWindowSec(sec)}
                  className={`px-2 py-0.5 rounded-[2px] ${
                    timeWindowSec === sec ? 'bg-[#0077ff] text-white font-bold' : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  {sec}S
                </button>
              ))}
            </div>

            {/* Pause/Play Button */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1 rounded-[2px] bg-[#0b0f17] border border-[#1e293b] text-[#94a3b8] hover:text-white"
              title={isPaused ? 'Resume live stream' : 'Pause frame'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-[#00e676]" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="relative mt-3 h-48 sm:h-56 w-full rounded-[3px] overflow-hidden border border-[#1e293b]">
          <canvas
            ref={canvasRef}
            width={800}
            height={220}
            className="w-full h-full block"
          />
          <div className="absolute left-2 top-2 text-[10px] font-mono text-[#00f0ff]/80">
            +30.0°
          </div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#94a3b8]">
            0.0°
          </div>
          <div className="absolute left-2 bottom-2 text-[10px] font-mono text-[#00f0ff]/80">
            -30.0°
          </div>
        </div>
      </div>

      {/* Grid of Precision Telemetry Cards with Battery Voltage History Sparkline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Pitch Angle (with smoothing applied) */}
        <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-[#94a3b8] flex justify-between">
            <span>PITCH (θ)</span>
            <span className="text-[#00e676]">
              {smoothingMode === 'raw' ? 'RAW 100HZ' : 'STABILIZED'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-2xl sm:text-3xl font-semibold font-mono ${
              Math.abs(displayPitch) < 3.0 ? 'text-[#00e676]' : 'text-[#00f0ff]'
            }`}>
              {displayPitch > 0 ? `+${displayPitch.toFixed(1)}` : displayPitch.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-[#94a3b8]">DEG</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-[#64748b] flex justify-between">
            <span>TARGET: {config.targetPitchOffset}°</span>
            <span>ERR: {(displayPitch - config.targetPitchOffset).toFixed(1)}°</span>
          </div>
        </div>

        {/* Metric 2: Angular Velocity (Gyro Y) */}
        <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-[#94a3b8] flex justify-between">
            <span>ANGULAR RATE (ω)</span>
            <span className="text-[#00f0ff]">MPU6050</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-semibold font-mono text-[#00f0ff]">
              {displayGyroY > 0 ? `+${displayGyroY.toFixed(0)}` : displayGyroY.toFixed(0)}
            </span>
            <span className="text-xs font-mono text-[#94a3b8]">DEG/S</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-[#64748b] flex justify-between">
            <span>FILTER: KALMAN DMP</span>
            <span>100 HZ</span>
          </div>
        </div>

        {/* Metric 3: Motor Output Drive */}
        <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-[#94a3b8] flex justify-between">
            <span>MOTOR DRIVE (PWM)</span>
            <span className="text-[#0077ff]">DUAL BLDC</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-semibold font-mono text-[#0077ff]">
              L:{displayPwmL} <span className="text-lg text-white">/</span> R:{displayPwmR}
            </span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-[#64748b] flex justify-between">
            <span>RPM: {displayRpmL} / {displayRpmR}</span>
            <span>I: {displayCurrent.toFixed(2)}A</span>
          </div>
        </div>

        {/* Metric 4: BATTERY PACK WITH INTEGRATED VOLTAGE HISTORY SPARKLINE */}
        <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-3 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.05em] text-[#94a3b8]">
            <span className="flex items-center gap-1 text-[#00e676]">
              <Battery className="w-3.5 h-3.5" />
              {voltageDivider.batteryType.replace('_', ' ')}
            </span>
            <span className={`font-bold ${detailedBattery.batteryPercent > 20 ? 'text-[#00e676]' : 'text-[#ff3b30] animate-pulse'}`}>
              {detailedBattery.batteryPercent}% REMAINING
            </span>
          </div>

          <div className="mt-1 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-semibold font-mono text-[#00e676]">
                {detailedBattery.batteryVoltage.toFixed(2)}
              </span>
              <span className="text-xs font-mono text-[#94a3b8]">V</span>
            </div>

            {/* SPARKLINE CHART: Battery Voltage History */}
            <div className="flex flex-col items-end">
              <div className="w-28 sm:w-32 h-8 relative">
                <svg
                  viewBox={`0 0 ${sparklineWidth} ${sparklineHeight}`}
                  className="w-full h-full overflow-visible"
                >
                  {/* Subtle Sparkline Grid Line */}
                  <line x1="0" y1={sparklineHeight / 2} x2={sparklineWidth} y2={sparklineHeight / 2} stroke="#1e293b" strokeDasharray="2,2" strokeWidth="1" />
                  {/* Sparkline stroke */}
                  <polyline
                    fill="none"
                    stroke="#00e676"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparklinePoints}
                  />
                  {/* Current live tip dot */}
                  {vHistory.length > 0 && (
                    <circle
                      cx={sparklineWidth}
                      cy={sparklineHeight - ((detailedBattery.batteryVoltage - minV) / rangeV) * (sparklineHeight - 6) - 3}
                      r="2.5"
                      fill="#00f0ff"
                    />
                  )}
                </svg>
              </div>
              <span className="text-[9px] font-mono text-[#94a3b8]">VOLTAGE SPARKLINE</span>
            </div>
          </div>

          {/* Cell breakdown & Capacity metrics */}
          <div className="mt-2 pt-1 border-t border-[#1e293b]/70 flex items-center justify-between text-[10px] font-mono text-[#64748b]">
            <span>CAP: {detailedBattery.remainingMah} / {voltageDivider.capacityMah} mAh</span>
            <button
              onClick={() => setShowBatteryChart(!showBatteryChart)}
              className="text-[#00f0ff] hover:underline flex items-center gap-1 font-bold"
            >
              <span>{showBatteryChart ? 'OCULTAR PROYECCIÓN' : 'VER PROYECCIÓN'}</span>
              <BarChart3 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* RECHARTS BATTERY HEALTH & PREDICTIVE RUNTIME PROJECTION */}
      {showBatteryChart && (
        <BatteryHealthChart
          detailedBattery={detailedBattery}
          voltageDivider={voltageDivider}
        />
      )}

      {/* DIVISOR DE VOLTAJE & BATTERY MONITOR MODULE */}
      {showDividerConfig && (
        <div className="bg-[#131b2a] border border-[#00f0ff]/50 rounded-[4px] p-4 font-mono text-xs space-y-4 animate-fade-in shadow-[0_0_20px_rgba(0,240,255,0.1)]">
          <div className="flex flex-wrap items-center justify-between pb-2 border-b border-[#1e293b] gap-2">
            <div className="flex items-center gap-2">
              <Battery className="w-4 h-4 text-[#00f0ff]" />
              <span className="font-space font-bold text-white text-sm">
                CALIBRACIÓN DEL DIVISOR DE TENSIÓN // ESTIMACIÓN DE BATERÍA
              </span>
            </div>
            <span className="text-[11px] text-[#00e676] bg-[#00e676]/10 px-2 py-0.5 rounded-[2px] border border-[#00e676]/30">
              ADC PIN: GPIO34 · 12-BIT (0 - 4095)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Column 1: Resistors & Calibration Inputs */}
            <div className="space-y-3 bg-[#0b0f17] p-3 rounded-[3px] border border-[#1e293b]">
              <div className="text-[10px] uppercase text-[#94a3b8] font-bold">
                PARÁMETROS HARDWARE DEL DIVISOR
              </div>

              <div>
                <label className="block text-[#94a3b8] text-[10px] mb-1">
                  RESISTENCIA R1 (SUPERIOR A V_BAT):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1000"
                    value={r1Input}
                    onChange={(e) => setR1Input(parseFloat(e.target.value) || 100000)}
                    className="w-full bg-[#131b2a] border border-[#1e293b] rounded-[2px] px-2 py-1 text-white font-mono focus:border-[#00f0ff] outline-none"
                  />
                  <span className="text-[#94a3b8]">Ω ({(r1Input / 1000).toFixed(0)}k)</span>
                </div>
              </div>

              <div>
                <label className="block text-[#94a3b8] text-[10px] mb-1">
                  RESISTENCIA R2 (INFERIOR A GND):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="500"
                    value={r2Input}
                    onChange={(e) => setR2Input(parseFloat(e.target.value) || 10000)}
                    className="w-full bg-[#131b2a] border border-[#1e293b] rounded-[2px] px-2 py-1 text-white font-mono focus:border-[#00f0ff] outline-none"
                  />
                  <span className="text-[#94a3b8]">Ω ({(r2Input / 1000).toFixed(0)}k)</span>
                </div>
              </div>

              <div>
                <label className="block text-[#94a3b8] text-[10px] mb-1">
                  FACTOR MULTIPLICADOR CALIBRACIÓN (K):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={calibInput}
                  onChange={(e) => setCalibInput(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-[#131b2a] border border-[#1e293b] rounded-[2px] px-2 py-1 text-[#ff9f0a] font-mono focus:border-[#ff9f0a] outline-none font-bold"
                />
              </div>

              <button
                onClick={handleApplyDivider}
                className="w-full mt-2 py-1.5 bg-[#0077ff] hover:bg-[#00f0ff] hover:text-black text-white font-bold rounded-[2px] transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>GUARDAR CALIBRACIÓN</span>
              </button>
            </div>

            {/* Column 2: Pack Chemistry & Cell Balancer */}
            <div className="space-y-3 bg-[#0b0f17] p-3 rounded-[3px] border border-[#1e293b]">
              <div className="text-[10px] uppercase text-[#94a3b8] font-bold">
                TIPO DE BATERÍA & CAPACIDAD
              </div>

              <div>
                <label className="block text-[#94a3b8] text-[10px] mb-1">QUÍMICA / CELDAS:</label>
                <select
                  value={batteryTypeInput}
                  onChange={(e: any) => setBatteryTypeInput(e.target.value)}
                  className="w-full bg-[#131b2a] border border-[#1e293b] rounded-[2px] px-2 py-1 text-white font-mono outline-none"
                >
                  <option value="3S_LIPO">3S LiPo (11.1V Nom / 12.6V Full)</option>
                  <option value="2S_LIPO">2S LiPo (7.4V Nom / 8.4V Full)</option>
                  <option value="4S_LIPO">4S LiPo (14.8V Nom / 16.8V Full)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#94a3b8] text-[10px] mb-1">CAPACIDAD NOMINAL (MAH):</label>
                <input
                  type="number"
                  step="100"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(parseInt(e.target.value) || 2200)}
                  className="w-full bg-[#131b2a] border border-[#1e293b] rounded-[2px] px-2 py-1 text-white font-mono outline-none"
                />
              </div>

              {/* Individual Cell Breakdown */}
              <div className="pt-2 border-t border-[#1e293b]">
                <div className="text-[10px] text-[#94a3b8] uppercase mb-1">BALANCE INDIVIDUAL DE CELDAS:</div>
                <div className="space-y-1.5">
                  {detailedBattery.cellVoltages.map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-[#94a3b8]">CELDA {i + 1}:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-[#1e293b] rounded-full overflow-hidden">
                          <div
                            className={`h-full ${v > 3.7 ? 'bg-[#00e676]' : 'bg-[#ff3b30]'}`}
                            style={{ width: `${Math.max(0, Math.min(100, ((v - 3.3) / (4.2 - 3.3)) * 100))}%` }}
                          />
                        </div>
                        <span className="font-bold text-white min-w-[42px]">{v.toFixed(2)}V</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 3: Telemetry Diagnostics & Formula Schema */}
            <div className="space-y-3 bg-[#0b0f17] p-3 rounded-[3px] border border-[#1e293b] flex flex-col justify-between">
              <div>
                <div className="text-[10px] uppercase text-[#94a3b8] font-bold mb-2">
                  TELEMETRÍA EN TIEMPO REAL DEL ADC
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between border-b border-[#1e293b]/50 pb-1">
                    <span className="text-[#94a3b8]">TENSIÓN PACK REAL:</span>
                    <span className="text-[#00e676] font-bold">{detailedBattery.batteryVoltage.toFixed(2)} V</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1e293b]/50 pb-1">
                    <span className="text-[#94a3b8]">VOLTAJE EN PIN GPIO:</span>
                    <span className="text-[#00f0ff] font-bold">{detailedBattery.adcPinVoltage.toFixed(3)} V</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1e293b]/50 pb-1">
                    <span className="text-[#94a3b8]">LECTURA RAW ADC:</span>
                    <span className="text-white font-bold">{detailedBattery.rawAdcCount} / 4095</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1e293b]/50 pb-1">
                    <span className="text-[#94a3b8]">RATIO CALCULADO:</span>
                    <span className="text-[#ff9f0a] font-bold">{detailedBattery.dividerRatio.toFixed(2)}:1</span>
                  </div>
                </div>
              </div>

              {/* Mathematical Formula Preview */}
              <div className="bg-[#131b2a] p-2 rounded-[2px] border border-[#1e293b] text-[10px] text-[#94a3b8]">
                <div className="text-[#00f0ff] font-bold mb-0.5">FÓRMULA DIVISOR:</div>
                <code>V_BAT = V_PIN × [(R1 + R2) / R2] × K</code>
                <div className="text-[#64748b] mt-1">
                  Protege el ESP32 manteniendo la entrada ADC por debajo de los 3.3V máximos.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sensor Breakdown: 6-DOF Raw Vectors & Encoders */}
      <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-3 font-mono text-xs">
        <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-[#94a3b8] mb-2 flex items-center justify-between">
          <span>MPU-6050 6-AXIS REGISTERS & ENCODER TELEMETRY</span>
          <span className="text-[#00f0ff]">I2C ADDRESS: 0x68</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="bg-[#0b0f17] p-2 rounded-[2px] border border-[#1e293b]">
            <span className="text-[#94a3b8]">ACCEL X, Y, Z: </span>
            <div className="text-white font-bold mt-0.5">
              {smoothedImu.accelX.toFixed(2)}g / {smoothedImu.accelY.toFixed(2)}g / {smoothedImu.accelZ.toFixed(2)}g
            </div>
          </div>
          <div className="bg-[#0b0f17] p-2 rounded-[2px] border border-[#1e293b]">
            <span className="text-[#94a3b8]">GYRO X, Y, Z: </span>
            <div className="text-[#00f0ff] font-bold mt-0.5">
              {smoothedImu.gyroX.toFixed(1)} / {smoothedImu.gyroY.toFixed(1)} / {smoothedImu.gyroZ.toFixed(1)} °/s
            </div>
          </div>
          <div className="bg-[#0b0f17] p-2 rounded-[2px] border border-[#1e293b]">
            <span className="text-[#94a3b8]">WHEEL ENCODERS: </span>
            <div className="text-white font-bold mt-0.5">
              L: {motor.encoderLeft} | R: {motor.encoderRight}
            </div>
          </div>
          <div className="bg-[#0b0f17] p-2 rounded-[2px] border border-[#1e293b]">
            <span className="text-[#94a3b8]">THERMAL & LOAD: </span>
            <div className="text-[#ff9f0a] font-bold mt-0.5">
              MPU: {imu.temperature}°C | MOT: {motor.motorTempC}°C
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
