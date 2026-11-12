import React, { useState, useEffect, useRef, useCallback } from 'react';
import { JoystickVector, SystemMetrics, ImuData, RobotConfig } from '../types/telemetry';
import { robotManager } from '../services/bleService';
import { Compass, Gauge, ShieldAlert, Sparkles, Sliders, Volume2, Gamepad, Vibrate } from 'lucide-react';

interface JoystickControllerProps {
  onVectorChange?: (vector: JoystickVector) => void;
  system?: SystemMetrics;
  imu?: ImuData;
  config?: RobotConfig;
  className?: string;
  compact?: boolean;
}

export const JoystickController: React.FC<JoystickControllerProps> = ({
  onVectorChange,
  system,
  imu,
  config,
  className = '',
  compact = false
}) => {
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 }); // normalized -1 to 1
  const [rightStickPos, setRightStickPos] = useState({ x: 0, y: 0 }); // for split stick mode
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [dualStickMode, setDualStickMode] = useState(false);
  const [trim, setTrim] = useState({ x: 0, y: 0 });
  const [hasPhysicalGamepad, setHasPhysicalGamepad] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const leftPadRef = useRef<HTMLDivElement>(null);
  const rightPadRef = useRef<HTMLDivElement>(null);
  const lastMaxThrowVibeRef = useRef<number>(0);
  const wasUnstableRef = useRef<boolean>(false);

  // Safe Vibration API dispatcher
  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (!hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (err) {}
    }
  }, [hapticsEnabled]);

  // Monitor Robot Unstable State (Fallen, Tilt cutoff, E-stop) and trigger haptic warning
  useEffect(() => {
    const isFallen = system?.isFallen || robotManager.system.isFallen;
    const isEStopped = system?.emergencyStop || robotManager.system.emergencyStop;
    const currentPitch = Math.abs(imu?.pitch ?? robotManager.imu.pitch);
    const maxTilt = config?.maxTiltAngle ?? robotManager.config.maxTiltAngle;
    const isCriticallyTilted = currentPitch > maxTilt * 0.72;

    const isCurrentlyUnstable = isFallen || isEStopped || isCriticallyTilted;

    if (isCurrentlyUnstable && !wasUnstableRef.current) {
      // Transitioned into unstable state -> trigger prominent haptic alarm!
      if (isFallen) {
        triggerHaptic([70, 40, 70, 40, 140]);
      } else if (isCriticallyTilted) {
        triggerHaptic([40, 30, 40]);
      } else if (isEStopped) {
        triggerHaptic([100, 50, 120]);
      }
    }

    wasUnstableRef.current = isCurrentlyUnstable;
  }, [system?.isFallen, system?.emergencyStop, imu?.pitch, config?.maxTiltAngle, triggerHaptic]);

  // Send updates to ble service
  const updateVector = useCallback((vx: number, vy: number) => {
    const vector: JoystickVector = {
      x: Math.max(-1, Math.min(1, parseFloat((vx + trim.x).toFixed(3)))),
      y: Math.max(-1, Math.min(1, parseFloat((vy + trim.y).toFixed(3)))),
      trimX: trim.x,
      trimY: trim.y
    };
    robotManager.sendJoystickUpdate(vector);
    onVectorChange?.(vector);
  }, [trim, onVectorChange]);

  // Physical Gamepad API polling loop
  useEffect(() => {
    let animId: number;
    const pollGamepad = () => {
      if (typeof navigator !== 'undefined' && 'getGamepads' in navigator) {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0] || gamepads[1];
        if (gp) {
          setHasPhysicalGamepad(true);
          // Standard Gamepad mapping: axes[0]=LeftX, axes[1]=LeftY, axes[2]=RightX, axes[3]=RightY
          const axisX = Math.abs(gp.axes[0]) > 0.08 ? gp.axes[0] : (Math.abs(gp.axes[2]) > 0.08 ? gp.axes[2] : 0);
          const axisY = Math.abs(gp.axes[1]) > 0.08 ? -gp.axes[1] : (Math.abs(gp.axes[3]) > 0.08 ? -gp.axes[3] : 0);
          
          setStickPos({ x: axisX, y: axisY });
          updateVector(axisX, axisY);

          // Button 0 (A) or Button 1 (B) check
          if (gp.buttons[1]?.pressed || gp.buttons[9]?.pressed) {
            robotManager.triggerEmergencyStop();
          }
        } else {
          setHasPhysicalGamepad(false);
        }
      }
      animId = requestAnimationFrame(pollGamepad);
    };

    animId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animId);
  }, [updateVector]);

  // Keyboard navigation fallback (W/S/A/D and Arrow Keys)
  useEffect(() => {
    const keysPressed: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      keysPressed[e.code] = true;
      let nx = 0;
      let ny = 0;

      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) ny += 0.8;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) ny -= 0.8;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) nx -= 0.8;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) nx += 0.8;
      if (keysPressed['Space']) {
        robotManager.triggerEmergencyStop();
        return;
      }

      setStickPos({ x: nx, y: ny });
      updateVector(nx, ny);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.code] = false;
      let nx = 0;
      let ny = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) ny += 0.8;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) ny -= 0.8;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) nx -= 0.8;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) nx += 0.8;

      setStickPos({ x: nx, y: ny });
      updateVector(nx, ny);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [updateVector]);

  // Touch and pointer tracking on Left Stick
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    handlePointerMove(e);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !leftPadRef.current) return;
    const rect = leftPadRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const distance = Math.hypot(dx, dy);

    // Limit to circular radius
    const clampedDist = Math.min(radius, distance);
    const angle = Math.atan2(dy, dx);

    const normX = (clampedDist * Math.cos(angle)) / radius;
    const normY = -(clampedDist * Math.sin(angle)) / radius; // Invert Y so up is positive throttle

    // Trigger haptic feedback when joystick approaches maximum throw (magnitude >= 0.88)
    const mag = Math.hypot(normX, normY);
    if (mag >= 0.88) {
      const now = performance.now();
      if (now - lastMaxThrowVibeRef.current > 260) {
        lastMaxThrowVibeRef.current = now;
        triggerHaptic([25, 20, 25]);
      }
    }

    if (dualStickMode) {
      // In dual stick mode: Left stick is Throttle (Y only)
      setStickPos({ x: 0, y: normY });
      updateVector(rightStickPos.x, normY);
    } else {
      setStickPos({ x: normX, y: normY });
      updateVector(normX, normY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
    setIsDragging(false);
    setStickPos({ x: 0, y: 0 });
    if (dualStickMode) {
      updateVector(rightStickPos.x, 0);
    } else {
      updateVector(0, 0);
    }
  };

  // Right Stick handlers (Yaw/Steering in Split Mode)
  const handleRightPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingRight(true);
    handleRightPointerMove(e);
  };

  const handleRightPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRight || !rightPadRef.current) return;
    const rect = rightPadRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const clampedDist = Math.min(radius, distance);
    const angle = Math.atan2(dy, dx);

    const normX = (clampedDist * Math.cos(angle)) / radius;

    // Trigger max throw vibration on right stick as well
    if (Math.abs(normX) >= 0.88) {
      const now = performance.now();
      if (now - lastMaxThrowVibeRef.current > 260) {
        lastMaxThrowVibeRef.current = now;
        triggerHaptic([25, 20, 25]);
      }
    }

    setRightStickPos({ x: normX, y: 0 });
    updateVector(normX, stickPos.y);
  };

  const handleRightPointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
    setIsDraggingRight(false);
    setRightStickPos({ x: 0, y: 0 });
    updateVector(0, stickPos.y);
  };

  const padSizePx = compact ? 190 : 250;
  const stickRadiusPx = padSizePx / 2;

  // Knob pixel offset
  const knobLeft = stickRadiusPx + stickPos.x * (stickRadiusPx - 34);
  const knobTop = stickRadiusPx - stickPos.y * (stickRadiusPx - 34);

  const rightKnobLeft = stickRadiusPx + rightStickPos.x * (stickRadiusPx - 34);
  const rightKnobTop = stickRadiusPx;

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Control bar above joystick */}
      <div className="w-full flex items-center justify-between pb-3 text-xs font-mono border-b border-[#1e293b]/80 mb-3 px-1">
        <div className="flex items-center gap-2">
          <Gamepad className="w-4 h-4 text-[#00f0ff]" />
          <span className="font-space font-semibold text-white tracking-wide">
            {dualStickMode ? 'SPLIT DUAL-AXIS' : 'OMNI GAMEPAD JOYSTICK'}
          </span>
          {hasPhysicalGamepad && (
            <span className="px-1.5 py-0.2 bg-[#00e676]/20 border border-[#00e676] text-[#00e676] text-[10px] rounded-[2px] animate-pulse">
              GAMEPAD DETECTED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Haptic Feedback Toggle */}
          <button
            onClick={() => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              if (next) triggerHaptic([30, 20, 40]);
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-mono border transition-all ${
              hapticsEnabled
                ? 'bg-[#00e676]/20 border-[#00e676] text-[#00e676]'
                : 'bg-[#131b2a] border-[#1e293b] text-[#64748b]'
            }`}
            title="Vibration API: Haptics on Max Throw and Instability"
          >
            <Vibrate className="w-3 h-3" />
            <span>{hapticsEnabled ? 'HAPTIC ON' : 'HAPTIC OFF'}</span>
          </button>

          {/* Dual Stick Mode Toggle */}
          <button
            onClick={() => setDualStickMode(!dualStickMode)}
            className={`px-2 py-0.5 rounded-[3px] text-[11px] font-mono border transition-all ${
              dualStickMode
                ? 'bg-[#0077ff] text-white border-[#00f0ff]'
                : 'bg-[#131b2a] text-[#94a3b8] border-[#1e293b] hover:text-white'
            }`}
          >
            {dualStickMode ? 'SPLIT STICKS' : 'SINGLE STICK'}
          </button>
        </div>
      </div>

      {/* Main Joystick Area */}
      <div className={`flex flex-wrap items-center justify-center gap-6 sm:gap-10 my-2`}>
        {/* Primary/Left Thumbstick Well */}
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-[#94a3b8] mb-1">
            {dualStickMode ? 'THROTTLE (PITCH ACCEL)' : 'OMNI DRIVE (THROTTLE & YAW)'}
          </div>

          <div
            ref={leftPadRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ width: `${padSizePx}px`, height: `${padSizePx}px` }}
            className="relative rounded-full bg-[#131b2a] border-2 border-[#1e293b] shadow-[inset_0_0_24px_rgba(0,0,0,0.6)] cursor-crosshair touch-none overflow-hidden"
          >
            {/* Etched Crosshairs (#1E293B) */}
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-[#1e293b]" />
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[#1e293b]" />

            {/* Inner Deadband Reference Circle */}
            <div 
              style={{ 
                width: `${padSizePx * 0.35}px`, 
                height: `${padSizePx * 0.35}px` 
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#1e293b]/90 pointer-events-none" 
            />

            {/* 70% Max Power Ring */}
            <div 
              style={{ 
                width: `${padSizePx * 0.75}px`, 
                height: `${padSizePx * 0.75}px` 
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1e293b]/50 pointer-events-none" 
            />

            {/* Dynamic Thumbpad Handle (#0077FF core with 2px #00F0FF glowing beacon ring) */}
            <div
              style={{
                left: `${knobLeft}px`,
                top: `${knobTop}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className={`absolute w-16 h-16 rounded-full bg-[#0077ff] border-2 border-[#00f0ff] shadow-[0_0_16px_rgba(0,240,255,0.7)] flex items-center justify-center pointer-events-none transition-transform duration-75 ${
                isDragging ? 'scale-105' : 'scale-100'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white/90 shadow-[0_0_8px_#fff]" />
            </div>
          </div>

          {/* Coordinate offsets (X, Y) directly beneath control pad in JetBrains Mono */}
          <div className="mt-2.5 flex items-center gap-4 text-xs font-mono">
            <span className="text-[#94a3b8]">
              X: <span className="text-[#00f0ff] font-semibold">{stickPos.x.toFixed(2)}</span>
            </span>
            <span className="text-[#94a3b8]">
              Y: <span className="text-[#00f0ff] font-semibold">{stickPos.y.toFixed(2)}</span>
            </span>
            <span className="text-[#94a3b8]">
              MAG: <span className="text-[#00e676] font-semibold">{(Math.hypot(stickPos.x, stickPos.y) * 100).toFixed(0)}%</span>
            </span>
          </div>
        </div>

        {/* Optional Right Thumbstick in Split Dual Stick Mode */}
        {dualStickMode && (
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-[#94a3b8] mb-1">
              STEERING / YAW ORIENTATION
            </div>

            <div
              ref={rightPadRef}
              onPointerDown={handleRightPointerDown}
              onPointerMove={handleRightPointerMove}
              onPointerUp={handleRightPointerUp}
              onPointerCancel={handleRightPointerUp}
              style={{ width: `${padSizePx}px`, height: `${padSizePx}px` }}
              className="relative rounded-full bg-[#131b2a] border-2 border-[#1e293b] shadow-[inset_0_0_24px_rgba(0,0,0,0.6)] cursor-crosshair touch-none overflow-hidden"
            >
              <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-[#1e293b]" />
              <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[#1e293b]" />
              <div 
                style={{ width: `${padSizePx * 0.35}px`, height: `${padSizePx * 0.35}px` }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#1e293b]/90 pointer-events-none" 
              />

              <div
                style={{
                  left: `${rightKnobLeft}px`,
                  top: `${rightKnobTop}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute w-16 h-16 rounded-full bg-[#0077ff] border-2 border-[#00f0ff] shadow-[0_0_16px_rgba(0,240,255,0.7)] flex items-center justify-center pointer-events-none"
              >
                <div className="w-4 h-4 rounded-full bg-white/90 shadow-[0_0_8px_#fff]" />
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-4 text-xs font-mono">
              <span className="text-[#94a3b8]">
                STEER: <span className="text-[#00f0ff] font-semibold">{rightStickPos.x.toFixed(2)}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Trim & Auxiliary Controls */}
      <div className="w-full max-w-md bg-[#131b2a]/80 border border-[#1e293b] rounded-[4px] p-2.5 mt-3 flex items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-[#94a3b8] text-[10px] uppercase tracking-wider">BALANCE TRIM:</span>
          <button
            onClick={() => {
              const ny = Math.max(-0.2, trim.y - 0.02);
              setTrim({ ...trim, y: parseFloat(ny.toFixed(2)) });
              updateVector(stickPos.x, stickPos.y);
            }}
            className="px-2 py-0.5 bg-[#1a2438] hover:bg-[#222a3a] border border-[#1e293b] rounded-[2px] text-white"
            title="Pitch Lean Forward Trim"
          >
            -
          </button>
          <span className="text-[#00f0ff] font-bold min-w-[36px] text-center">
            {trim.y > 0 ? `+${trim.y.toFixed(2)}` : trim.y.toFixed(2)}
          </span>
          <button
            onClick={() => {
              const ny = Math.min(0.2, trim.y + 0.02);
              setTrim({ ...trim, y: parseFloat(ny.toFixed(2)) });
              updateVector(stickPos.x, stickPos.y);
            }}
            className="px-2 py-0.5 bg-[#1a2438] hover:bg-[#222a3a] border border-[#1e293b] rounded-[2px] text-white"
            title="Pitch Lean Back Trim"
          >
            +
          </button>
        </div>

        <button
          onClick={() => {
            setTrim({ x: 0, y: 0 });
            updateVector(stickPos.x, stickPos.y);
          }}
          className="text-[10px] text-[#94a3b8] hover:text-white underline"
        >
          RESET TRIM
        </button>

        <div className="text-[10px] text-[#64748b] hidden sm:block">
          KEYBOARD: [W,A,S,D] · SPACE: STOP
        </div>
      </div>
    </div>
  );
};
