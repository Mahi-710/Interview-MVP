import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';
import { parseResumePDF } from '../utils/api';

function SetupPage() {
  const { user } = useAuth();
  const { setResumeText, setJobDescription, setJobTitle, resumeText, jobDescription, jobTitle } = useInterview();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [inputMode, setInputMode] = useState('upload');
  const [fileName, setFileName] = useState('');

  if (!user) {
    navigate('/');
    return null;
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setFileName(file.name);
    try {
      const text = await parseResumePDF(file);
      setResumeText(text);
    } catch (err) {
      alert('Failed to parse PDF: ' + err.message + '\nTry pasting your resume text instead.');
      setInputMode('paste');
    }
    setUploading(false);
  };

  const canStart = resumeText.trim() && jobDescription.trim() && jobTitle.trim();

  return (
    <div className="page setup-page">
      <div className="card setup-card">
        <h2>Setup Your Interview</h2>
        <p className="subtitle">Welcome, {user.name}. Fill in the details below to start your practice interview.</p>

        <div className="form-group">
          <label>Job Title</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Senior ML Engineer, Frontend Developer"
          />
        </div>

        <div className="form-group">
          <label>Resume</label>
          <div className="toggle-group">
            <button
              className={inputMode === 'upload' ? 'active' : ''}
              onClick={() => setInputMode('upload')}
            >
              Upload PDF
            </button>
            <button
              className={inputMode === 'paste' ? 'active' : ''}
              onClick={() => setInputMode('paste')}
            >
              Paste Text
            </button>
          </div>

          {inputMode === 'upload' ? (
            <div className="upload-area">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                id="resume-upload"
              />
              <label htmlFor="resume-upload" className="upload-label">
                {uploading ? (
                  <span>Parsing resume (OCR may take a moment)...</span>
                ) : fileName && resumeText ? (
                  <span>{fileName} — {resumeText.length} characters extracted</span>
                ) : (
                  <span>Click to upload PDF resume</span>
                )}
              </label>
            </div>
          ) : (
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here..."
              rows={8}
            />
          )}
        </div>

        <div className="form-group">
          <label>Job Description</label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            rows={6}
          />
        </div>

        <button
          className="btn primary"
          disabled={!canStart}
          onClick={() => navigate('/preferences')}
        >
          Choose Interviewer
        </button>
      </div>
    </div>
  );
}

export default SetupPage;
