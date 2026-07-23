import type { V3Section } from '../types';

interface V3IntroSceneProps {
  section: V3Section;
}

export const V3IntroScene = ({ section }: V3IntroSceneProps) => {
  return (
    <div className="v3-intro-title">{section.title}</div>
  );
};
