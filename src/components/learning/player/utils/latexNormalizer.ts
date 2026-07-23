/**
 * Converts Mathpix-style LaTeX notation to standard delimiters for rehype-katex.
 * Shared between MathpixRenderer and ContentRenderer.
 */
export const convertMathpixToStandard = (text: string): string => {
  if (!text) return '';

  // Bare math operator passthrough: a single operator like "+", "-", "=" on its own
  // gets eaten by markdown (list marker / emphasis) and renders blank.
  // Wrap in $...$ so KaTeX renders it as a visible symbol.
  const bareOperatorMatch = text.trim().match(/^([+\-=*/×÷±≤≥<>≠→])$/);
  if (bareOperatorMatch) {
    return `$${bareOperatorMatch[1]}$`;
  }

  // Convert \( \) to $ $ for inline math
  let converted = text.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
  
  // Convert \[ \] to $$ $$ for display math
  converted = converted.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
  
  // Convert HTML bold tags to markdown bold
  converted = converted.replace(/<\/?[Bb]>/g, '**');
  // Convert HTML italic tags to markdown italic
  converted = converted.replace(/<\/?[Ii]>/g, '*');
  // Convert subscript HTML to LaTeX subscript
  converted = converted.replace(/<[Ss][Uu][Bb]>(.*?)<\/[Ss][Uu][Bb]>/gi, '$_{$1}$');
  // Convert superscript HTML to LaTeX superscript
  converted = converted.replace(/<[Ss][Uu][Pp]>(.*?)<\/[Ss][Uu][Pp]>/gi, '$^{$1}$');

  // Generic uppercase normalization - converts ANY \UPPERCASE command to \lowercase
  converted = converted.replace(/\\([A-Z]{2,})/g, (match, cmd) => '\\' + cmd.toLowerCase());

  // Fix \text without braces (e.g., \textH^+ -> \text{H}^+)
  converted = converted.replace(/\\text([A-Za-z]+)/g, '\\text{$1}');

  // Fix unmatched/orphaned $$ delimiters
  const ddMatches = converted.match(/\$\$/g);
  const ddCount = ddMatches ? ddMatches.length : 0;
  if (ddCount % 2 !== 0) {
    // Find positions of all $$
    const ddPositions: number[] = [];
    let searchFrom = 0;
    while (true) {
      const idx = converted.indexOf('$$', searchFrom);
      if (idx === -1) break;
      ddPositions.push(idx);
      searchFrom = idx + 2;
    }

    // Track open/close state to find the orphaned one
    const orphanIdx = ddPositions[ddPositions.length - 1];
    const beforeOrphan = converted.substring(0, orphanIdx);
    const afterOrphan = converted.substring(orphanIdx + 2);

    // Check if there's LaTeX content before this orphaned $$
    const hasLatexBefore = /\\[a-zA-Z]+/.test(beforeOrphan);

    if (hasLatexBefore) {
      const lines = beforeOrphan.split('\n');
      let mathStartLine = -1;
      let mathStartCol = -1;

      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (/\\[a-zA-Z]|[={}]/.test(line)) {
          const match = line.match(/^(.*?)([A-Za-z0-9]+=|\\[a-zA-Z])/);
          if (match) {
            mathStartLine = i;
            mathStartCol = match[1].length;
            break;
          }
        } else {
          break;
        }
      }

      if (mathStartLine >= 0) {
        const preLines = lines.slice(0, mathStartLine);
        const mathLine = lines[mathStartLine];
        const insertLine = mathLine.substring(0, mathStartCol) + '$$' + mathLine.substring(mathStartCol);
        const postLines = lines.slice(mathStartLine + 1);
        const newBefore = [...preLines, insertLine, ...postLines].join('\n');
        converted = newBefore + '$$' + afterOrphan;
      } else {
        converted = '$$' + beforeOrphan + '$$' + afterOrphan;
      }
    } else {
      converted = beforeOrphan + afterOrphan;
    }
  }

  // Pre-process: wrap lines with multiple LaTeX commands that lack $ delimiters
  const lines = converted.split('\n');
  converted = lines.map(line => {
    // Skip lines already containing $ delimiters
    if (/\$/.test(line)) return line;
    
    // Count LaTeX commands in this line
    const cmdMatches = line.match(/\\[a-zA-Z]+/g);
    if (!cmdMatches || cmdMatches.length < 2) return line;
    
    // Find the span from first \command to last } or LaTeX token
    const firstCmd = line.search(/\\[a-zA-Z]+/);
    const lastBrace = line.lastIndexOf('}');
    const end = lastBrace > firstCmd ? lastBrace + 1 : line.length;
    
    const before = line.substring(0, firstCmd);
    const math = line.substring(firstCmd, end);
    const after = line.substring(end);
    
    return `${before}$$${math}$$${after}`;
  }).join('\n');

  // Split text into math-mode and non-math-mode segments
  const parts = converted.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g);

  // Commands with two arguments
  const twoArgCmds = 'frac\\{[^}]*\\}\\{[^}]*\\}';

  // Commands with one argument
  const oneArgCmds = '(?:sqrt|text|vec|hat|bar|dot|ddot|tilde|overline|underline|mathbf|mathrm|mathit)\\{[^}]*\\}';

  // Simple commands (no arguments)
  const simpleCmds = [
    'rightarrow','leftarrow','leftrightarrow','Rightarrow','Leftarrow','Leftrightarrow',
    'uparrow','downarrow','updownarrow','mapsto','longmapsto',
    'alpha','beta','gamma','delta','epsilon','varepsilon','zeta','eta','theta','vartheta',
    'iota','kappa','lambda','mu','nu','xi','pi','rho','sigma','tau','upsilon',
    'phi','varphi','chi','psi','omega',
    'Gamma','Delta','Theta','Lambda','Xi','Pi','Sigma','Upsilon','Phi','Psi','Omega',
    'times','cdot','div','pm','mp','leq','geq','neq','approx','equiv','sim','simeq',
    'propto','infty','nabla','partial','forall','exists','neg',
    'cap','cup','subset','supset','subseteq','supseteq','in','notin','emptyset',
    'sum','prod','int','oint','bigcup','bigcap',
    'dots','cdots','ldots','vdots','ddots','quad','qquad',
    'leftrightharpoons','rightleftharpoons',
    'hbar','ell','circ','bullet','star','dagger','angle','perp','parallel',
    'therefore','because',
  ].join('|');

  const wrappingPattern = new RegExp(
    '(\\\\(?:' + twoArgCmds + '|' + oneArgCmds + '|' + simpleCmds + ')(?:[_^]\\{[^}]*\\}|[_^][^\\s${}])*)', 'g'
  );

  converted = parts.map((part, i) => {
    if (i % 2 === 1) return part;
    let processed = part.replace(wrappingPattern, ' $$$1$$ ');
    return processed;
  }).join('');

  // Move subscripts/superscripts that appear after closing $ into math mode
  let prev = '';
  while (prev !== converted) {
    prev = converted;
    converted = converted.replace(/\$\s+([_^])(\{[^}]*\}|[^\s$]+)/g, (match, operator, content) => {
      return `${operator}{${content}}$`;
    });
  }

  // Merge adjacent math blocks: "$...$  $...$" → "$... ...$"
  converted = converted.replace(/(?<!\$)\$\s+\$(?!\$)/g, ' ');

  // Ensure display math $$ delimiters are on their own lines for remark-math
  converted = converted.replace(/([^\n])\$\$/g, '$1\n$$');
  converted = converted.replace(/\$\$([^\n])/g, '$$\n$1');

  // Escape square brackets inside $$ display math to prevent markdown link parsing
  converted = converted.replace(/\$\$\n([\s\S]*?)\n\$\$/g, (match, inner) => {
    const escaped = inner.replace(/\[/g, '\\lbrack ').replace(/\]/g, '\\rbrack ');
    return '$$\n' + escaped + '\n$$';
  });

  // Escape square brackets inside $ inline math to prevent markdown link parsing,
  // but preserve brackets that are LaTeX optional arguments (e.g. \xrightarrow[...]{...}, \sqrt[n]{x})
  converted = converted.replace(/(?<!\$)\$((?:[^$]|\\\$)+?)\$(?!\$)/g, (match, inner) => {
    if (!/\[/.test(inner)) return match;
    // Replace only brackets that are NOT preceded by a LaTeX command (i.e., not optional args)
    const escaped = inner.replace(/(?<!\\[a-zA-Z]+)\[(?![^\]]*\]\{)/g, '\\lbrack ')
                         .replace(/(?<!\\[a-zA-Z]+\[[^\]]*)\](?!\{)/g, '\\rbrack ');
    return '$' + escaped + '$';
  });
  
  return converted;
};
