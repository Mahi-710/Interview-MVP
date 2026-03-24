import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';
import { parseResumePDF } from '../utils/api';
import Navbar from '../components/Navbar';
import Stepper from '../components/Stepper';

function SetupPage() {
  const { user } = useAuth();
  const { setResumeText, setJobDescription, setJobTitle, resumeText, jobDescription, jobTitle, focusArea, setFocusArea } = useInterview();
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
    <div className="page-wrapper">
      <Navbar />
      <div className="page-content">
        <Stepper currentStep={1} />

        <div className="card setup-card">
          <h2>Set Up Your Interview</h2>
          <p className="subtitle">Welcome, <strong>{user.name}</strong>! Fill in the details below to get a tailored mock interview.</p>

          <div className="form-group">
            <label>Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior ML Engineer, Frontend Developer, Product Manager"
            />
          </div>

          <div className="form-group">
            <label>Resume <span className="label-hint">(used to personalise your interview)</span></label>
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
                    <>
                      <div className="upload-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <span className="upload-text">Parsing resume (OCR may take a moment)...</span>
                    </>
                  ) : fileName && resumeText ? (
                    <>
                      <div className="upload-icon success">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <span className="upload-text">{fileName}</span>
                      <span className="upload-hint">{resumeText.length} characters extracted</span>
                    </>
                  ) : (
                    <>
                      <div className="upload-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <span className="upload-text">Click to upload your resume PDF</span>
                      {/* <span className="upload-hint">  Supports text-based and scanned PDFs (OCR)</span> */}
                    </>
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
            <label>Job Description <span className="label-hint">(paste the full JD for best results)</span></label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here...

The AI will tailor interview questions to match the role's requirements."
              rows={6}
            />
            <div className="char-count">{jobDescription.length} characters</div>
          </div>

          <div className="form-group">
            <label>Interview Focus</label>
            <p className="label-hint-block">What should the interviewer concentrate on?</p>
            <div className="focus-area-grid">
              {[
                { key: 'full_screening', icon: '🎯', label: 'Full Screening', desc: 'Cover everything' },
                { key: 'experience', icon: '💼', label: 'Experience & Projects', desc: 'Deep-dive into your work history' },
                { key: 'technical', icon: '⚙️', label: 'Technical Skills', desc: 'Test your tech stack & problem-solving' },
                { key: 'behavioral', icon: '🤝', label: 'Behavioral / Soft Skills', desc: 'Leadership, teamwork, communication' },
                { key: 'role_fit', icon: '📋', label: 'Role Fit', desc: 'Match against this specific JD' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`focus-card ${focusArea === opt.key ? 'selected' : ''}`}
                  onClick={() => setFocusArea(opt.key)}
                >
                  <span className="focus-card-icon">{opt.icon}</span>
                  <span className="focus-card-label">{opt.label}</span>
                  <span className="focus-card-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setup-footer">
            {!canStart && <p className="hint">Fill in all three fields above to continue</p>}
            <button
              className="btn primary"
              disabled={!canStart}
              onClick={() => navigate('/preferences')}
            >
              Choose Interviewer →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetupPage;
