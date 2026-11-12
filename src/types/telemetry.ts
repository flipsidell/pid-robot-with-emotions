export interface ImuData {
  pitch: number;        // degrees (target 0 deg for upright pendulum)
  roll: number;         // degrees
  yaw: number;          // degrees
  accelX: number;       // g
  accelY: number;       // g
  accelZ: number;       // g
  gyroX: number;        // deg/s
  gyroY: number;        // deg/s (angular velocity for balance)
  gyroZ: number;        // deg/s
  temperature: number;  // Celsius (MPU6050 internal temp)
}

export interface MotorTelemetry {
  leftPwm: number;      // -255 to 255 (or -100 to 100%)
  rightPwm: number;
  leftRpm: number;      // wheel RPM
  rightRpm: number;
  encoderLeft: number;  // total tick count
  encoderRight: number;
  currentDrawA: number; // Amperes
  motorTempC: number;
}

export interface SystemMetrics {
  batteryVoltage: number; // Volts (e.g. 11.1V - 12.6V for 3S LiPo)
  batteryPercent: number; // 0 - 100%
  cpuLoad: number;        // 0 - 100%
  loopFrequencyHz: number;// e.g. 100Hz or 200Hz loop
  packetRateHz: number;   // packets received per second
  latencyMs: number;      // round-trip ping in ms
  rssi: number;           // signal dBm (e.g. -65)
  droppedPackets: number;
  totalPackets: number;
  uptimeSeconds: number;
  isFallen: boolean;      // pitch > fallThreshold (safety cutoff)
  isArmed: boolean;       // motors enabled
  emergencyStop: boolean; // hard kill switch triggered
}

export interface PidLoopConfig {
  kp: number;
  ki: number;
  kd: number;
}

export interface RobotConfig {
  balancePid: PidLoopConfig;
  velocityPid: PidLoopConfig;
  yawPid: PidLoopConfig;
  targetPitchOffset: number; // trim balance angle in degrees (-5.0 to +5.0)
  maxTiltAngle: number;      // safety cutoff angle (e.g. 35 deg)
  maxSpeedPercent: number;   // 20 - 100%
  deadbandPercent: number;   // 0 - 20%
  invertSteering: boolean;
  expoRate: number;          // joystick exponential response (0 - 1.0)
}

export type RobotEmotion = 
  | 'HAPPY' 
  | 'CURIOUS' 
  | 'SURPRISED'
  | 'WINK'
  | 'DIZZY' 
  | 'ALERT' 
  | 'ANGRY' 
  | 'SLEEP' 
  | 'CONFIDENT' 
  | 'SCANNING' 
  | 'HEART' 
  | 'BLINK'
  | 'CUSTOM';

export type DeviceViewMode = 'auto' | 'android' | 'laptop' | 'desktop';

export interface JoystickVector {
  x: number; // -1.0 to 1.0 (Steering / Yaw)
  y: number; // -1.0 to 1.0 (Throttle / Forward-Backward velocity setpoint)
  trimX: number;
  trimY: number;
}

export interface VoltageDividerConfig {
  r1Ohms: number;         // e.g. 100000 (100kΩ top resistor)
  r2Ohms: number;         // e.g. 10000 (10kΩ bottom resistor to GND)
  vRef: number;           // ESP32 ADC Reference Voltage (default 3.3V)
  calibMultiplier: number;// Calibration offset factor (e.g. 1.02)
  batteryType: '2S_LIPO' | '3S_LIPO' | '4S_LIPO' | 'CUSTOM';
  cellCount: number;      // 2, 3, 4
  capacityMah: number;    // e.g. 2200 mAh
}

export interface BatteryHistoryPoint {
  timeLabel: string;
  timestamp: number;
  voltage: number;
  currentA: number;
  percent: number;
  predictedVoltage?: number;
}

export interface DetailedBatteryMetrics {
  batteryVoltage: number;    // Pack voltage in Volts (e.g. 12.2V)
  rawAdcCount: number;       // Raw 12-bit ADC reading (0-4095)
  adcPinVoltage: number;     // Voltage directly at ESP32 GPIO pin (e.g. 1.11V)
  dividerRatio: number;      // (R1 + R2) / R2
  batteryPercent: number;    // Non-linear LiPo curve percentage (0-100%)
  cellVoltages: number[];    // Individual cell voltages [V1, V2, V3]
  remainingMah: number;      // Calculated remaining capacity in mAh
  estimatedRuntimeMin: number;// Estimated remaining runtime at current draw
  voltageHistory: number[];  // Rolling sparkline array
  historyPoints: BatteryHistoryPoint[]; // Detailed time-series array for Recharts
}

export type Esp32Target = 'flight' | 'display' | 'both';

export interface Esp32NodeInfo {
  id: 'esp32_flight' | 'esp32_display';
  name: string;
  role: string;
  status: 'online' | 'flashing' | 'rebooting' | 'offline';
  firmwareVersion: string;
  activePartition: 'ota_0' | 'ota_1';
  flashSizeMb: number;
  uptimeSeconds: number;
  cpuTempC: number;
}

export interface DualEsp32Status {
  flightNode: Esp32NodeInfo;
  displayNode: Esp32NodeInfo;
  interChipLink: 'esp_now_connected' | 'uart_connected' | 'syncing' | 'link_down';
  interChipRateHz: number;
}

export type SensorSmoothingMode = 'raw' | 'smooth_fast' | 'smooth_readable';

export interface OtaFirmwareStatus {
  state: 'idle' | 'preparing' | 'flashing' | 'verifying' | 'rebooting' | 'completed' | 'error';
  targetChip: Esp32Target;
  progressPercent: number;
  bytesTransferred: number;
  totalBytes: number;
  transferRateKbps: number;
  activePartition: 'ota_0' | 'ota_1';
  firmwareVersion: string;
  errorMessage?: string;
}

export interface TelemetryLogPoint {
  timestamp: number;
  pitch: number;
  roll: number;
  yaw: number;
  gyroY: number;
  motorL: number;
  motorR: number;
  batteryV: number;
  joyX: number;
  joyY: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'simulated';

