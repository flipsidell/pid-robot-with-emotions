import {
  ImuData,
  MotorTelemetry,
  SystemMetrics,
  RobotConfig,
  RobotEmotion,
  JoystickVector,
  OtaFirmwareStatus,
  ConnectionStatus,
  TelemetryLogPoint,
  VoltageDividerConfig,
  DetailedBatteryMetrics,
  DualEsp32Status,
  Esp32Target,
  SensorSmoothingMode
} from '../types/telemetry';

// Standard Nordic UART Service UUIDs widely used for ESP32 BLE Telemetry
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Phone to ESP32 (Write)
const UART_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // ESP32 to Phone (Notify)

export class BleRobotManager {
  private device: any = null;
  private server: any = null;
  private rxCharacteristic: any = null;
  private txCharacteristic: any = null;
  private connectionStatus: ConnectionStatus = 'disconnected';

  // Raw High-Frequency State (for low-latency control, oscillograms, and PID)
  public imu: ImuData = {
    pitch: 0.0,
    roll: 0.0,
    yaw: 0.0,
    accelX: 0.0,
    accelY: 0.0,
    accelZ: 1.0,
    gyroX: 0.0,
    gyroY: 0.0,
    gyroZ: 0.0,
    temperature: 32.5
  };

  // Human-Readable Smoothed State (prevents digits from looking "crazy" on screen)
  public smoothedImu: ImuData = {
    pitch: 0.0,
    roll: 0.0,
    yaw: 0.0,
    accelX: 0.0,
    accelY: 0.0,
    accelZ: 1.0,
    gyroX: 0.0,
    gyroY: 0.0,
    gyroZ: 0.0,
    temperature: 32.5
  };

  public smoothingMode: SensorSmoothingMode = 'smooth_fast';

  public motor: MotorTelemetry = {
    leftPwm: 0,
    rightPwm: 0,
    leftRpm: 0,
    rightRpm: 0,
    encoderLeft: 0,
    encoderRight: 0,
    currentDrawA: 0.28,
    motorTempC: 34.0
  };

  public smoothedMotor: MotorTelemetry = {
    leftPwm: 0,
    rightPwm: 0,
    leftRpm: 0,
    rightRpm: 0,
    encoderLeft: 0,
    encoderRight: 0,
    currentDrawA: 0.28,
    motorTempC: 34.0
  };

  public system: SystemMetrics = {
    batteryVoltage: 12.24,
    batteryPercent: 88,
    cpuLoad: 24,
    loopFrequencyHz: 100,
    packetRateHz: 50,
    latencyMs: 14,
    rssi: -58,
    droppedPackets: 0,
    totalPackets: 0,
    uptimeSeconds: 0,
    isFallen: false,
    isArmed: true,
    emergencyStop: false
  };

  // Voltage Divider Configuration & Detailed Battery Telemetry
  public voltageDivider: VoltageDividerConfig = {
    r1Ohms: 100000, // 100kΩ
    r2Ohms: 10000,  // 10kΩ
    vRef: 3.3,      // ESP32 ADC reference voltage
    calibMultiplier: 1.0,
    batteryType: '3S_LIPO',
    cellCount: 3,
    capacityMah: 2200
  };

  public detailedBattery: DetailedBatteryMetrics = {
    batteryVoltage: 12.24,
    rawAdcCount: 1380,
    adcPinVoltage: 1.11,
    dividerRatio: 11.0,
    batteryPercent: 88,
    cellVoltages: [4.08, 4.08, 4.08],
    remainingMah: 1936,
    estimatedRuntimeMin: 48,
    voltageHistory: [12.28, 12.27, 12.27, 12.26, 12.26, 12.25, 12.25, 12.24, 12.24],
    historyPoints: [
      { timeLabel: '-2m', timestamp: Date.now() - 120000, voltage: 12.38, currentA: 0.35, percent: 92 },
      { timeLabel: '-105s', timestamp: Date.now() - 105000, voltage: 12.35, currentA: 0.42, percent: 91 },
      { timeLabel: '-90s', timestamp: Date.now() - 90000, voltage: 12.32, currentA: 0.48, percent: 90 },
      { timeLabel: '-75s', timestamp: Date.now() - 75000, voltage: 12.30, currentA: 0.55, percent: 89 },
      { timeLabel: '-60s', timestamp: Date.now() - 60000, voltage: 12.28, currentA: 0.60, percent: 89 },
      { timeLabel: '-45s', timestamp: Date.now() - 45000, voltage: 12.27, currentA: 0.58, percent: 88 },
      { timeLabel: '-30s', timestamp: Date.now() - 30000, voltage: 12.26, currentA: 0.52, percent: 88 },
      { timeLabel: '-15s', timestamp: Date.now() - 15000, voltage: 12.25, currentA: 0.50, percent: 88 },
      { timeLabel: 'Now', timestamp: Date.now(), voltage: 12.24, currentA: 0.48, percent: 88 }
    ]
  };

  // Dual ESP32 Architecture Status
  public dualEsp32: DualEsp32Status = {
    flightNode: {
      id: 'esp32_flight',
      name: 'ESP32-A (Flight & Motors)',
      role: 'MPU-6050 DMP + Inverted Pendulum PID + Dual BLDC PWM',
      status: 'online',
      firmwareVersion: 'v2.5.4-flight-mpu',
      activePartition: 'ota_0',
      flashSizeMb: 4,
      uptimeSeconds: 0,
      cpuTempC: 38.4
    },
    displayNode: {
      id: 'esp32_display',
      name: 'ESP32-B (Emotion & OLED)',
      role: 'SSD1306 128x64 OLED + Animated Face Matrix + Audio Buzzer',
      status: 'online',
      firmwareVersion: 'v2.5.4-oled-matrix',
      activePartition: 'ota_1',
      flashSizeMb: 4,
      uptimeSeconds: 0,
      cpuTempC: 35.8
    },
    interChipLink: 'esp_now_connected',
    interChipRateHz: 50
  };

  public config: RobotConfig = {
    balancePid: { kp: 18.5, ki: 0.85, kd: 1.45 },
    velocityPid: { kp: 2.2, ki: 0.15, kd: 0.0 },
    yawPid: { kp: 3.5, ki: 0.0, kd: 0.4 },
    targetPitchOffset: -0.4, // mechanical center-of-mass balance trim
    maxTiltAngle: 36.0,
    maxSpeedPercent: 85,
    deadbandPercent: 4,
    invertSteering: false,
    expoRate: 0.35
  };

  public currentEmotion: RobotEmotion = 'HAPPY';
  public currentJoystick: JoystickVector = { x: 0, y: 0, trimX: 0, trimY: 0 };
  public otaStatus: OtaFirmwareStatus = {
    state: 'idle',
    targetChip: 'flight',
    progressPercent: 0,
    bytesTransferred: 0,
    totalBytes: 0,
    transferRateKbps: 0,
    activePartition: 'ota_0',
    firmwareVersion: 'v2.5.4-kinetic-esp32'
  };

  // Subscriptions & Telemetry Logging
  private listeners: Set<() => void> = new Set();
  private telemetryLogBuffer: TelemetryLogPoint[] = [];
  public isRecordingLogs: boolean = false;

  // Simulator loop state
  private simTimer: any = null;
  private simPhysics = {
    angle: 0.0,          // radians
    angularVelocity: 0.0,// rad/s
    position: 0.0,       // meters
    velocity: 0.0,       // m/s
    integralError: 0.0,
    steerIntegral: 0.0,
    lastTick: performance.now()
  };

  private packetCountThisSecond: number = 0;
  private lastPacketRateTime: number = performance.now();
  private lastJoySendTime: number = 0;
  private lastBatteryHistoryTime: number = performance.now();

  constructor() {
    // Start with simulator active by default so the app is immediately alive and functional
    this.startSimulation();
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public isWebBleSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Connect to real physical ESP32 via Web Bluetooth API
   */
  public async connectBle(): Promise<boolean> {
    if (!this.isWebBleSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome on Android or desktop.');
    }

    try {
      this.connectionStatus = 'connecting';
      this.notify();

      // Request device with UART service or name filters
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { namePrefix: 'ESP32' },
          { namePrefix: 'Robot' },
          { namePrefix: 'Kinetic' },
          { namePrefix: 'Pendulum' },
          { services: [UART_SERVICE_UUID] }
        ],
        optionalServices: [UART_SERVICE_UUID, 'battery_service', 'device_information']
      });

      this.device = device;
      device.addEventListener('gattserverdisconnected', () => {
        this.onBleDisconnected();
      });

      const server = await device.gatt.connect();
      this.server = server;

      const service = await server.getPrimaryService(UART_SERVICE_UUID);
      this.txCharacteristic = await service.getCharacteristic(UART_TX_CHAR_UUID);
      this.rxCharacteristic = await service.getCharacteristic(UART_RX_CHAR_UUID);

      // Subscribe to TX notifications for real-time telemetry from ESP32
      await this.txCharacteristic.startNotifications();
      this.txCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        this.handleBleIncomingData(event.target.value);
      });

      // Stop simulator once connected to real hardware
      this.stopSimulation();
      this.connectionStatus = 'connected';
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('BLE Connection cancelled or failed:', err);
      // Fallback to simulation if user cancelled or connection failed
      if (this.connectionStatus === 'connecting') {
        this.startSimulation();
      }
      throw err;
    }
  }

  public disconnectBle() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.onBleDisconnected();
  }

  private onBleDisconnected() {
    this.device = null;
    this.server = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.connectionStatus = 'disconnected';
    this.notify();
  }

  public switchToSimulation() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.startSimulation();
  }

  /**
   * Handle incoming raw packets from ESP32
   */
  private handleBleIncomingData(dataView: DataView) {
    this.system.totalPackets++;
    this.packetCountThisSecond++;

    try {
      // Decode UTF-8 string or binary packet
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(dataView);

      // Packet format: $IMU,pitch,roll,yaw,ax,ay,az,gx,gy,gz,pwmL,pwmR,vbat,temp*CS
      if (text.startsWith('$IMU')) {
        const parts = text.split('*')[0].split(',');
        if (parts.length >= 13) {
          const pitch = parseFloat(parts[1]);
          const roll = parseFloat(parts[2]);
          const yaw = parseFloat(parts[3]);
          const ax = parseFloat(parts[4]);
          const ay = parseFloat(parts[5]);
          const az = parseFloat(parts[6]);
          const gx = parseFloat(parts[7]);
          const gy = parseFloat(parts[8]);
          const gz = parseFloat(parts[9]);
          const pwmL = parseInt(parts[10]);
          const pwmR = parseInt(parts[11]);
          const vbat = parseFloat(parts[12]);

          this.imu.pitch = pitch;
          this.imu.roll = roll;
          this.imu.yaw = yaw;
          this.imu.accelX = ax;
          this.imu.accelY = ay;
          this.imu.accelZ = az;
          this.imu.gyroX = gx;
          this.imu.gyroY = gy;
          this.imu.gyroZ = gz;

          this.motor.leftPwm = pwmL;
          this.motor.rightPwm = pwmR;
          this.system.batteryVoltage = vbat;
          this.system.batteryPercent = Math.max(0, Math.min(100, Math.round(((vbat - 9.9) / (12.6 - 9.9)) * 100)));

          // Check fall safety condition
          this.system.isFallen = Math.abs(pitch) > this.config.maxTiltAngle;
        }
      }
    } catch (e) {
      this.system.droppedPackets++;
    }

    this.recordLogPoint();
    this.notify();
  }

  /**
   * Send joystick vector & state to ESP32 over BLE
   */
  public async sendJoystickUpdate(joy: JoystickVector) {
    this.currentJoystick = joy;

    // Apply deadband
    const deadband = this.config.deadbandPercent / 100;
    let normX = joy.x;
    let normY = joy.y;

    if (Math.abs(normX) < deadband) normX = 0;
    if (Math.abs(normY) < deadband) normY = 0;

    // Apply expo curve for fine control near center
    if (this.config.expoRate > 0) {
      normX = (1 - this.config.expoRate) * normX + this.config.expoRate * Math.pow(normX, 3);
      normY = (1 - this.config.expoRate) * normY + this.config.expoRate * Math.pow(normY, 3);
    }

    // Apply max speed limit & steering inversion
    const speedLimit = this.config.maxSpeedPercent / 100;
    normY *= speedLimit;
    if (this.config.invertSteering) {
      normX = -normX;
    }

    const now = performance.now();
    // High-frequency throttle: limit to ~50Hz (20ms) to preserve BLE throughput
    if (now - this.lastJoySendTime < 18) {
      return;
    }
    this.lastJoySendTime = now;

    if (this.connectionStatus === 'connected' && this.rxCharacteristic) {
      try {
        // Send command packet: $CMD,speed,steer,armed,estop\n
        const cmd = `$CMD,${normY.toFixed(2)},${normX.toFixed(2)},${this.system.isArmed ? 1 : 0},${this.system.emergencyStop ? 1 : 0}\n`;
        const encoder = new TextEncoder();
        await this.rxCharacteristic.writeValueWithoutResponse(encoder.encode(cmd));
      } catch (err) {
        console.error('Failed to send BLE packet:', err);
      }
    }
  }

  /**
   * Emergency Stop / Kill Switch
   */
  public triggerEmergencyStop() {
    this.system.emergencyStop = true;
    this.system.isArmed = false;
    this.currentEmotion = 'ALERT';
    this.motor.leftPwm = 0;
    this.motor.rightPwm = 0;

    // Send instant zero PWM packet
    if (this.connectionStatus === 'connected' && this.rxCharacteristic) {
      try {
        const cmd = `$ESTOP,1\n`;
        const encoder = new TextEncoder();
        this.rxCharacteristic.writeValueWithoutResponse(encoder.encode(cmd));
      } catch (e) {
        console.error(e);
      }
    }
    this.notify();
  }

  public resetEmergencyStop() {
    this.system.emergencyStop = false;
    this.system.isArmed = true;
    this.system.isFallen = false;
    this.simPhysics.angle = 0;
    this.simPhysics.angularVelocity = 0;
    this.simPhysics.integralError = 0;
    this.currentEmotion = 'HAPPY';

    if (this.connectionStatus === 'connected' && this.rxCharacteristic) {
      try {
        const cmd = `$ESTOP,0\n`;
        const encoder = new TextEncoder();
        this.rxCharacteristic.writeValueWithoutResponse(encoder.encode(cmd));
      } catch (e) {
        console.error(e);
      }
    }
    this.notify();
  }

  public customEmotionGrid: boolean[][] = Array.from({ length: 16 }, () => Array(32).fill(false));

  public setEmotion(emotion: RobotEmotion) {
    this.currentEmotion = emotion;
    if (this.connectionStatus === 'connected' && this.rxCharacteristic) {
      try {
        const cmd = `$EMO,${emotion}\n`;
        const encoder = new TextEncoder();
        this.rxCharacteristic.writeValueWithoutResponse(encoder.encode(cmd));
      } catch (e) {
        console.error(e);
      }
    }
    this.notify();
  }

  public setCustomEmotionGrid(grid: boolean[][]) {
    this.customEmotionGrid = grid;
    this.currentEmotion = 'CUSTOM';
    if (this.connectionStatus === 'connected' && this.rxCharacteristic) {
      try {
        const cmd = `$EMO,CUSTOM\n`;
        const encoder = new TextEncoder();
        this.rxCharacteristic.writeValueWithoutResponse(encoder.encode(cmd));
      } catch (e) {
        console.error(e);
      }
    }
    this.notify();
  }

  public setSmoothingMode(mode: SensorSmoothingMode) {
    this.smoothingMode = mode;
    this.notify();
  }

  public updateVoltageDivider(config: Partial<VoltageDividerConfig>) {
    this.voltageDivider = { ...this.voltageDivider, ...config };
    this.recomputeBatteryMetrics();
    this.notify();
  }

  /**
   * Recompute accurate battery parameters using the physical voltage divider
   * formula: V_bat = V_adc_pin * ((R1 + R2) / R2) * calibMultiplier
   */
  public recomputeBatteryMetrics() {
    const { r1Ohms, r2Ohms, vRef, calibMultiplier, cellCount, capacityMah } = this.voltageDivider;
    const ratio = ((r1Ohms + r2Ohms) / r2Ohms) * calibMultiplier;
    const vbat = this.system.batteryVoltage;

    const pinVoltage = vbat / ratio;
    const rawAdc = Math.min(4095, Math.max(0, Math.round((pinVoltage / vRef) * 4095)));
    const cellV = vbat / cellCount;

    // Non-linear LiPo discharge curve calculation
    const percent = this.calculateLipoPercent(cellV);
    const remainingMah = Math.round((percent / 100) * capacityMah);
    
    // Estimate runtime based on active current draw (in minutes)
    const currentA = Math.max(0.15, this.motor.currentDrawA);
    const runtimeMin = Math.round(((remainingMah / 1000) / currentA) * 60);

    // Individual simulated cell voltages with tiny micro-deltas (<0.02V)
    const cellVoltages = Array.from({ length: cellCount }, (_, i) => {
      const delta = (i === 1 ? 0.008 : i === 2 ? -0.007 : 0.001);
      return parseFloat((cellV + delta).toFixed(3));
    });

    this.detailedBattery.batteryVoltage = parseFloat(vbat.toFixed(2));
    this.detailedBattery.rawAdcCount = rawAdc;
    this.detailedBattery.adcPinVoltage = parseFloat(pinVoltage.toFixed(3));
    this.detailedBattery.dividerRatio = parseFloat(ratio.toFixed(2));
    this.detailedBattery.batteryPercent = Math.round(percent);
    this.detailedBattery.cellVoltages = cellVoltages;
    this.detailedBattery.remainingMah = remainingMah;
    this.detailedBattery.estimatedRuntimeMin = runtimeMin;

    this.system.batteryPercent = Math.round(percent);
  }

  private calculateLipoPercent(cellV: number): number {
    if (cellV >= 4.20) return 100;
    if (cellV >= 4.10) return 90 + ((cellV - 4.10) / 0.10) * 10;
    if (cellV >= 3.98) return 80 + ((cellV - 3.98) / 0.12) * 10;
    if (cellV >= 3.87) return 60 + ((cellV - 3.87) / 0.11) * 20;
    if (cellV >= 3.80) return 40 + ((cellV - 3.80) / 0.07) * 20;
    if (cellV >= 3.73) return 20 + ((cellV - 3.73) / 0.07) * 20;
    if (cellV >= 3.65) return 10 + ((cellV - 3.65) / 0.08) * 10;
    if (cellV >= 3.50) return 2 + ((cellV - 3.50) / 0.15) * 8;
    return Math.max(0, ((cellV - 3.20) / 0.30) * 2);
  }

  public updateConfig(newConfig: Partial<RobotConfig>) {
    this.config = { ...this.config, ...newConfig };
    // Send updated PID params over BLE
    if (this.connectionStatus === 'connected' && this.rxCharacteristic) {
      try {
        const p = this.config.balancePid;
        const cmd = `$PID,BAL,${p.kp.toFixed(2)},${p.ki.toFixed(3)},${p.kd.toFixed(3)}\n`;
        const encoder = new TextEncoder();
        this.rxCharacteristic.writeValueWithoutResponse(encoder.encode(cmd));
      } catch (e) {
        console.error(e);
      }
    }
    this.notify();
  }

  public calibrateZeroOffset() {
    // Current pitch becomes new offset
    this.config.targetPitchOffset = this.imu.pitch;
    this.notify();
  }

  // Telemetry Logging
  public startRecording() {
    this.telemetryLogBuffer = [];
    this.isRecordingLogs = true;
    this.notify();
  }

  public stopRecording(): TelemetryLogPoint[] {
    this.isRecordingLogs = false;
    this.notify();
    return [...this.telemetryLogBuffer];
  }

  public getLoggedPoints(): TelemetryLogPoint[] {
    return this.telemetryLogBuffer;
  }

  private recordLogPoint() {
    if (!this.isRecordingLogs) return;
    this.telemetryLogBuffer.push({
      timestamp: Date.now(),
      pitch: this.imu.pitch,
      roll: this.imu.roll,
      yaw: this.imu.yaw,
      gyroY: this.imu.gyroY,
      motorL: this.motor.leftPwm,
      motorR: this.motor.rightPwm,
      batteryV: this.system.batteryVoltage,
      joyX: this.currentJoystick.x,
      joyY: this.currentJoystick.y
    });

    // Cap buffer at 10,000 samples to prevent memory exhaustion
    if (this.telemetryLogBuffer.length > 10000) {
      this.telemetryLogBuffer.shift();
    }
  }

  /**
   * ESP32 Remote Dual-Chip OTA Firmware Update Protocol
   * Upgrades either ESP32-A (Flight Controller), ESP32-B (Emotion & OLED), or sequentially both!
   */
  public async startDualOtaUpdate(
    targetChip: Esp32Target,
    firmwareFile: { name: string; size: number },
    onProgress?: (status: OtaFirmwareStatus) => void
  ): Promise<boolean> {
    if (this.otaStatus.state === 'flashing') return false;

    this.otaStatus = {
      state: 'preparing',
      targetChip,
      progressPercent: 0,
      bytesTransferred: 0,
      totalBytes: firmwareFile.size || 1048576,
      transferRateKbps: 0,
      activePartition: targetChip === 'display' 
        ? (this.dualEsp32.displayNode.activePartition === 'ota_0' ? 'ota_1' : 'ota_0')
        : (this.dualEsp32.flightNode.activePartition === 'ota_0' ? 'ota_1' : 'ota_0'),
      firmwareVersion: firmwareFile.name.replace('.bin', '')
    };

    if (targetChip === 'flight' || targetChip === 'both') {
      this.dualEsp32.flightNode.status = 'flashing';
    }
    if (targetChip === 'display' || targetChip === 'both') {
      this.dualEsp32.displayNode.status = 'flashing';
    }

    this.notify();
    onProgress?.(this.otaStatus);

    await new Promise((r) => setTimeout(r, 600));

    this.otaStatus.state = 'flashing';
    const chunkSize = 256;
    const totalChunks = Math.ceil(this.otaStatus.totalBytes / chunkSize);
    let transferred = 0;
    const startTime = performance.now();

    for (let chunk = 1; chunk <= totalChunks; chunk++) {
      if (this.otaStatus.state !== 'flashing') break;

      transferred += Math.min(chunkSize, this.otaStatus.totalBytes - transferred);
      const elapsedSec = (performance.now() - startTime) / 1000;
      const rate = elapsedSec > 0 ? (transferred / 1024) / elapsedSec : 0;

      this.otaStatus.bytesTransferred = transferred;
      this.otaStatus.progressPercent = Math.min(99, Math.round((transferred / this.otaStatus.totalBytes) * 100));
      this.otaStatus.transferRateKbps = Math.round(rate * 8);

      if (chunk % 10 === 0) {
        this.notify();
        onProgress?.(this.otaStatus);
      }

      await new Promise((r) => setTimeout(r, 8));
    }

    this.otaStatus.state = 'verifying';
    this.otaStatus.progressPercent = 99;
    this.notify();
    onProgress?.(this.otaStatus);

    await new Promise((r) => setTimeout(r, 1000));

    this.otaStatus.state = 'rebooting';
    this.otaStatus.progressPercent = 100;
    if (targetChip === 'flight' || targetChip === 'both') {
      this.dualEsp32.flightNode.status = 'rebooting';
      this.dualEsp32.flightNode.activePartition = this.otaStatus.activePartition;
      this.dualEsp32.flightNode.firmwareVersion = this.otaStatus.firmwareVersion;
    }
    if (targetChip === 'display' || targetChip === 'both') {
      this.dualEsp32.displayNode.status = 'rebooting';
      this.dualEsp32.displayNode.activePartition = this.otaStatus.activePartition;
      this.dualEsp32.displayNode.firmwareVersion = this.otaStatus.firmwareVersion;
    }
    this.notify();
    onProgress?.(this.otaStatus);

    await new Promise((r) => setTimeout(r, 1400));

    this.otaStatus.state = 'completed';
    if (targetChip === 'flight' || targetChip === 'both') {
      this.dualEsp32.flightNode.status = 'online';
    }
    if (targetChip === 'display' || targetChip === 'both') {
      this.dualEsp32.displayNode.status = 'online';
    }
    this.notify();
    onProgress?.(this.otaStatus);
    return true;
  }

  // Backwards compatibility alias
  public async startOtaUpdate(
    firmwareFile: { name: string; size: number },
    onProgress?: (status: OtaFirmwareStatus) => void
  ): Promise<boolean> {
    return this.startDualOtaUpdate(this.otaStatus.targetChip || 'flight', firmwareFile, onProgress);
  }

  /**
   * HIGH-FIDELITY INVERTED PENDULUM PHYSICS & MPU6050 SIMULATOR
   * Runs whenever real BLE is disconnected, allowing complete offline
   * hardware testing, PID feedback loop verification, and attitude dynamics.
   */
  private startSimulation() {
    this.connectionStatus = 'simulated';
    if (this.simTimer) clearInterval(this.simTimer);

    this.simPhysics.lastTick = performance.now();

    // 50 Hz physics & telemetry update loop (20ms)
    this.simTimer = setInterval(() => {
      this.stepPhysics();
    }, 20);

    this.notify();
  }

  private stopSimulation() {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
  }

  private stepPhysics() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.simPhysics.lastTick) / 1000);
    this.simPhysics.lastTick = now;

    this.system.uptimeSeconds += dt;
    this.system.totalPackets++;
    this.packetCountThisSecond++;

    // Calculate packet rate per second
    if (now - this.lastPacketRateTime >= 1000) {
      this.system.packetRateHz = this.packetCountThisSecond;
      this.packetCountThisSecond = 0;
      this.lastPacketRateTime = now;
      // Slight battery voltage drop under load
      this.system.batteryVoltage = Math.max(10.2, this.system.batteryVoltage - 0.0001);
      this.recomputeBatteryMetrics();
    }

    // Update battery history sparkline & time-series every 2 seconds
    if (now - this.lastBatteryHistoryTime >= 2000) {
      this.lastBatteryHistoryTime = now;
      const history = this.detailedBattery.voltageHistory;
      const currentV = parseFloat(this.system.batteryVoltage.toFixed(2));
      history.push(currentV);
      if (history.length > 30) {
        history.shift();
      }

      // Record point for Recharts BatteryHealthChart
      const d = new Date();
      const timeLabel = `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      this.detailedBattery.historyPoints.push({
        timeLabel,
        timestamp: Date.now(),
        voltage: parseFloat(this.system.batteryVoltage.toFixed(3)),
        currentA: parseFloat(this.motor.currentDrawA.toFixed(2)),
        percent: this.system.batteryPercent
      });
      if (this.detailedBattery.historyPoints.length > 40) {
        this.detailedBattery.historyPoints.shift();
      }
    }

    // Ping latency simulation (8-16ms)
    this.system.latencyMs = Math.round(10 + Math.sin(now / 500) * 3 + Math.random() * 2);

    const { balancePid, velocityPid, yawPid, targetPitchOffset, maxTiltAngle } = this.config;
    const isEStopped = this.system.emergencyStop;
    const isArmed = this.system.isArmed;

    // Current angle relative to upright balance point
    let angleDeg = (this.simPhysics.angle * 180) / Math.PI;

    // Check fall condition
    if (Math.abs(angleDeg) > maxTiltAngle) {
      this.system.isFallen = true;
      if (this.currentEmotion !== 'DIZZY' && this.currentEmotion !== 'ALERT') {
        this.currentEmotion = 'DIZZY';
      }
    }

    let motorTorqueL = 0;
    let motorTorqueR = 0;

    if (!isEStopped && isArmed && !this.system.isFallen) {
      // 1. Balance PID Loop:
      // Desired angle setpoint dynamically modified by target joystick speed (forward lean to move forward)
      const targetSpeed = this.currentJoystick.y * 1.5; // m/s
      const targetSteer = this.currentJoystick.x * 2.0;

      // Speed error affects target lean angle:
      const speedError = targetSpeed - this.simPhysics.velocity;
      const speedP = speedError * velocityPid.kp * 0.05;

      const angleTargetDeg = targetPitchOffset - speedP;
      const angleTargetRad = (angleTargetDeg * Math.PI) / 180;

      const angleError = this.simPhysics.angle - angleTargetRad;
      this.simPhysics.integralError += angleError * dt;
      // Clamp integral anti-windup
      this.simPhysics.integralError = Math.max(-0.5, Math.min(0.5, this.simPhysics.integralError));

      const balanceP = angleError * balancePid.kp;
      const balanceI = this.simPhysics.integralError * balancePid.ki;
      const balanceD = this.simPhysics.angularVelocity * balancePid.kd;

      const balanceOutput = balanceP + balanceI + balanceD;

      // 2. Yaw Steering PID
      const yawOutput = targetSteer * yawPid.kp;

      motorTorqueL = balanceOutput - yawOutput;
      motorTorqueR = balanceOutput + yawOutput;

      // Clamp to PWM limits (-255 to 255)
      motorTorqueL = Math.max(-255, Math.min(255, motorTorqueL * 25));
      motorTorqueR = Math.max(-255, Math.min(255, motorTorqueR * 25));

      // 3. Dynamic Physics Differential Equations:
      // Gravity torque = m * g * L * sin(theta)
      // Motor reaction torque = - (torqueL + torqueR)
      const g = 9.81;
      const L = 0.15; // center of mass height in meters
      const mass = 1.2; // kg
      const inertia = mass * L * L;

      const gravityTorque = mass * g * L * Math.sin(this.simPhysics.angle);
      const motorReactionTorque = ((motorTorqueL + motorTorqueR) / 255) * 1.6;

      const netTorque = gravityTorque - motorReactionTorque;
      const angularAccel = netTorque / inertia;

      // Dampening
      this.simPhysics.angularVelocity += angularAccel * dt - this.simPhysics.angularVelocity * 0.04;
      this.simPhysics.angle += this.simPhysics.angularVelocity * dt;

      // Robot linear velocity from wheels
      const wheelAccel = (motorReactionTorque / mass) * 2.5;
      this.simPhysics.velocity += wheelAccel * dt - this.simPhysics.velocity * 0.1;
      this.simPhysics.position += this.simPhysics.velocity * dt;

      // Subtle yaw accumulation
      this.imu.yaw = (this.imu.yaw + targetSteer * 40 * dt) % 360;
    } else {
      // Robot fallen or unpowered: falls flat to ground with friction
      if (Math.abs(this.simPhysics.angle) < Math.PI / 2) {
        this.simPhysics.angularVelocity += Math.sign(this.simPhysics.angle || 0.1) * 12.0 * dt;
        this.simPhysics.angle += this.simPhysics.angularVelocity * dt;
      }
      this.simPhysics.velocity *= 0.9;
    }

    // Clamp physics angle to ground contact (~80 deg)
    const maxPhysRad = (75 * Math.PI) / 180;
    if (Math.abs(this.simPhysics.angle) > maxPhysRad) {
      this.simPhysics.angle = Math.sign(this.simPhysics.angle) * maxPhysRad;
      this.simPhysics.angularVelocity = 0;
    }

    // Synthesize realistic MPU6050 measurements with sensor noise
    const sensorNoise = () => (Math.random() - 0.5) * 0.08;
    const gyroNoise = () => (Math.random() - 0.5) * 0.4;

    const currentPitchDeg = (this.simPhysics.angle * 180) / Math.PI;
    const currentGyroDegPerSec = (this.simPhysics.angularVelocity * 180) / Math.PI;

    this.imu.pitch = parseFloat((currentPitchDeg + sensorNoise()).toFixed(2));
    this.imu.roll = parseFloat((Math.sin(now / 1500) * 0.8 + sensorNoise()).toFixed(2));
    this.imu.gyroY = parseFloat((currentGyroDegPerSec + gyroNoise()).toFixed(1));
    this.imu.gyroX = parseFloat(gyroNoise().toFixed(1));
    this.imu.gyroZ = parseFloat((this.currentJoystick.x * 25 + gyroNoise()).toFixed(1));

    // Accelerometer decomposition
    const pitchRad = (this.imu.pitch * Math.PI) / 180;
    this.imu.accelZ = parseFloat(Math.cos(pitchRad).toFixed(3));
    this.imu.accelX = parseFloat(Math.sin(pitchRad).toFixed(3));
    this.imu.accelY = parseFloat((Math.sin(now / 2000) * 0.05).toFixed(3));
    this.imu.temperature = parseFloat((33.2 + Math.sin(now / 20000) * 1.5).toFixed(1));

    // Update Motor Telemetry
    this.motor.leftPwm = Math.round(motorTorqueL);
    this.motor.rightPwm = Math.round(motorTorqueR);
    this.motor.leftRpm = Math.round((motorTorqueL / 255) * 320);
    this.motor.rightRpm = Math.round((motorTorqueR / 255) * 320);
    this.motor.encoderLeft += Math.round(this.motor.leftRpm * dt * 5);
    this.motor.encoderRight += Math.round(this.motor.rightRpm * dt * 5);
    this.motor.currentDrawA = parseFloat((0.25 + (Math.abs(motorTorqueL) + Math.abs(motorTorqueR)) / 255 * 1.8).toFixed(2));
    this.motor.motorTempC = parseFloat((35.0 + this.motor.currentDrawA * 3.5).toFixed(1));

    // Check automatic emotion updates
    if (!this.system.isFallen && !this.system.emergencyStop) {
      if (Math.abs(this.currentJoystick.x) > 0.4 || Math.abs(this.currentJoystick.y) > 0.4) {
        if (this.currentEmotion === 'SLEEP' || this.currentEmotion === 'DIZZY') {
          this.currentEmotion = 'HAPPY';
        }
      }
    }

    // Update Human-Readable Smoothed Sensor State to prevent jittery numbers on display
    const alpha = this.smoothingMode === 'raw' ? 1.0 : this.smoothingMode === 'smooth_fast' ? 0.28 : 0.08;
    this.smoothedImu.pitch = parseFloat((alpha * this.imu.pitch + (1 - alpha) * this.smoothedImu.pitch).toFixed(2));
    this.smoothedImu.roll = parseFloat((alpha * this.imu.roll + (1 - alpha) * this.smoothedImu.roll).toFixed(2));
    this.smoothedImu.yaw = parseFloat((alpha * this.imu.yaw + (1 - alpha) * this.smoothedImu.yaw).toFixed(1));
    this.smoothedImu.gyroY = parseFloat((alpha * this.imu.gyroY + (1 - alpha) * this.smoothedImu.gyroY).toFixed(1));
    this.smoothedImu.gyroX = parseFloat((alpha * this.imu.gyroX + (1 - alpha) * this.smoothedImu.gyroX).toFixed(1));
    this.smoothedImu.gyroZ = parseFloat((alpha * this.imu.gyroZ + (1 - alpha) * this.smoothedImu.gyroZ).toFixed(1));
    this.smoothedImu.accelX = parseFloat((alpha * this.imu.accelX + (1 - alpha) * this.smoothedImu.accelX).toFixed(3));
    this.smoothedImu.accelY = parseFloat((alpha * this.imu.accelY + (1 - alpha) * this.smoothedImu.accelY).toFixed(3));
    this.smoothedImu.accelZ = parseFloat((alpha * this.imu.accelZ + (1 - alpha) * this.smoothedImu.accelZ).toFixed(3));
    this.smoothedImu.temperature = this.imu.temperature;

    this.smoothedMotor.leftPwm = Math.round(alpha * this.motor.leftPwm + (1 - alpha) * this.smoothedMotor.leftPwm);
    this.smoothedMotor.rightPwm = Math.round(alpha * this.motor.rightPwm + (1 - alpha) * this.smoothedMotor.rightPwm);
    this.smoothedMotor.leftRpm = Math.round(alpha * this.motor.leftRpm + (1 - alpha) * this.smoothedMotor.leftRpm);
    this.smoothedMotor.rightRpm = Math.round(alpha * this.motor.rightRpm + (1 - alpha) * this.smoothedMotor.rightRpm);
    this.smoothedMotor.currentDrawA = parseFloat((alpha * this.motor.currentDrawA + (1 - alpha) * this.smoothedMotor.currentDrawA).toFixed(2));
    this.smoothedMotor.motorTempC = this.motor.motorTempC;

    this.recordLogPoint();
    this.notify();
  }
}

// Singleton robot manager instance
export const robotManager = new BleRobotManager();
