/**
 * AuraMusic — Animated Welcome Cursive Stroke SVG
 *
 * Implements an Apple-keynote-grade cursive handwriting stroke animation
 * writing "Welcome" using SVG strokeDashoffset and Reanimated.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SW } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Total estimated stroke length for the cursive "Welcome" path
const PATH_LENGTH = 5800;

// High-fidelity continuous cursive path spelling "Welcome"
const WELCOME_CURSIVE_PATH =
  'M 60,180 ' +
  'C 75,120 115,70 150,70 C 180,70 175,180 185,275 C 188,285 200,285 206,270 ' +
  'C 225,190 265,120 295,75 C 310,55 330,65 330,100 C 330,170 335,250 345,275 ' +
  'C 350,285 362,280 370,260 C 395,190 425,120 450,80 C 465,58 490,75 480,115 ' +
  'C 468,160 430,190 460,195 C 480,198 505,170 525,145 ' +
  // e
  'C 540,130 570,135 565,175 C 560,215 510,240 485,240 C 460,240 468,205 492,180 ' +
  'C 518,155 570,160 590,205 ' +
  // l
  'C 608,245 622,285 645,285 C 662,285 668,250 668,200 C 668,115 648,30 670,25 ' +
  'C 692,20 715,85 706,165 C 698,235 672,285 715,285 ' +
  // c
  'C 740,285 765,240 785,200 C 798,175 810,165 798,165 C 775,165 752,195 752,228 ' +
  'C 752,268 785,285 820,285 ' +
  // o
  'C 852,285 878,258 885,220 C 892,182 868,165 840,165 C 810,165 800,205 808,235 ' +
  'C 816,265 848,285 875,285 C 900,285 915,262 908,232 C 900,200 925,185 945,195 ' +
  // m
  'C 962,205 970,235 970,275 C 970,282 982,282 990,262 C 1005,215 1030,175 1052,175 ' +
  'C 1075,175 1068,222 1062,275 C 1062,282 1075,282 1082,262 C 1098,215 1122,175 1145,175 ' +
  'C 1168,175 1165,222 1160,275 ' +
  // e
  'C 1160,282 1172,282 1180,265 C 1195,235 1225,175 1250,175 C 1270,175 1265,215 1235,235 ' +
  'C 1205,255 1198,280 1228,280 C 1260,280 1310,220 1345,190';

interface WelcomeStrokeSvgProps {
  onAnimationComplete?: () => void;
  duration?: number;
}

export const WelcomeStrokeSvg = React.memo(({
  onAnimationComplete,
  duration = 3200,
}: WelcomeStrokeSvgProps) => {
  const strokeOffset = useSharedValue(PATH_LENGTH);

  useEffect(() => {
    strokeOffset.value = withTiming(
      0,
      {
        duration,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      },
      (finished) => {
        if (finished && onAnimationComplete) {
          // Callback after handwriting completes
          // run on JS thread if passed
        }
      }
    );
  }, [duration, onAnimationComplete]);

  const animatedGlowProps = useAnimatedProps(() => ({
    strokeDashoffset: strokeOffset.value,
  }));

  const animatedStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: strokeOffset.value,
  }));

  const svgWidth = SW * 0.92;
  const svgHeight = (svgWidth * 320) / 1400;

  return (
    <View style={styles.container}>
      <Svg
        width={svgWidth}
        height={svgHeight}
        viewBox="0 0 1400 320"
        style={styles.svg}
      >
        <Defs>
          <SvgLinearGradient id="welcomeGlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#BF5AF2" stopOpacity="0.8" />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#7B42F6" stopOpacity="0.8" />
          </SvgLinearGradient>
        </Defs>

        {/* Ambient Glow Stroke Behind */}
        <AnimatedPath
          d={WELCOME_CURSIVE_PATH}
          fill="none"
          stroke="url(#welcomeGlowGradient)"
          strokeWidth={38}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeMiterlimit={10}
          strokeDasharray={`${PATH_LENGTH}, ${PATH_LENGTH}`}
          animatedProps={animatedGlowProps}
          opacity={0.45}
        />

        {/* Crisp White Front Handwriting Stroke */}
        <AnimatedPath
          d={WELCOME_CURSIVE_PATH}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={22}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeMiterlimit={10}
          strokeDasharray={`${PATH_LENGTH}, ${PATH_LENGTH}`}
          animatedProps={animatedStrokeProps}
        />
      </Svg>
    </View>
  );
});

WelcomeStrokeSvg.displayName = 'WelcomeStrokeSvg';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 16,
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 8,
  },
  svg: {
    alignSelf: 'center',
  },
});
