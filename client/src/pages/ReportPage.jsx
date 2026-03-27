import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';
import { generateReport } from '../utils/pdfReport';
import Navbar from '../components/Navbar';
import Stepper from '../components/Stepper';

// Renders inline markdown: **bold**, *italic*, `code`
function renderInlineMarkdown(text) {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    const codeMatch = remaining.match(/`(.+?)`/);

    const matches = [
      boldMatch && { type: 'bold', match: boldMatch },
      italicMatch && { type: 'italic', match: italicMatch },
      codeMatch && { type: 'code', match: codeMatch },
    ].filter(Boolean);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const earliest = matches.reduce((a, b) =>
      a.match.index < b.match.index ? a : b
    );

    const { type, match } = earliest;

    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index));
    }

    if (type === 'bold') {
      parts.push(<strong key={key++}>{match[1]}</strong>);
    } else if (type === 'italic') {
      parts.push(<em key={key++}>{match[1]}</em>);
    } else if (type === 'code') {
      parts.push(<code key={key++} className="inline-code">{match[1]}</code>);
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  return parts;
}

function renderMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(<ul key={key++}>{listItems}</ul>);
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^\d+[\.\)]\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+[\.\)]\s/, '');
      listItems.push(<li key={key++}>{renderInlineMarkdown(content)}</li>);
    } else if (/^[-*]\s/.test(trimmed)) {
      const content = trimmed.replace(/^[-*]\s/, '');
      listItems.push(<li key={key++}>{renderInlineMarkdown(content)}</li>);
    } else if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={key++}>{trimmed.slice(4)}</h4>);
    } else if (/^\d+\/10/.test(trimmed) || /score:\s*\d+/i.test(trimmed)) {
      flushList();
      elements.push(
        <p key={key++} className="score-line">{renderInlineMarkdown(trimmed)}</p>
      );
    } else {
      flushList();
      elements.push(<p key={key++}>{renderInlineMarkdown(trimmed)}</p>);
    }
  }

  flushList();
  return elements;
}

function ReportPage() {
  const { user, loading } = useAuth();
  const { conversation, evaluation, jobTitle, isInterviewComplete, reset } = useInterview();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isInterviewComplete)) {
      navigate('/');
    }
  }, [user, loading, isInterviewComplete, navigate]);

  if (loading || !user || !isInterviewComplete) return null;

  const handleDownload = () => {
    generateReport(user.name, jobTitle, conversation, evaluation);
  };

  const handleNewInterview = () => {
    reset();
    navigate('/setup');
  };

  const sections = evaluation
    .split(/^## /m)
    .filter(Boolean)
    .map((section) => {
      const [title, ...content] = section.split('\n');
      return { title: title.trim(), content: content.join('\n').trim() };
    });

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="page-content">
        <Stepper currentStep={4} />

        <div className="card report-card">
          <div className="report-header">
            <h2>Interview Complete</h2>
            <p>
              Great job, {user.name}! Here is your evaluation for the{' '}
              <strong>{jobTitle}</strong> position.
            </p>
          </div>

          <div className="evaluation">
            {sections.map((section, i) => (
              <div key={i} className="eval-section">
                <h3>{section.title}</h3>
                <div className="eval-content">
                  {renderMarkdown(section.content)}
                </div>
              </div>
            ))}
          </div>

          <div className="report-actions">
            <button className="btn primary" onClick={handleDownload}>
              Download PDF Report
            </button>
            <button className="btn secondary" onClick={handleNewInterview}>
              Start New Interview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportPage;
