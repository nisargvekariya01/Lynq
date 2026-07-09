import React, { useMemo } from 'react';
import QRCode from 'qrcode';

export default function CustomQRCode({ value, fgColor, bgColor, qrStyle, logoImage, size, id }) {
  const qr = useMemo(() => {
    try {
      return QRCode.create(value, { errorCorrectionLevel: 'H' });
    } catch (e) {
      return null;
    }
  }, [value]);

  if (!qr) return null;

  const moduleCount = qr.modules.size;
  const data = qr.modules.data;
  
  // Dedicate ~25-30% of the center for the logo
  const logoAreaSize = logoImage ? Math.floor(moduleCount * 0.28) : 0;
  const logoStart = Math.floor((moduleCount - logoAreaSize) / 2);
  const logoEnd = logoStart + logoAreaSize - 1;

  const isFinder = (x, y) => {
    return (x < 7 && y < 7) || 
           (x > moduleCount - 8 && y < 7) || 
           (x < 7 && y > moduleCount - 8);
  };

  const isLogoArea = (x, y) => {
    if (!logoImage) return false;
    return x >= logoStart && x <= logoEnd && y >= logoStart && y <= logoEnd;
  };

  const dots = [];
  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      if (isFinder(x, y) || isLogoArea(x, y)) continue;
      
      const isDark = data[y * moduleCount + x];
      if (isDark) {
        dots.push(
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={1.02} // slight overlap to prevent anti-aliasing gaps
            height={1.02}
            fill={fgColor}
            rx={qrStyle === 'dots' ? 0.51 : 0}
            ry={qrStyle === 'dots' ? 0.51 : 0}
            style={{ transition: 'rx 0.3s ease, ry 0.3s ease' }}
          />
        );
      }
    }
  }

  const Finder = ({ x, y }) => (
    <g>
      <path 
        d={`M${x},${y} h7 v7 h-7 Z M${x+1},${y+1} v5 h5 v-5 Z`} 
        fill={fgColor} 
        fillRule="evenodd" 
      />
      <rect x={x+2} y={y+2} width={3} height={3} fill={fgColor} />
    </g>
  );

  return (
    <svg 
      id={id}
      width={size} 
      height={size} 
      viewBox={`-2 -2 ${moduleCount + 4} ${moduleCount + 4}`} 
      style={{ background: bgColor }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background rect for transparent downloads */}
      <rect x="-2" y="-2" width={moduleCount + 4} height={moduleCount + 4} fill={bgColor} />
      
      <Finder x={0} y={0} />
      <Finder x={moduleCount - 7} y={0} />
      <Finder x={0} y={moduleCount - 7} />

      {dots}

      {logoImage && (
        <image
          href={logoImage}
          x={logoStart + 0.5}
          y={logoStart + 0.5}
          width={logoAreaSize - 1}
          height={logoAreaSize - 1}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
    </svg>
  );
}
