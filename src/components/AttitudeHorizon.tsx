import React, { useState } from 'react';
import { ImuData, RobotConfig, SystemMetrics } from '../types/telemetry';
import { robotManager } from '../services/bleService';
import { RotateCw, Target, Shield, Gauge, Activity, CheckCircle2 } from 'lucide-react';

interface AttitudeHorizonProps {
  imu: ImuData;
  config: RobotConfig;
  system: SystemMetrics;
}

export const AttitudeHorizon: React.FC<AttitudeHorizonProps> = ({
  imu,
  config,
  system
}) => {
  const [calibrating, setCalibrating] = useState(false);
  const [calibratedSuccess, setCalibratedSuccess] = useState(false);

  // Angle calculations
  const pitchClamped = Math.max(-60, Math.min(60, imu.pitch));
  const rollClamped = Math.max(-45, Math.min(45, imu.roll));
  const isUpright = Math.abs(imu.pitch) < 3.0;
  const isWarning = Math.abs(imu.pitch) > config.maxTiltAngle * 0.7;

  const handleCalibrate = () => {
    setCalibrating(true);
    setTimeout(() => {
      robotManager.calibrateZeroOffset();
      setCalibrating(false);
      setCalibratedSuccess(true);
      setTimeout(() => setCalibratedSuccess(false), 3000);
    }, 1200);
  };

  return (
    <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00f0ff]" />
          <span className="font-space font-semibold text-white tracking-wide text-sm">
            INVERTED PENDULUM // ATTITUDE HORIZON
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCalibrate}
            disabled={calibrating}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono border border-[#00f0ff]/50 rounded-[3px] text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-all disabled:opacity-50"
            title="Zero-level calibrate MPU6050 accelerometer & gyro offsets"
          >
            <RotateCw className={`w-3.5 h-3.5 ${calibrating ? 'animate-spin' : ''}`} />
            <span>{calibrating ? 'CALIBRATING...' : 'ZERO IMU'}</span>
          </button>
          {calibratedSuccess && (
            <span className="text-xs text-[#00e676] font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> LOCKED
            </span>
          )}
        </div>
      </div>

      {/* Main Visualizer: Artificial Horizon + Chassis Pendulum Stick */}
      <div className="relative my-3 w-full h-56 sm:h-64 bg-[#0b0f17] border border-[#1e293b] rounded-[4px] overflow-hidden flex items-center justify-center">
        {/* Sky / Ground Pitch Horizon background */}
        <div
          className="absolute inset-0 transition-transform duration-75 origin-center pointer-events-none"
          style={{
            transform: `rotate(${-rollClamped}deg) translateY(${pitchClamped * 2.2}px)`
          }}
        >
          {/* Artificial Sky */}
          <div className="w-full h-1/2 bg-[#0077ff]/10 border-b-2 border-[#00f0ff] relative">
            {/* Pitch Ladder Marks */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 text-[10px] font-mono text-[#00f0ff]/70">
              <div className="w-6 h-[1px] bg-[#00f0ff]/60" />
              <span>+10°</span>
              <div className="w-6 h-[1px] bg-[#00f0ff]/60" />
            </div>
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3 text-[10px] font-mono text-[#00f0ff]/70">
              <div className="w-10 h-[1.5px] bg-[#00f0ff]" />
              <span>+20°</span>
              <div className="w-10 h-[1.5px] bg-[#00f0ff]" />
            </div>
          </div>
          {/* Artificial Ground */}
          <div className="w-full h-1/2 bg-[#1a2438]/50 relative">
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 text-[10px] font-mono text-[#94a3b8]/70">
              <div className="w-6 h-[1px] bg-[#94a3b8]/60" />
              <span>-10°</span>
              <div className="w-6 h-[1px] bg-[#94a3b8]/60" />
            </div>
            <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-3 text-[10px] font-mono text-[#94a3b8]/70">
              <div className="w-10 h-[1.5px] bg-[#94a3b8]" />
              <span>-20°</span>
              <div className="w-10 h-[1.5px] bg-[#94a3b8]" />
            </div>
          </div>
        </div>

        {/* Center Reticle / Inverted Pendulum Model Overlay */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Upright Inverted Pendulum Robot Chassis representation */}
          <div
            className="flex flex-col items-center transition-transform duration-75 origin-bottom"
            style={{
              transform: `rotate(${pitchClamped}deg)`
            }}
          >
            {/* Center of Mass / Main Electronics Enclosure (ESP32 + Battery) */}
            <div className={`w-14 h-16 rounded-[4px] border-2 flex flex-col items-center justify-center p-1 shadow-lg ${
              isUpright
                ? 'bg-[#131b2a] border-[#00e676] shadow-[0_0_12px_rgba(0,230,118,0.3)]'
                : isWarning
                ? 'bg-[#1a2438] border-[#ff3b30] shadow-[0_0_12px_rgba(255,59,48,0.4)]'
                : 'bg-[#131b2a] border-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.3)]'
            }`}>
              <span className="text-[8px] font-mono font-bold text-[#94a3b8] tracking-tighter">ESP32</span>
              <div className="w-8 h-2 bg-[#00f0ff]/20 rounded-full my-0.5 border border-[#00f0ff]/40" />
              <span className="text-[9px] font-mono font-bold text-white">
                {imu.pitch > 0 ? `+${imu.pitch.toFixed(1)}°` : `${imu.pitch.toFixed(1)}°`}
              </span>
            </div>

            {/* Chassis Carbon Rod / Inverted Pendulum Stem */}
            <div className="w-1.5 h-12 bg-gradient-to-b from-[#00f0ff] to-[#0077ff] my-0.5 rounded-[1px]" />

            {/* Motor Axle Pivot & Wheels */}
            <div className="relative flex items-center justify-center">
              {/* Left Wheel */}
              <div className="w-3.5 h-10 bg-[#2d3545] border border-[#00f0ff]/60 rounded-[2px] shadow-md mr-4" />
              {/* Pivot Hub */}
              <div className="w-5 h-5 rounded-full bg-[#0077ff] border-2 border-white flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-black" />
              </div>
              {/* Right Wheel */}
              <div className="w-3.5 h-10 bg-[#2d3545] border border-[#00f0ff]/60 rounded-[2px] shadow-md ml-4" />
            </div>
          </div>

          {/* Ground Contact Line */}
          <div className="w-48 h-[2px] bg-[#1e293b] mt-1 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-1 bg-[#00e676] rounded-full" />
          </div>
        </div>

        {/* Upright Target Needle Indicator on Top Rim */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 pointer-events-none">
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#00e676]" />
          <span className="text-[9px] font-mono text-[#00e676] font-bold">0.0° TARGET</span>
        </div>

        {/* Status Callout Badge */}
        <div className="absolute bottom-2 left-3 z-20 bg-[#0b0f17]/90 px-2 py-1 rounded-[2px] border border-[#1e293b] text-xs font-mono">
          <span className="text-[#94a3b8] text-[10px]">STATE: </span>
          <span className={`font-bold ${
            system.isFallen 
              ? 'text-[#ff3b30]' 
              : isUpright 
              ? 'text-[#00e676]' 
              : 'text-[#00f0ff]'
          }`}>
            {system.isFallen ? 'TRIPPED / FALLEN' : isUpright ? 'NOMINAL LOCK' : 'PID BALANCING'}
          </span>
        </div>

        <div className="absolute bottom-2 right-3 z-20 bg-[#0b0f17]/90 px-2 py-1 rounded-[2px] border border-[#1e293b] text-xs font-mono">
          <span className="text-[#94a3b8] text-[10px]">OFFSET TRIM: </span>
          <span className="text-[#ff9f0a] font-bold">
            {config.targetPitchOffset > 0 ? `+${config.targetPitchOffset}°` : `${config.targetPitchOffset}°`}
          </span>
        </div>
      </div>

      {/* Axis Readouts Grid */}
      <div className="grid grid-cols-3 gap-2 text-center font-mono">
        {/* Pitch Theta */}
        <div className="bg-[#0b0f17] border border-[#1e293b] p-2 rounded-[3px]">
          <div className="text-[10px] text-[#94a3b8] uppercase tracking-[0.05em]">PITCH (θ)</div>
          <div className={`text-xl font-bold font-mono ${
            Math.abs(imu.pitch) < 3 ? 'text-[#00e676]' : 'text-[#00f0ff]'
          }`}>
            {imu.pitch > 0 ? `+${imu.pitch.toFixed(1)}°` : `${imu.pitch.toFixed(1)}°`}
          </div>
          <div className="text-[10px] text-[#64748b]">BALANCING AXIS</div>
        </div>

        {/* Angular Velocity Gyro Y */}
        <div className="bg-[#0b0f17] border border-[#1e293b] p-2 rounded-[3px]">
          <div className="text-[10px] text-[#94a3b8] uppercase tracking-[0.05em]">GYRO (ω)</div>
          <div className="text-xl font-bold font-mono text-[#00f0ff]">
            {imu.gyroY > 0 ? `+${imu.gyroY.toFixed(0)}` : `${imu.gyroY.toFixed(0)}`}
          </div>
          <div className="text-[10px] text-[#64748b]">DEG / SEC</div>
        </div>

        {/* Yaw Angle */}
        <div className="bg-[#0b0f17] border border-[#1e293b] p-2 rounded-[3px]">
          <div className="text-[10px] text-[#94a3b8] uppercase tracking-[0.05em]">YAW (ψ)</div>
          <div className="text-xl font-bold font-mono text-white">
            {Math.round(imu.yaw)}°
          </div>
          <div className="text-[10px] text-[#64748b]">HEADING</div>
        </div>
      </div>

      {/* Secondary MPU6050 Accelerometer & Temperature Ticker */}
      <div className="mt-2.5 pt-2 border-t border-[#1e293b] flex items-center justify-between text-[11px] font-mono text-[#94a3b8]">
        <div>
          <span>ACCEL: </span>
          <span className="text-white font-semibold">
            [{imu.accelX.toFixed(2)}, {imu.accelY.toFixed(2)}, {imu.accelZ.toFixed(2)}] g
          </span>
        </div>
        <div>
          <span>MPU TEMP: </span>
          <span className="text-[#ff9f0a] font-semibold">{imu.temperature}°C</span>
        </div>
      </div>
    </div>
  );
};
