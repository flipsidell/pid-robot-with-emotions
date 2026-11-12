import React, { useState } from 'react';
import { TelemetryLogPoint, SystemMetrics, ImuData, MotorTelemetry } from '../types/telemetry';
import { robotManager } from '../services/bleService';
import { FileText, Download, Play, Square, Trash2, Database, Table, Radio } from 'lucide-react';

interface TelemetryLoggerProps {
  isRecording: boolean;
  system: SystemMetrics;
  imu: ImuData;
  motor: MotorTelemetry;
}

export const TelemetryLogger: React.FC<TelemetryLoggerProps> = ({
  isRecording,
  system,
  imu,
  motor
}) => {
  const [downloadFormat, setDownloadFormat] = useState<'csv' | 'json'>('csv');
  const loggedPoints = robotManager.getLoggedPoints();

  const handleToggleRecord = () => {
    if (isRecording) {
      robotManager.stopRecording();
    } else {
      robotManager.startRecording();
    }
  };

  const handleExport = () => {
    const points = robotManager.getLoggedPoints();
    if (points.length === 0) return;

    let content = '';
    let filename = `kinetic_telemetry_${Date.now()}`;
    let mimeType = 'text/plain';

    if (downloadFormat === 'csv') {
      const headers = ['timestamp_epoch', 'pitch_deg', 'roll_deg', 'yaw_deg', 'gyro_y_dps', 'motor_l_pwm', 'motor_r_pwm', 'battery_v', 'joy_x', 'joy_y'];
      const rows = points.map((p) => 
        [p.timestamp, p.pitch, p.roll, p.yaw, p.gyroY, p.motorL, p.motorR, p.batteryV, p.joyX, p.joyY].join(',')
      );
      content = [headers.join(','), ...rows].join('\n');
      filename += '.csv';
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(points, null, 2);
      filename += '.json';
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Sample calculations
  const sampleCount = loggedPoints.length;
  const recentPoints = loggedPoints.slice(-12).reverse();

  return (
    <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-4 flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#1e293b] gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#00f0ff]" />
          <span className="font-space font-semibold text-white tracking-wide text-sm">
            HIGH-FREQUENCY TELEMETRY RECORDER & EXPORT
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Record button */}
          <button
            onClick={handleToggleRecord}
            className={`flex items-center gap-2 px-3 py-1 font-mono text-xs font-bold rounded-[3px] transition-all border ${
              isRecording
                ? 'bg-[#ff3b30] text-white border-white animate-pulse'
                : 'bg-[#0077ff] text-white border-[#00f0ff] hover:bg-[#00f0ff] hover:text-black'
            }`}
          >
            {isRecording ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRecording ? 'STOP RECORDING' : 'RECORD FLIGHT DATA'}</span>
          </button>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={sampleCount === 0}
            className="flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-bold rounded-[3px] bg-[#1a2438] border border-[#1e293b] text-white hover:border-[#00e676] disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#00e676]" />
            <span>EXPORT {downloadFormat.toUpperCase()}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div className="bg-[#0b0f17] p-2.5 rounded-[2px] border border-[#1e293b]">
          <span className="text-[#94a3b8]">BUFFER SAMPLES</span>
          <div className="text-xl font-bold text-[#00f0ff] mt-0.5">{sampleCount.toLocaleString()}</div>
          <span className="text-[10px] text-[#64748b]">MAX 10,000 PTS</span>
        </div>
        <div className="bg-[#0b0f17] p-2.5 rounded-[2px] border border-[#1e293b]">
          <span className="text-[#94a3b8]">SAMPLE RATE</span>
          <div className="text-xl font-bold text-[#00e676] mt-0.5">{system.packetRateHz} HZ</div>
          <span className="text-[10px] text-[#64748b]">INTERVAL: 20 MS</span>
        </div>
        <div className="bg-[#0b0f17] p-2.5 rounded-[2px] border border-[#1e293b]">
          <span className="text-[#94a3b8]">PACKET LOSS</span>
          <div className="text-xl font-bold text-white mt-0.5">
            {system.totalPackets > 0
              ? ((system.droppedPackets / system.totalPackets) * 100).toFixed(2)
              : '0.00'}%
          </div>
          <span className="text-[10px] text-[#64748b]">{system.droppedPackets} DROPPED</span>
        </div>
        <div className="bg-[#0b0f17] p-2.5 rounded-[2px] border border-[#1e293b]">
          <span className="text-[#94a3b8]">EXPORT FORMAT</span>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setDownloadFormat('csv')}
              className={`px-2 py-0.5 text-[11px] rounded-[2px] border ${
                downloadFormat === 'csv'
                  ? 'bg-[#0077ff] text-white border-[#00f0ff]'
                  : 'bg-[#131b2a] text-[#94a3b8] border-[#1e293b]'
              }`}
            >
              CSV (MATLAB)
            </button>
            <button
              onClick={() => setDownloadFormat('json')}
              className={`px-2 py-0.5 text-[11px] rounded-[2px] border ${
                downloadFormat === 'json'
                  ? 'bg-[#0077ff] text-white border-[#00f0ff]'
                  : 'bg-[#131b2a] text-[#94a3b8] border-[#1e293b]'
              }`}
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Live Table Preview */}
      <div className="flex-1 flex flex-col min-h-64 font-mono text-xs">
        <div className="text-[#94a3b8] uppercase tracking-[0.05em] mb-1.5 flex items-center justify-between">
          <span>RECENT TELEMETRY PACKET STREAM</span>
          {isRecording && (
            <span className="text-[#ff3b30] flex items-center gap-1 text-[11px] animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#ff3b30]" /> RECORDING ACTIVE
            </span>
          )}
        </div>

        <div className="bg-[#0b0f17] border border-[#1e293b] rounded-[3px] overflow-x-auto flex-1 max-h-80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1e293b] text-[10px] text-[#94a3b8] bg-[#0d1522]">
                <th className="p-2">TIME</th>
                <th className="p-2">PITCH (θ)</th>
                <th className="p-2">GYRO Y (ω)</th>
                <th className="p-2">ROLL (φ)</th>
                <th className="p-2">PWM L/R</th>
                <th className="p-2">LIPO (V)</th>
                <th className="p-2">JOY X, Y</th>
              </tr>
            </thead>
            <tbody>
              {recentPoints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#64748b]">
                    No recorded frames yet. Click "RECORD FLIGHT DATA" to capture packets.
                  </td>
                </tr>
              ) : (
                recentPoints.map((pt, idx) => (
                  <tr key={idx} className="border-b border-[#1e293b]/40 hover:bg-[#141c2b] text-[11px]">
                    <td className="p-2 text-[#94a3b8]">
                      {new Date(pt.timestamp).toISOString().substring(17, 23)}s
                    </td>
                    <td className={`p-2 font-bold ${Math.abs(pt.pitch) < 3 ? 'text-[#00e676]' : 'text-[#00f0ff]'}`}>
                      {pt.pitch > 0 ? `+${pt.pitch.toFixed(1)}°` : `${pt.pitch.toFixed(1)}°`}
                    </td>
                    <td className="p-2 text-[#ff9f0a]">{pt.gyroY.toFixed(0)} °/s</td>
                    <td className="p-2 text-white">{pt.roll.toFixed(1)}°</td>
                    <td className="p-2 text-[#0077ff] font-semibold">{pt.motorL} / {pt.motorR}</td>
                    <td className="p-2 text-[#00e676]">{pt.batteryV.toFixed(2)}V</td>
                    <td className="p-2 text-[#94a3b8]">
                      ({pt.joyX.toFixed(2)}, {pt.joyY.toFixed(2)})
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
