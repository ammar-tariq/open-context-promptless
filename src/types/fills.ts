import type { ColorValue } from '@/types';

export interface GradientStop {
  color: ColorValue;
  /** 0–1 along the gradient axis */
  position: number;
}

export interface GradientFill {
  type: 'linear' | 'radial' | 'angular' | 'diamond';
  /** Degrees — meaningful for linear gradients */
  angle?: number;
  stops: GradientStop[];
}

export interface BlurEffect {
  type: 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  radius: number;
}
