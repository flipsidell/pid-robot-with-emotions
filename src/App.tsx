import React, { useState, useEffect } from 'react';
import { robotManager } from './services/bleService';
import { 
  ImuData, 
  MotorTelemetry, 
  SystemMetrics, 
  RobotConfig, 
  RobotEmotion, 
  JoystickVector, 
  ConnectionStatus,
  OtaFirmwareStatus,
  DetailedBatteryMetrics,
  VoltageDividerConfig,
  DualEsp32Status,
  SensorSmoothingMode,
  DeviceViewMode
} from './types/telemetry';

import { HeaderNav } from './components/HeaderNav';
import { JoystickController } from './components/JoystickController';
import { AttitudeHorizon } from './components/AttitudeHorizon';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { PidTuningDrawer } from './components/PidTuningDrawer';
import { OledEmotionMatrix } from './components/OledEmotionMatrix';
import { OtaFirmwareModal } from './components/OtaFirmwareModal';
import { TelemetryLogger } from './components/TelemetryLogger';
import { RobotChassis3D } from './components/RobotChassis3D';

import { AlertOctagon, RotateCcw, ShieldAlert, Wifi, Battery, Zap, Activity } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('cockpit');
  const [isOtaOpen, setIsOtaOpen] = useState<boolean>(false);
  const [deviceMode, setDeviceMode] = useState<DeviceViewMode>('auto');

  // Sync state with singleton bleService
  const [imu, setImu] = useState<ImuData>(robotManager.imu);
  const [smoothedImu, setSmoothedImu] = useState<ImuData>(robotManager.smoothedImu);
  const [motor, setMotor] = useState<MotorTelemetry>(robotManager.motor);
  const [smoothedMotor, setSmoothedMotor] = useState<MotorTelemetry>(robotManager.smoothedMotor);
  const [system, setSystem] = useState<SystemMetrics>(robotManager.system);
  const [config, setConfig] = useState<RobotConfig>(robotManager.config);
  const [detailedBattery, setDetailedBattery] = useState<DetailedBatteryMetrics>(robotManager.detailedBattery);
  const [voltageDivider, setVoltageDivider] = useState<VoltageDividerConfig>(robotManager.voltageDivider);
  const [smoothingMode, setSmoothingMode] = useState<SensorSmoothingMode>(robotManager.smoothingMode);
  const [dualEsp32, setDualEsp32] = useState<DualEsp32Status>(robotManager.dualEsp32);
  const [currentEmotion, setCurrentEmotion] = useState<RobotEmotion>(robotManager.currentEmotion);
  const [joystick, setJoystick] = useState<JoystickVector>(robotManager.currentJoystick);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(robotManager.getConnectionStatus());
  const [otaStatus, setOtaStatus] = useState<OtaFirmwareStatus>(robotManager.otaStatus);
  const [isRecording, setIsRecording] = useState<boolean>(robotManager.isRecordingLogs);

  useEffect(() => {
    // High-frequency subscription (50Hz - 100Hz)
    const unsubscribe = robotManager.subscribe(() => {
      setImu({ ...robotManager.imu });
      setSmoothedImu({ ...robotManager.smoothedImu });
      setMotor({ ...robotManager.motor });
      setSmoothedMotor({ ...robotManager.smoothedMotor });
      setSystem({ ...robotManager.system });
      setConfig({ ...robotManager.config });
      setDetailedBattery({ ...robotManager.detailedBattery });
      setVoltageDivider({ ...robotManager.voltageDivider });
      setSmoothingMode(robotManager.smoothingMode);
      setDualEsp32({ ...robotManager.dualEsp32 });
      setCurrentEmotion(robotManager.currentEmotion);
      setJoystick({ ...robotManager.currentJoystick });
      setConnectionStatus(robotManager.getConnectionStatus());
      setOtaStatus({ ...robotManager.otaStatus });
      setIsRecording(robotManager.isRecordingLogs);
    });

    return () => unsubscribe();
  }, []);

  // Global Keyboard Shortcut: Spacebar triggers Emergency Kill Switch / E-Stop
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Exclude events when user is typing in form inputs, textareas, or selects
      const target = e.target as HTMLElement | null;
      if (
        target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        )
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // Prevent accidental page scrolling
        // Trigger haptic vibration if supported
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([120, 60, 200]);
        }
        if (robotManager.system.emergencyStop) {
          robotManager.resetEmergencyStop();
        } else {
          robotManager.triggerEmergencyStop();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-[#dbe2f7] flex flex-col font-sans selection:bg-[#0077ff] selection:text-white">
      {/* Top Header Navigation & Hardware Link Ribbon */}
      <HeaderNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        system={system}
        connectionStatus={connectionStatus}
        onOpenOta={() => setIsOtaOpen(true)}
        deviceMode={deviceMode}
        setDeviceMode={setDeviceMode}
      />

      {/* Main Content Area with multi-device responsive scaling */}
      <main className={`flex-1 py-2 sm:py-4 transition-all duration-200 w-full ${
        deviceMode === 'android'
          ? 'max-w-md mx-auto px-2 pb-8'
          : deviceMode === 'laptop'
          ? 'max-w-6xl mx-auto px-4'
          : deviceMode === 'desktop'
          ? 'max-w-[1720px] mx-auto px-4 sm:px-6'
          : 'max-w-7xl mx-auto px-2 sm:px-4 lg:px-6'
      }`}>
        {/* VIEW 1: COCKPIT (Complete Tri-Pane Overview) */}
        {activeTab === 'cockpit' && (
          <div className="space-y-4">
            {/* Top row: 3D Attitude Horizon, OLED Emotion Screen, and Robot Chassis */}
            <div className={`grid gap-4 ${
              deviceMode === 'android' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'
            }`}>
              <AttitudeHorizon imu={imu} config={config} system={system} />
              <OledEmotionMatrix
                currentEmotion={currentEmotion}
                joystick={joystick}
                system={system}
                imu={imu}
              />
              <RobotChassis3D
                imu={imu}
                motor={motor}
                emotion={currentEmotion}
                joystick={joystick}
              />
            </div>

            {/* Middle row: Virtual Joystick Thumbpad & Low-latency Canvas Oscillogram */}
            <div className={`grid gap-4 items-stretch ${
              deviceMode === 'android' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
            }`}>
              {/* Gamepad Joystick Card (5 cols on lg) */}
              <div className={`${
                deviceMode === 'android' ? 'w-full' : 'lg:col-span-5'
              } bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-4 flex flex-col items-center justify-center`}>
                <JoystickController
                  onVectorChange={setJoystick}
                  system={system}
                  imu={imu}
                  config={config}
                />
              </div>

              {/* PID Tuning Dock (7 cols on lg) */}
              <div className={deviceMode === 'android' ? 'w-full' : 'lg:col-span-7'}>
                <PidTuningDrawer config={config} />
              </div>
            </div>

            {/* Bottom: Comprehensive Telemetry Dashboard */}
            <TelemetryDashboard
              imu={imu}
              motor={motor}
              system={system}
              config={config}
              detailedBattery={detailedBattery}
              voltageDivider={voltageDivider}
              smoothingMode={smoothingMode}
              smoothedImu={smoothedImu}
              smoothedMotor={smoothedMotor}
            />
          </div>
        )}

        {/* VIEW 2: DRIVE DECK (Mobile-Optimized Touch Gamepad Interface) */}
        {activeTab === 'gamepad' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Top status strip */}
            <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <div className="bg-[#131b2a] p-2 rounded-[3px] border border-[#1e293b]">
                <span className="text-[#94a3b8] text-[10px]">BALANCE THETA</span>
                <div className={`text-lg font-bold ${Math.abs(imu.pitch) < 3 ? 'text-[#00e676]' : 'text-[#00f0ff]'}`}>
                  {imu.pitch > 0 ? `+${imu.pitch.toFixed(1)}°` : `${imu.pitch.toFixed(1)}°`}
                </div>
              </div>
              <div className="bg-[#131b2a] p-2 rounded-[3px] border border-[#1e293b]">
                <span className="text-[#94a3b8] text-[10px]">CURRENT DRAW</span>
                <div className="text-lg font-bold text-[#00e676]">
                  {motor.currentDrawA.toFixed(2)} A
                </div>
              </div>
              <div className="bg-[#131b2a] p-2 rounded-[3px] border border-[#1e293b]">
                <span className="text-[#94a3b8] text-[10px]">EMOTION</span>
                <div className="text-lg font-bold text-[#00f0ff]">
                  {currentEmotion}
                </div>
              </div>
            </div>

            {/* Large Mobile Drive Deck Card */}
            <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-4 sm:p-8 flex flex-col items-center shadow-lg">
              <JoystickController
                onVectorChange={setJoystick}
                system={system}
                imu={imu}
                config={config}
              />
            </div>

            {/* Compact Mini Horizon & Chassis under joystick */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AttitudeHorizon imu={imu} config={config} system={system} />
              <RobotChassis3D imu={imu} motor={motor} emotion={currentEmotion} joystick={joystick} />
            </div>
          </div>
        )}

        {/* VIEW 3: INVERTED PENDULUM IMU & PID LAB */}
        {activeTab === 'stabilization' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AttitudeHorizon imu={imu} config={config} system={system} />
              <PidTuningDrawer config={config} />
            </div>
            <TelemetryDashboard
              imu={imu}
              motor={motor}
              system={system}
              config={config}
              detailedBattery={detailedBattery}
              voltageDivider={voltageDivider}
              smoothingMode={smoothingMode}
              smoothedImu={smoothedImu}
              smoothedMotor={smoothedMotor}
            />
          </div>
        )}

        {/* VIEW 4: OLED EMOTION MATRIX */}
        {activeTab === 'oled' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <OledEmotionMatrix
              currentEmotion={currentEmotion}
              joystick={joystick}
              system={system}
              imu={imu}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <RobotChassis3D imu={imu} motor={motor} emotion={currentEmotion} joystick={joystick} />
              <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-4 flex flex-col justify-between font-mono text-xs">
                <div>
                  <div className="font-space font-semibold text-white text-sm mb-2">
                    HARDWARE DISPLAY ARCHITECTURE
                  </div>
                  <p className="text-[#94a3b8] leading-relaxed mb-3">
                    The robot utilizes an I2C 128x64 SSD1306 OLED display connected to ESP32-B GPIO21 (SDA) and GPIO22 (SCL).
                    Emotions are streamed over high-frequency ESP-NOW / BLE UART characteristics as single-byte tokens ($EMO,HAPPY\n).
                  </p>
                  <ul className="space-y-1 text-[#00f0ff] text-[11px]">
                    <li>• Refresh Rate: 20 FPS hardware framebuffer</li>
                    <li>• Dynamic Pupil Tracking: linked to BLE joystick vector</li>
                    <li>• Fall Protection Override: automatic DIZZY face on pitch cutoff</li>
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between text-[#64748b] text-[10px]">
                  <span>I2C BUS SPEED: 400 KHZ</span>
                  <span>POWER: 3.3V LDO</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: TELEMETRY LOGS & CSV */}
        {activeTab === 'logger' && (
          <div className="space-y-4">
            <TelemetryLogger
              isRecording={isRecording}
              system={system}
              imu={imu}
              motor={motor}
            />
          </div>
        )}
      </main>

      {/* Emergency Stop / Warning Sticky Bottom Banner if fallen or e-stopped */}
      {system.emergencyStop && (
        <div className="sticky bottom-0 z-40 bg-[#ff3b30] text-white p-3 font-mono text-center flex flex-wrap items-center justify-center gap-3 shadow-[0_-4px_20px_rgba(255,59,48,0.6)] animate-pulse">
          <AlertOctagon className="w-5 h-5 text-white" />
          <span className="font-bold text-sm sm:text-base tracking-wider">
            EMERGENCY KILL SWITCH ENGAGED — MOTOR TORQUE DISARMED (0 PWM)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => robotManager.resetEmergencyStop()}
              className="px-3 py-1 bg-white text-[#ff3b30] font-black text-xs rounded-[3px] hover:bg-gray-100 uppercase flex items-center gap-1.5 shadow"
            >
              <span>DISARM & RESET</span>
              <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-800 rounded text-[10px]">SPACE</kbd>
            </button>
          </div>
        </div>
      )}

      {/* Dual ESP32 OTA Remote Firmware Modal */}
      <OtaFirmwareModal
        isOpen={isOtaOpen}
        onClose={() => setIsOtaOpen(false)}
        connectionStatus={connectionStatus}
        otaStatus={otaStatus}
        dualEsp32={dualEsp32}
      />
    </div>
  );
}
