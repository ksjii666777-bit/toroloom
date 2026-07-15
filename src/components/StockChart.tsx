import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Rect, Text as SvgText, Defs as SvgDefs, LinearGradient as SvgLinearGradient, Stop as SvgStop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { FONTS} from '../constants/theme';
import { formatCurrency } from '../utils/formatters';

interface ChartDataPoint {
  date: string;
  price: number;
}

interface StockChartProps {
  data: ChartDataPoint[];
  height?: number;
  width?: number;
  lineColor?: string;
  gradientColor?: string;
  positive?: boolean;
  showAxis?: boolean;
}

export default function StockChart({
  data,
  height = 200,
  width = Dimensions.get('window').width - 48,
  lineColor,
  gradientColor,
  positive = true,
  showAxis = false,
}: StockChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; price: number; date: string } | null>(null);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.noData}>No chart data available</Text>
      </View>
    );
  }

  const padding = { top: 20, right: 10, bottom: 30, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices) * 0.995;
  const maxPrice = Math.max(...prices) * 1.005;
  const priceRange = maxPrice - minPrice;

  const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
  const getY = (price: number) => padding.top + ((maxPrice - price) / priceRange) * chartHeight;

  const lineColorFinal = lineColor || (positive ? colors.marketUp : colors.marketDown);
  const gradientColorFinal = gradientColor || (positive ? '#00C853' : '#FF1744');

  // Create smooth path using cubic bezier curves
  const generatePath = () => {
    if (data.length < 2) return '';
    
    let path = `M ${getX(0)} ${getY(data[0].price)}`;
    
    for (let i = 1; i < data.length; i++) {
      const x1 = getX(i - 1);
      const y1 = getY(data[i - 1].price);
      const x2 = getX(i);
      const y2 = getY(data[i].price);
      const cp1x = x1 + (x2 - x1) / 3;
      const cp2x = x1 + 2 * (x2 - x1) / 3;
      path += ` C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
    }
    
    return path;
  };

  // Create gradient fill path
  const generateFillPath = () => {
    if (data.length < 2) return '';
    const lastX = getX(data.length - 1);
    const firstX = getX(0);
    return `${generatePath()} L ${lastX} ${padding.top + chartHeight} L ${firstX} ${padding.top + chartHeight} Z`;
  };

  const path = generatePath();
  const fillPath = generateFillPath();

  // Y-axis labels
  const yLabels = [minPrice, (minPrice + maxPrice) / 2, maxPrice];

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={width} height={height}>
        {/* Gradient for area fill */}
        <SvgDefs>
          <SvgLinearGradient id={`gradient-${positive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
            <SvgStop offset="0%" stopColor={gradientColorFinal} stopOpacity="0.3" />
            <SvgStop offset="100%" stopColor={gradientColorFinal} stopOpacity="0.0" />
          </SvgLinearGradient>
        </SvgDefs>

        {/* Y-axis labels */}
        {showAxis && yLabels.map((price, i) => (
          <SvgText
            key={`ylabel_${i}`}
            x={2}
            y={getY(price) + 4}
            fill={colors.textMuted}
            fontSize={10}
            fontFamily="System"
          >
            {formatCurrency(price, true)}
          </SvgText>
        ))}

        {/* Grid lines */}
        {showAxis && yLabels.map((price, i) => (
          <Line
            key={`grid_${i}`}
            x1={padding.left}
            y1={getY(price)}
            x2={width - padding.right}
            y2={getY(price)}
            stroke={colors.borderLight}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}

        {/* Area fill */}
        <Path
          d={fillPath}
          fill={`url(#gradient-${positive ? 'up' : 'down'})`}
        />

        {/* Main line */}
        <Path
          d={path}
          stroke={lineColorFinal}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Tooltip line */}
        {tooltip && (
          <>
            <Line
              x1={tooltip.x}
              y1={padding.top}
              x2={tooltip.x}
              y2={padding.top + chartHeight}
              stroke={colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <Rect
              x={tooltip.x - 60}
              y={tooltip.y - 40}
              width={120}
              height={32}
              rx={8}
              fill={colors.bgCardLight}
              stroke={colors.border}
              strokeWidth={1}
            />
            <SvgText
              x={tooltip.x}
              y={tooltip.y - 20}
              fill={colors.text}
              fontSize={12}
              fontFamily="System"
              fontWeight="600"
              textAnchor="middle"
            >
              {formatCurrency(tooltip.price)}
            </SvgText>
          </>
        )}

        {/* Touchable overlay for tooltip */}
        <Rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          fill="transparent"
          onPress={() => setTooltip(null)}
        />
      </Svg>
    </View>
  );
}


const createStyles = (colors: any) => StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noData: {
    color: colors.textMuted,
    fontSize: FONTS.size.md,
    fontFamily: 'System',
  },
});
