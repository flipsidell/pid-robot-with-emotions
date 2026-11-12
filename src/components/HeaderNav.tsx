import React, { useState } from 'react';
import { 
  Bluetooth, 
  BluetoothConnected, 
  Radio, 
  Zap, 
  BatteryCharging, 
  AlertOctagon, 
  RefreshCw, 
  Cpu, 
  Sliders, 
  Gamepad2, 
  Activity, 
  Smile, 
  Download, 
  FileText,
  RotateCcw,
  Sparkles,
  Smartphone,
  Laptop,
  Monitor
} from 'lucide-react';
import { ConnectionStatus, SystemMetrics, DeviceViewMode } from '../types/telemetry';
import { robotManager } from '../services/bleService';

interface HeaderNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  system: SystemMetrics;
  connectionStatus: ConnectionStatus;
  onOpenOta: () => void;
  deviceMode: DeviceViewMode;
  setDeviceMode: (mode: DeviceViewMode) => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  setActiveTab,
  system,
  connectionStatus,
  onOpenOta,
  deviceMode,
  setDeviceMode
}) => {
  const [bleError, setBleError] = useState<string | null>(null);

  const handleConnectBle = async () => {
    setBleError(null);
    try {
      if (connectionStatus === 'connected') {
        robotManager.disconnectBle();
      } else {
        await robotManager.connectBle();
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setBleError(err.message || 'Failed to connect via BLE');
        setTimeout(() => setBleError(null), 4000);
      }
    }
  };

  const handleEmergencyStopToggle = () => {
    // Provide haptic feedback if available
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 200]);
    }
    if (system.emergencyStop) {
      robotManager.resetEmergencyStop();
    } else {
      robotManager.triggerEmergencyStop();
    }
  };

  const tabs = [
    { id: 'cockpit', label: 'COCKPIT', icon: Activity },
    { id: 'gamepad', label: 'DRIVE DECK', icon: Gamepad2 },
    { id: 'stabilization', label: 'PENDULUM IMU', icon: Sliders },
    { id: 'oled', label: 'EMOTION OLED', icon: Smile },
    { id: 'logger', label: 'LOGS & CSV', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0b0f17]/95 backdrop-blur-md border-b border-[#1e293b]">
      {/* Top telemetry status ribbon */}
      <div className="px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#1e293b]/60 text-xs font-mono">
        {/* Brand & Subsystem */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-pulse shadow-[0_0_8px_#00f0ff]" />
            <span className="font-space font-bold tracking-wider text-sm sm:text-base text-white">
              KINETIC <span className="text-[#00f0ff]">//</span> ROBOTICS
            </span>
          </div>
          <span className="hidden md:inline-block px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-[#131b2a] border border-[#1e293b] text-[#94a3b8]">
            2× ESP32 (FLIGHT + OLED) · MPU6050 · BLE
          </span>
        </div>

        {/* Real-time Hardware Telemetry Badges */}
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-0.5">
          {/* Packet Rate */}
          <div className="flex items-center gap-1.5 bg-[#131b2a] px-2 py-1 rounded-[2px] border border-[#1e293b]">
            <Radio className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span className="text-[#94a3b8] text-[10px]">RATE:</span>
            <span className="text-[#00f0ff] font-semibold">{system.packetRateHz} <span className="text-[10px] text-[#94a3b8]">HZ</span></span>
          </div>

          {/* Latency */}
          <div className="flex items-center gap-1.5 bg-[#131b2a] px-2 py-1 rounded-[2px] border border-[#1e293b]">
            <Zap className="w-3.5 h-3.5 text-[#ff9f0a]" />
            <span className="text-[#94a3b8] text-[10px]">PING:</span>
            <span className="text-[#ff9f0a] font-semibold">{system.latencyMs} <span className="text-[10px] text-[#94a3b8]">MS</span></span>
          </div>

          {/* RSSI Signal */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#131b2a] px-2 py-1 rounded-[2px] border border-[#1e293b]">
            <span className="text-[#94a3b8] text-[10px]">RSSI:</span>
            <span className="text-[#00e676] font-semibold">{system.rssi} <span className="text-[10px] text-[#94a3b8]">dBm</span></span>
          </div>

          {/* Battery Status */}
          <div className="flex items-center gap-1.5 bg-[#131b2a] px-2 py-1 rounded-[2px] border border-[#1e293b]">
            <BatteryCharging className={`w-3.5 h-3.5 ${system.batteryPercent > 20 ? 'text-[#00e676]' : 'text-[#ff3b30] animate-pulse'}`} />
            <span className="text-white font-semibold">{system.batteryVoltage.toFixed(1)}V</span>
            <span className={`text-[10px] font-bold ${system.batteryPercent > 20 ? 'text-[#00e676]' : 'text-[#ff3b30]'}`}>
              {system.batteryPercent}%
            </span>
          </div>

          {/* BLE Connection Switcher */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleConnectBle}
              title={connectionStatus === 'connected' ? 'Disconnect Hardware' : 'Scan & Connect ESP32 BLE'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] font-mono text-[11px] font-bold transition-all border ${
                connectionStatus === 'connected'
                  ? 'bg-[#00e676]/20 border-[#00e676] text-[#00e676]'
                  : connectionStatus === 'connecting'
                  ? 'bg-[#ff9f0a]/20 border-[#ff9f0a] text-[#ff9f0a] animate-pulse'
                  : 'bg-[#0077ff]/20 border-[#00f0ff]/50 text-[#00f0ff] hover:bg-[#0077ff]/40'
              }`}
            >
              {connectionStatus === 'connected' ? (
                <>
                  <BluetoothConnected className="w-3.5 h-3.5" />
                  <span>BLE PAIRED</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>PAIRING...</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>PAIR BLE</span>
                </>
              )}
            </button>

            {/* Sim Toggle / Indicator */}
            {connectionStatus !== 'connected' && (
              <button
                onClick={() => robotManager.switchToSimulation()}
                className={`hidden md:flex items-center gap-1 px-2 py-1 rounded-[3px] border text-[10px] font-mono ${
                  connectionStatus === 'simulated'
                    ? 'border-[#00f0ff]/40 bg-[#00f0ff]/10 text-[#00f0ff]'
                    : 'border-[#1e293b] text-[#94a3b8]'
                }`}
                title="Physics Simulation Mode Active"
              >
                <Sparkles className="w-3 h-3 text-[#00f0ff]" />
                <span>PHYSICS SIM</span>
              </button>
            )}

            {/* Dual OTA Firmware Button */}
            <button
              onClick={onOpenOta}
              className="flex items-center gap-1 px-2 py-1 rounded-[3px] bg-[#1e293b] hover:bg-[#2d3748] border border-[#3b494b] text-[#dbe2f7] text-[11px] font-mono transition-colors"
              title="Dual ESP32 Remote Firmware OTA Update (Flight & OLED Display)"
            >
              <Download className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span className="hidden sm:inline">DUAL OTA</span>
            </button>

            {/* EMERGENCY STOP (KILL SWITCH) */}
            <button
              onClick={handleEmergencyStopToggle}
              title="Emergency Stop / Kill Switch (Shortcut: Press SPACEBAR anywhere)"
              className={`ml-1 px-3 py-1 font-mono font-black text-[11px] tracking-wider rounded-[3px] text-white transition-all shadow-md active:scale-95 flex items-center gap-1.5 ${
                system.emergencyStop
                  ? 'bg-[#ff3b30] shadow-[0_0_15px_#ff3b30] border border-white animate-pulse'
                  : 'hazard-hatch hover:brightness-110 border border-[#ff3b30]'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5 text-white" />
              <span>{system.emergencyStop ? 'E-STOPPED (RESET)' : 'KILL SWITCH'}</span>
              <kbd className="hidden sm:inline-block px-1 py-0.2 bg-black/40 border border-white/20 rounded-[2px] text-[9px] text-white/90 font-mono">
                SPACE
              </kbd>
            </button>
          </div>
        </div>
      </div>

      {/* BLE Error Banner if needed */}
      {bleError && (
        <div className="bg-[#ff3b30]/20 border-b border-[#ff3b30] px-4 py-1.5 text-xs font-mono text-[#ffb4ab] flex items-center justify-between">
          <span>{bleError}</span>
          <button onClick={() => setBleError(null)} className="underline ml-2">Dismiss</button>
        </div>
      )}

      {/* Navigation tabs */}
      <nav className="px-3 sm:px-6 flex items-center gap-1 sm:gap-2 overflow-x-auto py-1 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono tracking-wider font-semibold uppercase rounded-[3px] transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#0077ff] text-white shadow-[0_0_12px_rgba(0,119,255,0.4)] border border-[#00f0ff]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#131b2a] border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00f0ff]' : 'text-[#64748b]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}

        {/* Device Viewport Mode Switcher (Android, Laptop, Windows/Linux Desktop) */}
        <div className="ml-auto flex items-center gap-1 bg-[#131b2a] p-0.5 rounded-[3px] border border-[#1e293b] text-xs font-mono">
          <span className="text-[10px] text-[#64748b] px-1.5 hidden xl:inline">DISPOSITIVO:</span>
          <button
            onClick={() => setDeviceMode('android')}
            className={`px-2 py-1 rounded-[2px] flex items-center gap-1 text-[11px] transition-all ${
              deviceMode === 'android' ? 'bg-[#0077ff] text-white font-bold shadow-[0_0_8px_#0077ff]' : 'text-[#94a3b8] hover:text-white'
            }`}
            title="Optimizado para Celular Android (Touch, Thumbzone, Ribbon)"
          >
            <Smartphone className="w-3 h-3 text-[#00f0ff]" />
            <span className="hidden sm:inline">ANDROID</span>
          </button>
          <button
            onClick={() => setDeviceMode('laptop')}
            className={`px-2 py-1 rounded-[2px] flex items-center gap-1 text-[11px] transition-all ${
              deviceMode === 'laptop' ? 'bg-[#0077ff] text-white font-bold shadow-[0_0_8px_#0077ff]' : 'text-[#94a3b8] hover:text-white'
            }`}
            title="Optimizado para Laptop (13-15 Pulgadas)"
          >
            <Laptop className="w-3 h-3 text-[#00f0ff]" />
            <span className="hidden sm:inline">LAPTOP</span>
          </button>
          <button
            onClick={() => setDeviceMode('desktop')}
            className={`px-2 py-1 rounded-[2px] flex items-center gap-1 text-[11px] transition-all ${
              deviceMode === 'desktop' ? 'bg-[#0077ff] text-white font-bold shadow-[0_0_8px_#0077ff]' : 'text-[#94a3b8] hover:text-white'
            }`}
            title="Command Center para PC Windows / Linux (Ultrawide 12 Columnas)"
          >
            <Monitor className="w-3 h-3 text-[#00f0ff]" />
            <span className="hidden sm:inline">WIN / LINUX</span>
          </button>
          <button
            onClick={() => setDeviceMode('auto')}
            className={`px-1.5 py-1 rounded-[2px] text-[10px] transition-all ${
              deviceMode === 'auto' ? 'bg-[#00e676]/20 text-[#00e676] font-bold border border-[#00e676]/40' : 'text-[#64748b] hover:text-white'
            }`}
            title="Modo Automático según resolución de pantalla"
          >
            AUTO
          </button>
        </div>

        {/* Fall Safety Notification badge if inverted pendulum fallen */}
        {system.isFallen && !system.emergencyStop && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-[3px] bg-[#ff9f0a]/20 border border-[#ff9f0a] text-[#ff9f0a] text-xs font-mono animate-pulse">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>TILT CUTOFF</span>
            <button
              onClick={() => robotManager.resetEmergencyStop()}
              className="px-1.5 py-0.5 bg-[#ff9f0a] text-black font-bold text-[10px] rounded-[2px]"
            >
              RIGHT
            </button>
          </div>
        )}
      </nav>
    </header>
  );
};
