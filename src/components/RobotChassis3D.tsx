import React from 'react';
import { ImuData, MotorTelemetry, RobotEmotion, JoystickVector } from '../types/telemetry';

interface RobotChassis3DProps {
  imu: ImuData;
  motor: MotorTelemetry;
  emotion: RobotEmotion;
  joystick: JoystickVector;
}

export const RobotChassis3D: React.FC<RobotChassis3DProps> = ({
  imu,
  motor,
  emotion,
  joystick
}) => {
  const pitchClamped = Math.max(-50, Math.min(50, imu.pitch));
  const isUpright = Math.abs(imu.pitch) < 3.0;

  return (
    <div className="bg-[#131b2a] border border-[#1e293b] rounded-[4px] p-4 flex flex-col items-center justify-between h-full">
      <div className="w-full flex items-center justify-between pb-2 border-b border-[#1e293b] text-xs font-mono">
        <span className="font-space font-semibold text-white tracking-wide">
          2-WHEEL INVERTED PENDULUM // CHASSIS VIEW
        </span>
        <span className={`px-2 py-0.5 rounded-[2px] font-bold ${
          isUpright ? 'bg-[#00e676]/20 text-[#00e676]' : 'bg-[#00f0ff]/20 text-[#00f0ff]'
        }`}>
          {isUpright ? 'BALANCED' : `${pitchClamped > 0 ? '+' : ''}${pitchClamped.toFixed(1)}° LEAN`}
        </span>
      </div>

      {/* Interactive 2D/3D dynamic visual representation */}
      <div className="relative my-4 w-full h-52 bg-[#0b0f17] border border-[#1e293b] rounded-[4px] flex items-center justify-center overflow-hidden">
        {/* Perspective Grid Background */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#141c2b] to-transparent pointer-events-none" />
        
        {/* Ground Plane */}
        <div className="absolute bottom-10 inset-x-6 h-[2px] bg-[#1e293b] flex items-center justify-center">
          <div className="w-16 h-1 bg-[#00f0ff]/40 rounded-full" />
        </div>

        {/* Dynamic Pendulum Robot Container with transform rotation */}
        <div
          className="relative flex flex-col items-center transition-transform duration-75 origin-bottom"
          style={{
            transform: `rotate(${pitchClamped}deg) translateY(-20px)`,
            willChange: 'transform'
          }}
        >
          {/* Top Head with OLED Screen */}
          <div className="w-20 h-16 bg-[#18202f] border-2 border-[#00f0ff] rounded-[6px] shadow-[0_0_15px_rgba(0,240,255,0.4)] flex flex-col items-center justify-center p-1 relative">
            {/* Antenna Beacons */}
            <div className="absolute -top-3 left-3 w-1 h-3 bg-[#0077ff] rounded-t-full">
              <div className="w-2 h-2 -ml-0.5 rounded-full bg-[#00f0ff] animate-ping" />
            </div>
            <div className="absolute -top-3 right-3 w-1 h-3 bg-[#0077ff] rounded-t-full">
              <div className="w-2 h-2 -ml-0.5 rounded-full bg-[#00e676]" />
            </div>

            {/* OLED Front Face */}
            <div className="w-16 h-10 bg-black border border-[#00f0ff]/60 rounded-[2px] flex items-center justify-center overflow-hidden">
              <div className="text-[10px] font-mono font-black text-[#00f0ff] tracking-wider text-center">
                {emotion === 'HAPPY' && '( ^ ‿ ^ )'}
                {emotion === 'CURIOUS' && '( o ‿ • )'}
                {emotion === 'SURPRISED' && '( O ‿ O )'}
                {emotion === 'WINK' && '( ^ ‿ < )'}
                {emotion === 'DIZZY' && '( @ ﹏ @ )'}
                {emotion === 'ALERT' && '[ ! E-STOP ! ]'}
                {emotion === 'ANGRY' && '( > 益 < )'}
                {emotion === 'SLEEP' && '( - ‿ - ) zZ'}
                {emotion === 'CONFIDENT' && '[ ═══ ═══ ]'}
                {emotion === 'SCANNING' && '[ ■■■□□□ ]'}
                {emotion === 'HEART' && '♥ ( ˘ ³˘)'}
                {emotion === 'CUSTOM' && '[ ▦ PIXEL ▦ ]'}
              </div>
            </div>

            <span className="text-[7px] font-mono text-[#94a3b8] mt-0.5">ESP32-S3</span>
          </div>

          {/* Electronics & LiPo Battery Tier */}
          <div className="w-16 h-10 bg-[#131b2a] border border-[#1e293b] rounded-[2px] my-1 flex flex-col items-center justify-center">
            <span className="text-[8px] font-mono text-[#00e676] font-bold">MPU-6050 DMP</span>
            <div className="w-12 h-1.5 bg-[#00e676]/20 border border-[#00e676]/40 rounded-full my-0.5" />
            <span className="text-[7px] font-mono text-[#94a3b8]">3S 11.1V 2200mAh</span>
          </div>

          {/* Motor Mount Bracket */}
          <div className="w-12 h-4 bg-[#222a3a] border border-[#3b494b] rounded-[1px] flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#ff9f0a]" />
          </div>

          {/* Bottom Dual Wheels */}
          <div className="relative flex items-center justify-center -mt-1">
            {/* Left Wheel */}
            <div className="w-4 h-14 bg-[#2d3545] border-2 border-[#0077ff] rounded-[3px] shadow-lg mr-6 flex items-center justify-center">
              <div className="w-1 h-8 bg-[#00f0ff]/60" />
            </div>

            {/* Axle Center Hub */}
            <div className="w-6 h-6 rounded-full bg-[#0077ff] border-2 border-white flex items-center justify-center shadow-md">
              <div className="w-2 h-2 rounded-full bg-black" />
            </div>

            {/* Right Wheel */}
            <div className="w-4 h-14 bg-[#2d3545] border-2 border-[#0077ff] rounded-[3px] shadow-lg ml-6 flex items-center justify-center">
              <div className="w-1 h-8 bg-[#00f0ff]/60" />
            </div>
          </div>
        </div>

        {/* Reaction Torque Arrows */}
        {Math.abs(motor.leftPwm) > 10 && (
          <div className={`absolute bottom-6 font-mono text-xs font-bold ${
            motor.leftPwm > 0 ? 'text-[#00e676] right-8' : 'text-[#ff9f0a] left-8'
          }`}>
            {motor.leftPwm > 0 ? 'TORQUE ▶' : '◀ TORQUE'}
          </div>
        )}
      </div>

      {/* Subsystem State Bar */}
      <div className="w-full grid grid-cols-3 gap-2 text-center font-mono text-xs">
        <div className="bg-[#0b0f17] p-1.5 rounded-[2px] border border-[#1e293b]">
          <span className="text-[#94a3b8] text-[9px] block">LEFT MOTOR</span>
          <span className="text-[#0077ff] font-bold">{motor.leftPwm} PWM</span>
        </div>
        <div className="bg-[#0b0f17] p-1.5 rounded-[2px] border border-[#1e293b]">
          <span className="text-[#94a3b8] text-[9px] block">RIGHT MOTOR</span>
          <span className="text-[#0077ff] font-bold">{motor.rightPwm} PWM</span>
        </div>
        <div className="bg-[#0b0f17] p-1.5 rounded-[2px] border border-[#1e293b]">
          <span className="text-[#94a3b8] text-[9px] block">CURRENT DRAW</span>
          <span className="text-[#00e676] font-bold">{motor.currentDrawA.toFixed(2)} A</span>
        </div>
      </div>
    </div>
  );
};
