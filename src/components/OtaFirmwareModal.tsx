import React, { useState } from 'react';
import { OtaFirmwareStatus, ConnectionStatus, DualEsp32Status, Esp32Target } from '../types/telemetry';
import { robotManager } from '../services/bleService';
import { 
  X, 
  Upload, 
  Download, 
  CheckCircle, 
  RefreshCw, 
  Cpu, 
  HardDrive, 
  Shield, 
  Layers, 
  Radio, 
  Tv, 
  Sliders, 
  ArrowRight
} from 'lucide-react';

interface OtaFirmwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionStatus: ConnectionStatus;
  otaStatus: OtaFirmwareStatus;
  dualEsp32: DualEsp32Status;
}

export const OtaFirmwareModal: React.FC<OtaFirmwareModalProps> = ({
  isOpen,
  onClose,
  connectionStatus,
  otaStatus,
  dualEsp32
}) => {
  const [targetChip, setTargetChip] = useState<Esp32Target>('flight');
  const [selectedPreset, setSelectedPreset] = useState<string>('esp32_flight_v2.5.4_mpu6050_motors.bin');
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<string[]>([
    'DUAL ESP32 ARCHITECTURE INITIALIZED',
    'NODE A [0x24:6F:28]: ESP32-WROOM-32D (Flight Control & MPU6050)',
    'NODE B [0x24:6F:39]: ESP32-S3 (SSD1306 OLED Display & Emotion Engine)',
    'INTER-CHIP LINK: ESP-NOW 2.4GHz duplex at 50 Hz OK',
    'DUAL OTA: Both nodes configured with A/B dual partitions (ota_0 / ota_1).'
  ]);

  if (!isOpen) return null;

  // Firmware presets for ESP32-A (Flight controller)
  const flightPresets = [
    {
      name: 'esp32_flight_v2.5.4_mpu6050_motors.bin',
      version: 'v2.5.4 (Flight Master - Stable)',
      size: '1,048,576 bytes (1.0 MB)',
      desc: 'Control de MPU6050 DMP a 100Hz, lazos PID de péndulo invertido y PWM para motores duales.'
    },
    {
      name: 'esp32_flight_v2.5.0_high_torque_bldc.bin',
      version: 'v2.5.0 (High Torque Drive)',
      size: '984,210 bytes (0.94 MB)',
      desc: 'Frecuencia PWM a 20kHz silenciosa optimizada para motores brushless de alto par.'
    },
    {
      name: 'esp32_flight_v2.4.2_lqr_balance.bin',
      version: 'v2.4.2 (LQR State-Space Experimental)',
      size: '892,140 bytes (0.85 MB)',
      desc: 'Regulador lineal cuadrático con filtrado adaptativo de aceleración y compensación de inclinación.'
    }
  ];

  // Firmware presets for ESP32-B (Display & Emotion Coprocessor)
  const displayPresets = [
    {
      name: 'esp32_display_v2.5.4_oled_emotion_matrix.bin',
      version: 'v2.5.4 (Emotion Matrix & OLED - Stable)',
      size: '840,120 bytes (0.80 MB)',
      desc: 'Controlador de pantalla OLED 128x64 SSD1306 con expresiones faciales animadas y seguimiento ocular.'
    },
    {
      name: 'esp32_display_v2.5.1_cyberpunk_face_pack.bin',
      version: 'v2.5.1 (Cyberpunk Pack & Sound FX)',
      size: '920,400 bytes (0.88 MB)',
      desc: 'Expresiones visor cyberpunk, barridos de radar y tonos por buzzer zumbador.'
    },
    {
      name: 'esp32_display_v2.4.0_compact_hud.bin',
      version: 'v2.4.0 (Compact Telemetry HUD Mirror)',
      size: '760,110 bytes (0.72 MB)',
      desc: 'Modo HUD de telemetría compacta en tiempo real con bajo consumo de memoria.'
    }
  ];

  const currentPresets = targetChip === 'flight' ? flightPresets : displayPresets;

  const handleChipSelect = (chip: Esp32Target) => {
    setTargetChip(chip);
    setCustomFile(null);
    if (chip === 'flight') {
      setSelectedPreset(flightPresets[0].name);
      addLog('Objetivo cambiado a: ESP32-A (Flight Controller MPU6050 & Motores)');
    } else if (chip === 'display') {
      setSelectedPreset(displayPresets[0].name);
      addLog('Objetivo cambiado a: ESP32-B (Display OLED SSD1306 & Emociones)');
    } else {
      setSelectedPreset(flightPresets[0].name);
      addLog('Objetivo cambiado a: BATCH SECUENCIAL (Actualizar ambos ESP32)');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCustomFile(file);
      setSelectedPreset('');
      addLog(`CARGADO FIRMWARE PERSONALIZADO: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    }
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const startFlash = async () => {
    const filename = customFile ? customFile.name : selectedPreset;
    const filesize = customFile ? customFile.size : 1048576;

    addLog(`INICIANDO ACTUALIZACIÓN REMOTA OTA`);
    addLog(`Chip Destino: ${targetChip.toUpperCase()} · Archivo: ${filename}`);

    try {
      await robotManager.startDualOtaUpdate(
        targetChip,
        { name: filename, size: filesize },
        (status) => {
          if (status.state === 'flashing' && status.progressPercent % 20 === 0) {
            addLog(`Progreso de flasheo: ${status.progressPercent}% a ${status.transferRateKbps} kbps...`);
          } else if (status.state === 'verifying') {
            addLog(`Verificando integridad MD5 en ${targetChip.toUpperCase()}...`);
          } else if (status.state === 'rebooting') {
            addLog(`¡Flasheo exitoso! Conmutando partición a ${status.activePartition} y reiniciando nodo...`);
          } else if (status.state === 'completed') {
            addLog(`Actualización OTA de ${targetChip.toUpperCase()} completada. Sistema en línea.`);
          }
        }
      );
    } catch (err: any) {
      addLog(`ERROR OTA: ${err.message || 'Fallo durante la transferencia'}`);
    }
  };

  const isFlashing = ['preparing', 'flashing', 'verifying', 'rebooting'].includes(otaStatus.state);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] w-full max-w-3xl max-h-[92vh] flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0b0f17] border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#00f0ff]" />
            <span className="font-space font-bold text-white tracking-wide text-sm sm:text-base">
              DUAL ESP32 OVER-THE-AIR (OTA) // ACTUALIZACIÓN REMOTA
            </span>
          </div>
          {!isFlashing && (
            <button
              onClick={onClose}
              className="p-1 text-[#94a3b8] hover:text-white rounded-[2px] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs font-mono">
          {/* Dual ESP32 Microcontrollers Topology Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* ESP32-A: Flight & Motor Controller */}
            <div className={`p-3 rounded-[3px] border transition-all ${
              targetChip === 'flight' || targetChip === 'both'
                ? 'bg-[#0b0f17] border-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                : 'bg-[#0b0f17]/70 border-[#1e293b]'
            }`}>
              <div className="flex items-center justify-between pb-1.5 border-b border-[#1e293b]/60">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#00f0ff]" />
                  <span className="font-bold text-white">ESP32-A (FLIGHT MASTER)</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold ${
                  dualEsp32.flightNode.status === 'online'
                    ? 'bg-[#00e676]/20 text-[#00e676]'
                    : 'bg-[#ff9f0a]/20 text-[#ff9f0a] animate-pulse'
                }`}>
                  {dualEsp32.flightNode.status.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-1.5">{dualEsp32.flightNode.role}</p>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-[#64748b]">
                <span>PARTICIÓN: <strong className="text-white">{dualEsp32.flightNode.activePartition}</strong></span>
                <span>VERSIÓN: <strong className="text-[#00f0ff]">{dualEsp32.flightNode.firmwareVersion}</strong></span>
                <span>FLASH: 4MB SPI</span>
                <span>TEMP: {dualEsp32.flightNode.cpuTempC}°C</span>
              </div>
            </div>

            {/* ESP32-B: Emotion & Display Controller */}
            <div className={`p-3 rounded-[3px] border transition-all ${
              targetChip === 'display' || targetChip === 'both'
                ? 'bg-[#0b0f17] border-[#ff9f0a] shadow-[0_0_12px_rgba(255,159,10,0.2)]'
                : 'bg-[#0b0f17]/70 border-[#1e293b]'
            }`}>
              <div className="flex items-center justify-between pb-1.5 border-b border-[#1e293b]/60">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-[#ff9f0a]" />
                  <span className="font-bold text-white">ESP32-B (EMOTION SLAVE)</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold ${
                  dualEsp32.displayNode.status === 'online'
                    ? 'bg-[#00e676]/20 text-[#00e676]'
                    : 'bg-[#ff9f0a]/20 text-[#ff9f0a] animate-pulse'
                }`}>
                  {dualEsp32.displayNode.status.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-1.5">{dualEsp32.displayNode.role}</p>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-[#64748b]">
                <span>PARTICIÓN: <strong className="text-white">{dualEsp32.displayNode.activePartition}</strong></span>
                <span>VERSIÓN: <strong className="text-[#ff9f0a]">{dualEsp32.displayNode.firmwareVersion}</strong></span>
                <span>FLASH: 4MB SPI</span>
                <span>ENLACE: ESP-NOW 50Hz</span>
              </div>
            </div>
          </div>

          {/* Target Chip Selector Tabs */}
          <div className="space-y-1.5">
            <div className="text-[#94a3b8] text-[10px] uppercase tracking-wider font-bold">
              SELECCIONA EL MICROCONTROLADOR A ACTUALIZAR:
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isFlashing}
                onClick={() => handleChipSelect('flight')}
                className={`p-2.5 rounded-[3px] border font-mono text-center transition-all ${
                  targetChip === 'flight'
                    ? 'bg-[#0077ff] text-white border-[#00f0ff] font-bold shadow-[0_0_10px_#0077ff]'
                    : 'bg-[#0b0f17] text-[#94a3b8] border-[#1e293b] hover:text-white'
                }`}
              >
                <div className="text-xs">ESP32-A: FLIGHT</div>
                <div className="text-[10px] opacity-80">MPU6050 & Motores</div>
              </button>
              <button
                type="button"
                disabled={isFlashing}
                onClick={() => handleChipSelect('display')}
                className={`p-2.5 rounded-[3px] border font-mono text-center transition-all ${
                  targetChip === 'display'
                    ? 'bg-[#ff9f0a] text-black border-white font-bold shadow-[0_0_10px_#ff9f0a]'
                    : 'bg-[#0b0f17] text-[#94a3b8] border-[#1e293b] hover:text-white'
                }`}
              >
                <div className="text-xs">ESP32-B: DISPLAY</div>
                <div className="text-[10px] opacity-80">OLED & Emociones</div>
              </button>
              <button
                type="button"
                disabled={isFlashing}
                onClick={() => handleChipSelect('both')}
                className={`p-2.5 rounded-[3px] border font-mono text-center transition-all ${
                  targetChip === 'both'
                    ? 'bg-[#00e676] text-black border-white font-bold shadow-[0_0_10px_#00e676]'
                    : 'bg-[#0b0f17] text-[#94a3b8] border-[#1e293b] hover:text-white'
                }`}
              >
                <div className="text-xs">AMBOS (BATCH)</div>
                <div className="text-[10px] opacity-80">Secuencial A + B</div>
              </button>
            </div>
          </div>

          {/* Preset Firmware Select */}
          <div className="space-y-2">
            <div className="text-[#94a3b8] uppercase tracking-[0.05em] flex justify-between">
              <span>FIRMWARES OFICIALES DISPONIBLES</span>
              <span className="text-[#00f0ff]">
                {targetChip === 'flight' ? 'BUILD ESP32-A (MOTORES)' : 'BUILD ESP32-B (OLED)'}
              </span>
            </div>

            <div className="space-y-2">
              {currentPresets.map((preset) => {
                const isSelected = selectedPreset === preset.name && !customFile;
                return (
                  <div
                    key={preset.name}
                    onClick={() => {
                      if (!isFlashing) {
                        setSelectedPreset(preset.name);
                        setCustomFile(null);
                        addLog(`Seleccionado paquete: ${preset.version}`);
                      }
                    }}
                    className={`p-3 rounded-[3px] border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#0077ff]/20 border-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                        : 'bg-[#0b0f17] border-[#1e293b] hover:border-[#3b494b]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${isSelected ? 'text-[#00f0ff]' : 'text-white'}`}>
                        {preset.version}
                      </span>
                      <span className="text-[#64748b]">{preset.size}</span>
                    </div>
                    <p className="text-[11px] text-[#94a3b8] mt-1">{preset.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom .BIN File Drop/Upload */}
          <div className="space-y-2">
            <div className="text-[#94a3b8] uppercase tracking-[0.05em]">
              O SUBE TU PROPIO BINARIO COMPILADO (.BIN)
            </div>

            <label className={`block border-2 border-dashed rounded-[3px] p-3 text-center cursor-pointer transition-colors ${
              customFile ? 'border-[#00e676] bg-[#00e676]/5' : 'border-[#1e293b] hover:border-[#00f0ff] bg-[#0b0f17]'
            }`}>
              <input
                type="file"
                accept=".bin"
                disabled={isFlashing}
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-2 text-white">
                <Upload className="w-4 h-4 text-[#00f0ff]" />
                <span className="font-bold">
                  {customFile ? `ARCHIVO: ${customFile.name}` : `SELECCIONAR ARCHIVO .BIN PARA ${targetChip.toUpperCase()}`}
                </span>
              </div>
              <p className="text-[10px] text-[#64748b] mt-1">
                Compatible con binarios Arduino IDE, ESP-IDF y PlatformIO
              </p>
            </label>
          </div>

          {/* Progress Bar during flash */}
          {isFlashing && (
            <div className="bg-[#0b0f17] p-3 rounded-[3px] border border-[#00f0ff] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#00f0ff] font-bold uppercase flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00f0ff]" />
                  ACTUALIZANDO {otaStatus.targetChip.toUpperCase()}: {otaStatus.state.toUpperCase()}...
                </span>
                <span className="text-white font-bold">{otaStatus.progressPercent}%</span>
              </div>

              <div className="w-full h-3 bg-[#1e293b] rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#0077ff] to-[#00f0ff] rounded-full transition-all duration-150 shadow-[0_0_10px_#00f0ff]"
                  style={{ width: `${otaStatus.progressPercent}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-[#94a3b8]">
                <span>ENVIADO: {(otaStatus.bytesTransferred / 1024).toFixed(0)} / {(otaStatus.totalBytes / 1024).toFixed(0)} KB</span>
                <span>VELOCIDAD BLE: {otaStatus.transferRateKbps} KB/S</span>
              </div>
            </div>
          )}

          {/* Terminal Session Logs */}
          <div className="bg-black/80 rounded-[3px] border border-[#1e293b] p-2.5 max-h-28 overflow-y-auto space-y-1 font-mono text-[10px]">
            {logs.map((log, i) => (
              <div key={i} className="text-[#00e676]/90">
                &gt; {log}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#0b0f17] border-t border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-[#94a3b8] font-mono">
            <Shield className="w-3.5 h-3.5 text-[#00e676]" />
            <span>PROTECCIÓN ROLLBACK AUTOMÁTICA ACTIVA</span>
          </div>

          <div className="flex items-center gap-2">
            {!isFlashing && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-[3px] border border-[#1e293b] text-[#94a3b8] hover:text-white font-mono text-xs"
              >
                CERRAR
              </button>
            )}
            <button
              onClick={startFlash}
              disabled={isFlashing}
              className={`px-4 py-1.5 rounded-[3px] font-mono text-xs font-bold flex items-center gap-2 transition-all ${
                isFlashing
                  ? 'bg-[#1e293b] text-[#64748b] cursor-not-allowed'
                  : 'bg-[#0077ff] hover:bg-[#00f0ff] hover:text-black text-white shadow-[0_0_15px_rgba(0,119,255,0.4)]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isFlashing ? 'FLASHEANDO...' : `ACTUALIZAR ${targetChip.toUpperCase()} POR OTA`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
