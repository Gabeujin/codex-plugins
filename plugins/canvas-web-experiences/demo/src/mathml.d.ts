import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type MathMlProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  display?: 'block' | 'inline';
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      math: MathMlProps;
      mrow: MathMlProps;
      mi: MathMlProps;
      mo: MathMlProps;
      mn: MathMlProps;
      mfrac: MathMlProps;
      msup: MathMlProps;
    }
  }
}
