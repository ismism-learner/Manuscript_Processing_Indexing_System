import React from 'react';

interface ReportDisplayProps {
  reportContent: string;
}

// Simple Markdown to HTML renderer
const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const htmlLines = lines.map((line, index) => {
        if (line.startsWith('## ')) {
            return `<h2 class="text-xl font-bold text-cyan-300 mt-4 mb-2 border-b border-gray-700 pb-1">${line.substring(3)}</h2>`;
        }
        if (line.startsWith('### ')) {
            return `<h3 class="text-lg font-semibold text-gray-300 mt-3 mb-1">${line.substring(4)}</h3>`;
        }
        if (line.startsWith('# ')) {
            return `<h1 class="text-2xl font-bold text-cyan-400 mb-3">${line.substring(2)}</h1>`;
        }
        if (line.startsWith('* ')) {
            return `<li class="ml-5 list-disc">${line.substring(2)}</li>`;
        }
        // Bold text with **text**
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-200">$1</strong>');
        return `<p class="text-gray-300 mb-2 leading-relaxed">${line}</p>`;
    });

    // Wrap list items in <ul>
    let inList = false;
    const groupedHtml = htmlLines.reduce((acc, line) => {
        const isListItem = line.startsWith('<li');
        if (isListItem && !inList) {
            acc.push('<ul>');
            inList = true;
        }
        if (!isListItem && inList) {
            acc.push('</ul>');
            inList = false;
        }
        acc.push(line);
        return acc;
    }, [] as string[]);

    if (inList) {
        groupedHtml.push('</ul>');
    }

    return groupedHtml.join('');
};

const ReportDisplay: React.FC<ReportDisplayProps> = ({ reportContent }) => {
  const renderedHtml = renderMarkdown(reportContent);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-5 prose prose-invert max-w-none">
      <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    </div>
  );
};

export default ReportDisplay;
