import React, { useState } from 'react';
import { RobotConfig } from '../types/telemetry';
import { robotManager } from '../services/bleService';
import { Sliders, Save, RotateCcw, ShieldCheck, Zap, HelpCircle } from 'lucide-react';

interface PidTuningDrawerProps {
  config: RobotConfig;
}

export const PidTuningDrawer: React.FC<PidTuningDrawerProps> = ({ config }) => {
  const [localConfig, setLocalConfig] = useState<RobotConfig>(config);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeLoop, setActiveLoop] = useState<'balance' | 'velocity' | 'yaw' | 'safety'>('balance');

  const updateParam = (section: keyof RobotConfig, param: string, value: number) => {
    let updated: RobotConfig;
    if (typeof localConfig[section] === 'object' && localConfig[section] !== null) {
      updated = {
        ...localConfig,
        [section]: {
          ...(localConfig[section] as any),
          [param]: value
        }
      };
    } else {
      updated = {
        ...localConfig,
        [section]: value
      };
    }
    setLocalConfig(updated);
    robotManager.updateConfig(updated);
  };

  const handleFlashSave = () => {
    robotManager.updateConfig(localConfig);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Preset profiles
  const applyPreset = (presetName: string) => {
    let p: Partial<RobotConfig> = {};
    if (presetName === 'STABLE') {
      p = {
        balancePid: { kp: 19.5, ki: 0.95, kd: 1.6 },
        velocityPid: { kp: 2.0, ki: 0.12, kd: 0.0 },
        yawPid: { kp: 3.2, ki: 0.0, kd: 0.4 },
        maxSpeedPercent: 75,
        expoRate: 0.4
      };
    } else if (presetName === 'AGILE') {
      p = {
        balancePid: { kp: 24.0, ki: 1.2, kd: 1.9 },
        velocityPid: { kp: 3.5, ki: 0.25, kd: 0.0 },
        yawPid: { kp: 4.8, ki: 0.0, kd: 0.5 },
        maxSpeedPercent: 100,
        expoRate: 0.25
      };
    } else if (presetName === 'SMOOTH') {
      p = {
        balancePid: { kp: 15.0, ki: 0.6, kd: 1.2 },
        velocityPid: { kp: 1.5, ki: 0.08, kd: 0.0 },
        yawPid: { kp: 2.5, ki: 0.0, kd: 0.3 },
        maxSpeedPercent: 60,
        expoRate: 0.5
      };
    }
    const updated = { ...localConfig, ...p };
    setLocalConfig(updated);
    robotManager.updateConfig(updated);
  };

  return (
    <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#1e293b] gap-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#ff9f0a]" />
          <span className="font-space font-semibold text-white tracking-wide text-sm">
            INVERTED PENDULUM PID STABILIZATION // TUNER
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Flash EEPROM save button */}
          <button
            onClick={handleFlashSave}
            className={`flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-bold rounded-[3px] transition-all border ${
              saveSuccess
                ? 'bg-[#00e676]/20 border-[#00e676] text-[#00e676]'
                : 'bg-[#ff9f0a]/20 border-[#ff9f0a] text-[#ff9f0a] hover:bg-[#ff9f0a]/30'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saveSuccess ? 'SYNCED TO FLASH!' : 'SYNC TO ESP32'}</span>
          </button>
        </div>
      </div>

      {/* Preset Profiles Ribbon */}
      <div className="flex items-center gap-2 my-3 overflow-x-auto text-xs font-mono">
        <span className="text-[#94a3b8] text-[10px] uppercase tracking-wider">PROFILES:</span>
        <button
          onClick={() => applyPreset('STABLE')}
          className="px-2.5 py-1 rounded-[2px] bg-[#0b0f17] border border-[#1e293b] text-white hover:border-[#00f0ff] transition-colors"
        >
          STABLE BALANCE
        </button>
        <button
          onClick={() => applyPreset('AGILE')}
          className="px-2.5 py-1 rounded-[2px] bg-[#0b0f17] border border-[#1e293b] text-white hover:border-[#ff9f0a] transition-colors"
        >
          HIGH-SPEED AGILE
        </button>
        <button
          onClick={() => applyPreset('SMOOTH')}
          className="px-2.5 py-1 rounded-[2px] bg-[#0b0f17] border border-[#1e293b] text-white hover:border-[#00e676] transition-colors"
        >
          SMOOTH INDOOR
        </button>
      </div>

      {/* Tab Selector: Balance Loop vs Velocity vs Yaw vs Safety */}
      <div className="flex items-center gap-1 bg-[#0b0f17] p-1 rounded-[3px] border border-[#1e293b] mb-4 text-xs font-mono">
        <button
          onClick={() => setActiveLoop('balance')}
          className={`flex-1 py-1.5 rounded-[2px] font-semibold transition-all ${
            activeLoop === 'balance' ? 'bg-[#0077ff] text-white' : 'text-[#94a3b8] hover:text-white'
          }`}
        >
          BALANCE LOOP (θ)
        </button>
        <button
          onClick={() => setActiveLoop('velocity')}
          className={`flex-1 py-1.5 rounded-[2px] font-semibold transition-all ${
            activeLoop === 'velocity' ? 'bg-[#0077ff] text-white' : 'text-[#94a3b8] hover:text-white'
          }`}
        >
          VELOCITY LOOP (V)
        </button>
        <button
          onClick={() => setActiveLoop('yaw')}
          className={`flex-1 py-1.5 rounded-[2px] font-semibold transition-all ${
            activeLoop === 'yaw' ? 'bg-[#0077ff] text-white' : 'text-[#94a3b8] hover:text-white'
          }`}
        >
          YAW STEER (ψ)
        </button>
        <button
          onClick={() => setActiveLoop('safety')}
          className={`flex-1 py-1.5 rounded-[2px] font-semibold transition-all ${
            activeLoop === 'safety' ? 'bg-[#0077ff] text-white' : 'text-[#94a3b8] hover:text-white'
          }`}
        >
          SAFETY & TRIM
        </button>
      </div>

      {/* Sliders Container with #FF9F0A illuminated fill and custom rectangular thumbs */}
      <div className="space-y-4 flex-1">
        {/* LOOP 1: BALANCE PID */}
        {activeLoop === 'balance' && (
          <div className="space-y-4 font-mono">
            {/* Kp */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-bold">Kp (PROPORTIONAL GAIN)</span>
                <span className="text-[#ff9f0a] font-bold text-sm">{localConfig.balancePid.kp.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="5.0"
                max="45.0"
                step="0.25"
                value={localConfig.balancePid.kp}
                onChange={(e) => updateParam('balancePid', 'kp', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#ff9f0a]"
              />
              <div className="text-[10px] text-[#64748b]">
                Counteracts tilt immediately. Higher = firmer upright hold; too high = rapid oscillation.
              </div>
            </div>

            {/* Ki */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-bold">Ki (INTEGRAL ACCUMULATOR)</span>
                <span className="text-[#ff9f0a] font-bold text-sm">{localConfig.balancePid.ki.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="3.0"
                step="0.05"
                value={localConfig.balancePid.ki}
                onChange={(e) => updateParam('balancePid', 'ki', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#ff9f0a]"
              />
              <div className="text-[10px] text-[#64748b]">
                Eliminates steady-state lean error caused by uneven payload weight.
              </div>
            </div>

            {/* Kd */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-bold">Kd (DERIVATIVE DAMPING)</span>
                <span className="text-[#ff9f0a] font-bold text-sm">{localConfig.balancePid.kd.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="4.0"
                step="0.05"
                value={localConfig.balancePid.kd}
                onChange={(e) => updateParam('balancePid', 'kd', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#ff9f0a]"
              />
              <div className="text-[10px] text-[#64748b]">
                Damps out pendulum wobble using MPU6050 Gyro Y angular rate feedback.
              </div>
            </div>
          </div>
        )}

        {/* LOOP 2: VELOCITY PID */}
        {activeLoop === 'velocity' && (
          <div className="space-y-4 font-mono">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-bold">Kp (SPEED FEEDFORWARD)</span>
                <span className="text-[#00f0ff] font-bold text-sm">{localConfig.velocityPid.kp.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="6.0"
                step="0.1"
                value={localConfig.velocityPid.kp}
                onChange={(e) => updateParam('velocityPid', 'kp', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
              />
              <div className="text-[10px] text-[#64748b]">
                Converts forward joystick throttle into forward chassis pitch lean.
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-bold">Ki (CRUISE DRIFT COMPENSATION)</span>
                <span className="text-[#00f0ff] font-bold text-sm">{localConfig.velocityPid.ki.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.02"
                value={localConfig.velocityPid.ki}
                onChange={(e) => updateParam('velocityPid', 'ki', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
              />
            </div>
          </div>
        )}

        {/* LOOP 3: YAW STEERING */}
        {activeLoop === 'yaw' && (
          <div className="space-y-4 font-mono">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-bold">Kp (STEERING DIFFERENTIAL GAIN)</span>
                <span className="text-[#0077ff] font-bold text-sm">{localConfig.yawPid.kp.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.2"
                value={localConfig.yawPid.kp}
                onChange={(e) => updateParam('yawPid', 'kp', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#0077ff]"
              />
              <div className="text-[10px] text-[#64748b]">
                Controls turn responsiveness between Left and Right wheel motors.
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-bold">Kd (YAW GYRO DAMPING)</span>
                <span className="text-[#0077ff] font-bold text-sm">{localConfig.yawPid.kd.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={localConfig.yawPid.kd}
                onChange={(e) => updateParam('yawPid', 'kd', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#0077ff]"
              />
            </div>
          </div>
        )}

        {/* LOOP 4: SAFETY & TRIM */}
        {activeLoop === 'safety' && (
          <div className="space-y-4 font-mono text-xs">
            {/* Target Balance Angle Offset */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">MECHANICAL BALANCE TRIM (θ OFFSET)</span>
                <span className="text-[#ff9f0a] font-bold">{localConfig.targetPitchOffset.toFixed(2)}°</span>
              </div>
              <input
                type="range"
                min="-4.0"
                max="4.0"
                step="0.1"
                value={localConfig.targetPitchOffset}
                onChange={(e) => updateParam('targetPitchOffset', '', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#ff9f0a]"
              />
              <div className="text-[10px] text-[#64748b]">
                Calibrates physical weight balance so the robot stays stationary at zero stick.
              </div>
            </div>

            {/* Max Tilt Angle Cutoff */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">FALL SAFETY CUTOFF THRESHOLD</span>
                <span className="text-[#ff3b30] font-bold">{localConfig.maxTiltAngle}°</span>
              </div>
              <input
                type="range"
                min="20"
                max="55"
                step="1"
                value={localConfig.maxTiltAngle}
                onChange={(e) => updateParam('maxTiltAngle', '', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#ff3b30]"
              />
              <div className="text-[10px] text-[#64748b]">
                Instantly shuts off motor power if robot trips past this angle to prevent motor burnout.
              </div>
            </div>

            {/* Speed Limiter */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">MAX SPEED LIMITER</span>
                <span className="text-[#00e676] font-bold">{localConfig.maxSpeedPercent}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                step="5"
                value={localConfig.maxSpeedPercent}
                onChange={(e) => updateParam('maxSpeedPercent', '', parseInt(e.target.value))}
                className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#00e676]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
