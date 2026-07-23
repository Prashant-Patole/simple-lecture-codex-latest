import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { ResolvedImage } from './ResolvedImage';
import { convertMathpixToStandard } from '@/components/learning/player/utils/latexNormalizer';

interface MathpixRendererProps {
  mmdText: string;
  title?: string;
  className?: string;
  inline?: boolean;
}

export const MathpixRenderer = ({ mmdText, title, className, inline = false }: MathpixRendererProps) => {

  if (!mmdText) {
    return (
      <Alert>
        <AlertDescription>No content available to display</AlertDescription>
      </Alert>
    );
  }

  const standardMarkdown = convertMathpixToStandard(mmdText);

  const markdownComponents = {
    img: ({ node, ...imgProps }: any) => <ResolvedImage {...imgProps} />,
  };

  const content = (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${inline ? '' : 'overflow-x-auto'} [&_table]:min-w-0 [&_table]:w-full [&_table]:table-auto [&_img]:max-w-full [&_img]:h-auto [&_p]:m-0 [&_p]:inline`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={markdownComponents}
      >
        {standardMarkdown}
      </ReactMarkdown>
    </div>
  );

  if (inline) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>{content}</CardContent>
    </Card>
  );
};
