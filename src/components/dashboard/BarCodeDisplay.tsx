import Barcode from 'react-barcode';

interface BarCodeDisplayProps {
  value: string;
  width?: number;
  height?: number;
}

export const BarCodeDisplay = ({ value, width = 1.5, height = 40 }: BarCodeDisplayProps) => {
  return (
    <div className="flex flex-col items-center">
      <Barcode
        value={value}
        width={width}
        height={height}
        displayValue={false}
        background="transparent"
      />
      <p className="text-xs font-mono mt-1">{value}</p>
    </div>
  );
};
