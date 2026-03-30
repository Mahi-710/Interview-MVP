
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';
import { parseResumePDF } from '../utils/api';
import Navbar from '../components/Navbar';
import Stepper from '../components/Stepper';
import mammoth from 'mammoth';

/* ─── constants ─────────────────────────────────────────────────────────── */
const MAX_PDF_BYTES  = 1 * 1024 * 1024;
const MAX_DOCX_BYTES = 1 * 1024 * 1024;
const JD_MIN = 200;
const JD_MAX = 500;

/* ─── helpers ────────────────────────────────────────────────────────────── */
function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
function isTextOnly(value) {
  return !/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/.test(value);
}
function isPDF(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
function isDOCX(file) {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  );
}

/* ─── DOCX parser (client-side via mammoth) ─────────────────────────────── */
async function parseDOCX(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/* ─── tiny sub-components ────────────────────────────────────────────────── */
function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="field-error">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
        <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.8" fill="currentColor" />
      </svg>
      {message}
    </p>
  );
}

function FieldSuccess({ message }) {
  if (!message) return null;
  return (
    <p className="field-success">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
        <polyline points="5,8.5 7.2,10.5 11,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message}
    </p>
  );
}

/* ─── validators ─────────────────────────────────────────────────────────── */
const validateJobTitle = (v) => {
  if (!v.trim()) return 'Job title is required.';
  if (!isTextOnly(v)) return 'Job title must contain text only — no special characters.';
  if (v.trim().length < 2) return 'Job title must be at least 2 characters.';
  if (v.trim().length > 120) return 'Job title must be 120 characters or fewer.';
  return '';
};

const validateJobDescription = (v) => {
  if (!v.trim()) return 'Job description is required.';
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(v))
    return 'Job description contains invalid or unsupported characters.';
  const w = wordCount(v);
  if (w < JD_MIN) return `Too short — need at least ${JD_MIN} words (${JD_MIN - w} more).`;
  if (w > JD_MAX) return `Too long — trim to ${JD_MAX} words (${w - JD_MAX} over).`;
  return '';
};

const validateResumeText = (v) => {
  if (!v.trim()) return 'Resume is required. Please upload a PDF / Word doc or paste your text.';
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(v))
    return 'Resume contains invalid or unsupported characters.';
  return '';
};

/* ─── shared file-upload handler factory ───────────────────────────────── */
// Returns { text, error }
async function extractTextFromFile(file) {
  if (isPDF(file)) {
    if (file.size > MAX_PDF_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      return { text: '', error: `File is too large (${mb} MB) — maximum allowed is 1 MB.` };
    }
    try {
      const text = await parseResumePDF(file);
      return { text, error: '' };
    } catch {
      return { text: '', error: 'Could not parse this PDF. Try pasting instead.' };
    }
  } else if (isDOCX(file)) {
    if (file.size > MAX_DOCX_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      return { text: '', error: `File is too large (${mb} MB) — maximum allowed is 1 MB.` };
    }
    try {
      const text = await parseDOCX(file);
      if (!text.trim()) return { text: '', error: 'Word document appears to be empty or unreadable.' };
      return { text, error: '' };
    } catch {
      return { text: '', error: 'Could not parse this Word document. Try pasting instead.' };
    }
  } else {
    return { text: '', error: 'Only PDF or Word (.docx) files are accepted.' };
  }
}

/* ─── UploadBox sub-component ───────────────────────────────────────────── */
function UploadBox({ id, uploading, uploadState, fileName, charCount, error, onChange, accept, label, sub }) {
  return (
    <div className={`upload-area upload-area--${uploadState}`}>
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        disabled={uploading}
        id={id}
      />
      <label htmlFor={id} className="upload-label">
        <div className={`upload-icon-wrap upload-icon-wrap--${uploadState}`}>
          {uploading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          ) : uploadState === 'success' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : uploadState === 'error' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="13" />
              <circle cx="12" cy="16.5" r="0.8" fill="currentColor" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          )}
        </div>
        <div className="upload-body">
          {uploading ? (
            <>
              <span className="upload-title">Parsing document…</span>
              <span className="upload-sub">This may take a moment</span>
            </>
          ) : uploadState === 'success' ? (
            <>
              <span className="upload-title">{fileName}</span>
              <span className="upload-sub">{charCount?.toLocaleString()} characters extracted</span>
            </>
          ) : uploadState === 'error' ? (
            <>
              <span className="upload-title upload-title--error">{fileName || 'Upload failed'}</span>
              <span className="upload-sub upload-sub--error">{error}</span>
            </>
          ) : (
            <>
              <span className="upload-title">{label}</span>
              <span className="upload-sub">{sub}</span>
            </>
          )}
        </div>
      </label>
    </div>
  );
}

/* ─── component ──────────────────────────────────────────────────────────── */
function SetupPage() {
  const { user, loading } = useAuth() || {};
const {
  setResumeText, setJobDescription, setJobTitle,
  resumeText, jobDescription, jobTitle, focusArea, setFocusArea,
} = useInterview() || {};
  const navigate = useNavigate();

  // ✅ AUTH REDIRECT
  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // ✅ block render until auth ready
  if (loading || !user) return null;

  /* resume state */
  const [resumeInputMode, setResumeInputMode]   = useState('upload');
  const [resumeUploading, setResumeUploading]   = useState(false);
  const [resumeFileName, setResumeFileName]     = useState('');

  /* JD state */
  const [jdInputMode, setJdInputMode]   = useState('paste');
  const [jdUploading, setJdUploading]   = useState(false);
  const [jdFileName, setJdFileName]     = useState('');

  /* touched / errors */
  const [touched, setTouched] = useState({ jobTitle: false, jobDescription: false, resume: false });
  const [errors,  setErrors]  = useState({ jobTitle: '', jobDescription: '', resume: '' });

  if (!user) { navigate('/'); return null; }

  const touch = (field) => setTouched((p) => ({ ...p, [field]: true }));

  /* ── Resume upload ── */
  const handleResumeFileUpload = async (e) => {
    const file = e.target.files[0];
    touch('resume');
    if (!file) return;
    setResumeUploading(true);
    setResumeFileName('');      // don't show name until we know it's valid
    setResumeText('');
    setErrors((p) => ({ ...p, resume: '' }));
    const { text, error } = await extractTextFromFile(file);
    if (error) {
      setErrors((p) => ({ ...p, resume: error }));
      setResumeFileName('');    // ensure no stale name is shown
      setResumeText('');
      setResumeUploading(false);
      e.target.value = '';
      return;
    }
    setResumeFileName(file.name); // only set name on success
    setResumeText(text);
    setResumeUploading(false);
  };

  /* ── JD upload ── */
  const handleJDFileUpload = async (e) => {
    const file = e.target.files[0];
    touch('jobDescription');
    if (!file) return;
    setJdUploading(true);
    setJdFileName('');          // don't show name until we know it's valid
    setJobDescription('');
    setErrors((p) => ({ ...p, jobDescription: '' }));
    const { text, error } = await extractTextFromFile(file);
    if (error) {
      setErrors((p) => ({ ...p, jobDescription: error }));
      setJdFileName('');        // ensure no stale name is shown
      setJobDescription('');
      setJdInputMode('paste');
      setJdUploading(false);
      e.target.value = '';
      return;
    }
    setJdFileName(file.name);   // only set name on success
    setJobDescription(text);
    // Validate word count immediately after extraction
    const wordErr = validateJobDescription(text);
    if (wordErr) {
      setErrors((p) => ({ ...p, jobDescription: wordErr }));
    }
    setJdUploading(false);
  };

  /* ── text handlers ── */
  const handleJobTitleChange = (e) => {
    const v = e.target.value;
    setJobTitle(v);
    setErrors((p) => ({ ...p, jobTitle: validateJobTitle(v) }));
  };

  const handleJobDescriptionChange = (e) => {
    const v = e.target.value;
    setJobDescription(v);
    setErrors((p) => ({ ...p, jobDescription: validateJobDescription(v) }));
  };

  const handleResumeTextChange = (e) => {
    const v = e.target.value;
    setResumeText(v);
    setErrors((p) => ({ ...p, resume: validateResumeText(v) }));
  };

  /* ── derived state ── */
  const jdWords  = wordCount(jobDescription);
  const barPct   = Math.min((jdWords / JD_MAX) * 100, 100);
  const barColor =
    jdWords === 0     ? 'var(--color-border-secondary, #ccc)' :
    jdWords < JD_MIN  ? '#E67E22' :
    jdWords > JD_MAX  ? '#C0392B' : '#27AE60';
  const wcColor =
    jdWords === 0     ? 'var(--color-text-tertiary)' :
    jdWords < JD_MIN  ? '#E67E22' :
    jdWords > JD_MAX  ? '#C0392B' : '#27AE60';
  const wcLabel =
    jdWords === 0     ? `0 words — ${JD_MIN} minimum` :
    jdWords < JD_MIN  ? `${jdWords} words — ${JD_MIN - jdWords} more needed` :
    jdWords > JD_MAX  ? `${jdWords} words — ${jdWords - JD_MAX} over limit` :
    `${jdWords} words`;

  const resumeUploadState =
    errors.resume ? 'error' :
    (resumeFileName && resumeText) ? 'success' : 'idle';

  const jdWordCountErr = jdFileName && jobDescription ? validateJobDescription(jobDescription) : '';
  const jdUploadState =
    (errors.jobDescription || jdWordCountErr) ? 'error' :
    (jdFileName && jobDescription) ? 'success' : 'idle';

  /* ── success messages ── */
  // Resume: show after upload OR paste
  const resumeExtracted = !validateResumeText(resumeText) && resumeText.trim().length > 0;
  const resumeSuccessMsg = resumeInputMode === 'upload' && resumeExtracted
    ? `Resume extracted successfully · ${resumeText.length.toLocaleString()} characters`
    : resumeInputMode === 'paste' && resumeExtracted
    ? 'Resume text added successfully'
    : '';

  // JD: show after upload OR paste (only if word count is valid)
  const jdExtracted = !validateJobDescription(jobDescription) && jobDescription.trim().length > 0;
  const jdSuccessMsg = jdInputMode === 'upload' && jdExtracted
    ? `Job description extracted successfully · ${jobDescription.length.toLocaleString()} characters`
    : jdInputMode === 'paste' && jdExtracted
    ? 'Word count is within range'
    : '';

  /* ── overall gate ── */
  const canStart =
    !validateJobTitle(jobTitle) &&
    !validateJobDescription(jobDescription) &&
    !validateResumeText(resumeText) &&
    resumeText.trim().length > 0;

  const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="page-content">
        <Stepper currentStep={1} />

        <div className="card setup-card">
          <h2>Set Up Your Interview</h2>
          <p className="subtitle">
            Welcome, <strong>{user.name}</strong>! Fill in the details below to get a tailored mock interview.
          </p>

          {/* ── Job Title ── */}
          <div className="form-group">
            <label>Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={handleJobTitleChange}
              onBlur={() => touch('jobTitle')}
              placeholder="e.g. Senior ML Engineer, Frontend Developer, Product Manager"
              className={
                touched.jobTitle
                  ? errors.jobTitle ? 'input-error' : jobTitle.trim() ? 'input-ok' : ''
                  : ''
              }
            />
            {touched.jobTitle && errors.jobTitle
              ? <FieldError message={errors.jobTitle} />
              : touched.jobTitle && jobTitle.trim()
              ? <FieldSuccess message="Looks good" />
              : null}
          </div>

          {/* ── Resume ── */}
          <div className="form-group">
            <label>
              Resume <span className="label-hint">(mandatory to personalise your interview)</span>
            </label>
            <div className="toggle-group">
              <button
                className={resumeInputMode === 'upload' ? 'active' : ''}
                onClick={() => {
                  setResumeInputMode('upload');
                  setErrors((p) => ({ ...p, resume: '' }));
                  // Only wipe if there's no valid content (e.g. came from a failed upload)
                  if (!resumeText.trim()) {
                    setResumeFileName('');
                    setResumeText('');
                  }
                }}
              >
                Upload File
              </button>
              <button
                className={resumeInputMode === 'paste' ? 'active' : ''}
                onClick={() => {
                  setResumeInputMode('paste');
                  setErrors((p) => ({ ...p, resume: '' }));
                  // Only wipe if there's no valid content
                  if (!resumeText.trim()) {
                    setResumeFileName('');
                    setResumeText('');
                  }
                }}
              >
                Paste Text
              </button>
            </div>

            {resumeInputMode === 'upload' ? (
              <>
                <UploadBox
                  id="resume-upload"
                  uploading={resumeUploading}
                  uploadState={resumeUploadState}
                  fileName={resumeFileName}
                  charCount={resumeText.length}
                  error={errors.resume}
                  onChange={handleResumeFileUpload}
                  accept={ACCEPT}
                  label="Click to upload your resume"
                  sub="PDF or Word (.docx) · PDF max 1 MB · DOCX max 1 MB"
                />
                {/* Success shown below upload box */}
                {resumeUploadState === 'error'
                  ? <FieldError message={errors.resume} />
                  : resumeSuccessMsg
                  ? <FieldSuccess message={resumeSuccessMsg} />
                  : null}
              </>
            ) : (
              <>
                <textarea
                  value={resumeText}
                  onChange={handleResumeTextChange}
                  onBlur={() => touch('resume')}
                  placeholder="Paste your resume text here..."
                  rows={8}
                  className={
                    touched.resume
                      ? validateResumeText(resumeText) ? 'input-error' : resumeText.trim() ? 'input-ok' : ''
                      : ''
                  }
                />
                {touched.resume && validateResumeText(resumeText)
                  ? <FieldError message={validateResumeText(resumeText)} />
                  : resumeSuccessMsg
                  ? <FieldSuccess message={resumeSuccessMsg} />
                  : null}
              </>
            )}
          </div>

          {/* ── Job Description ── */}
          <div className="form-group">
            <label>
              Job Description <span className="label-hint">(paste the full JD for best results)</span>
            </label>
            <div className="toggle-group">
              <button
                className={jdInputMode === 'upload' ? 'active' : ''}
                onClick={() => {
                  setJdInputMode('upload');
                  setErrors((p) => ({ ...p, jobDescription: '' }));
                  if (!jobDescription.trim()) {
                    setJdFileName('');
                    setJobDescription('');
                  }
                }}
              >
                Upload File
              </button>
              <button
                className={jdInputMode === 'paste' ? 'active' : ''}
                onClick={() => {
                  setJdInputMode('paste');
                  setErrors((p) => ({ ...p, jobDescription: '' }));
                  if (!jobDescription.trim()) {
                    setJdFileName('');
                    setJobDescription('');
                  }
                }}
              >
                Paste Text
              </button>
            </div>

            {jdInputMode === 'upload' ? (
              <>
                <UploadBox
                  id="jd-upload"
                  uploading={jdUploading}
                  uploadState={jdUploadState}
                  fileName={jdFileName}
                  charCount={jobDescription.length}
                  error={errors.jobDescription}
                  onChange={handleJDFileUpload}
                  accept={ACCEPT}
                  label="Click to upload job description"
                  sub="PDF or Word (.docx) · PDF max 1 MB · DOCX max 1 MB"
                />
                {jdFileName && jobDescription && !jdUploading && (
                  <div className="jd-progress">
                    <div className="jd-bar-track">
                      <div className="jd-bar-fill" style={{ width: `${barPct}%`, background: barColor }} />
                    </div>
                    <div className="jd-meta">
                      <span style={{ color: wcColor, fontWeight: 500, fontSize: '12px' }}>{wcLabel}</span>
                      <span className="jd-meta-right">max {JD_MAX}</span>
                    </div>
                  </div>
                )}
                {jdUploadState === 'error'
                  ? <FieldError message={errors.jobDescription || jdWordCountErr} />
                  : jdSuccessMsg
                  ? <FieldSuccess message={jdSuccessMsg} />
                  : null}
              </>
            ) : (
              <>
                <textarea
                  value={jobDescription}
                  onChange={handleJobDescriptionChange}
                  onBlur={() => touch('jobDescription')}
                  placeholder="Paste the job description here…"
                  rows={6}
                  className={
                    touched.jobDescription
                      ? errors.jobDescription ? 'input-error' : jobDescription.trim() ? 'input-ok' : ''
                      : ''
                  }
                />
                <div className="jd-progress">
                  <div className="jd-bar-track">
                    <div className="jd-bar-fill" style={{ width: `${barPct}%`, background: barColor }} />
                  </div>
                  <div className="jd-meta">
                    <span style={{ color: wcColor, fontWeight: 500, fontSize: '12px' }}>{wcLabel}</span>
                    <span className="jd-meta-right">max {JD_MAX}</span>
                  </div>
                </div>
                {touched.jobDescription && errors.jobDescription
                  ? <FieldError message={errors.jobDescription} />
                  : jdSuccessMsg
                  ? <FieldSuccess message={jdSuccessMsg} />
                  : null}
              </>
            )}
          </div>

          {/* ── Interview Focus ── */}
          <div className="form-group">
            <label>Interview Focus</label>
            <p className="label-hint-block">What should the interviewer concentrate on?</p>
            <div className="focus-area-grid">
              {[
                { key: 'full_screening', icon: '🎯', label: 'Full Screening',           desc: 'Cover everything' },
                { key: 'experience',     icon: '💼', label: 'Experience & Projects',    desc: 'Deep-dive into your work history' },
                { key: 'technical',      icon: '⚙️', label: 'Technical Skills',         desc: 'Test your tech stack & problem-solving' },
                { key: 'behavioral',     icon: '🤝', label: 'Behavioral / Soft Skills', desc: 'Leadership, teamwork, communication' },
                { key: 'role_fit',       icon: '📋', label: 'Role Fit',                 desc: 'Match against this specific JD' },
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
            {!canStart && (
              <p className="hint">Complete all fields correctly (Job Title, Resume, and JD) to continue</p>
            )}
            <button
              className="btn primary"
              disabled={!canStart}
              onClick={() => {
                localStorage.removeItem('setupData');
                navigate('/preferences');
              }}
            >
              Choose Interviewer →
            </button>
          </div>
        </div>
      </div>

      {/* ── validation styles ── */}
      <style>{`
        .input-error {
          border-color: #C0392B !important;
          background: rgba(192, 57, 43, 0.03) !important;
        }
        .input-error:focus {
          box-shadow: 0 0 0 3px rgba(192, 57, 43, 0.12) !important;
          outline: none;
        }
        .input-ok {
          border-color: #27AE60 !important;
        }
        .input-ok:focus {
          box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.12) !important;
          outline: none;
        }
        .field-error {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          margin-top: 6px;
          font-size: 12.5px;
          line-height: 1.45;
          color: #C0392B;
        }
        .field-error svg { flex-shrink: 0; margin-top: 1px; }
        .field-success {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          font-size: 12.5px;
          color: #27AE60;
        }
        .field-success svg { flex-shrink: 0; }
        .upload-area {
          position: relative;
          border-radius: 8px;
          transition: border-color 0.15s, background 0.15s;
        }
        .upload-area--error .upload-label {
          border-color: #C0392B !important;
          background: rgba(192, 57, 43, 0.03) !important;
        }
        .upload-area--success .upload-label {
          border-color: #27AE60 !important;
        }
        .upload-area .upload-label {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          text-align: center !important;
          cursor: pointer;
          width: 100%;
          padding: 28px 16px;
        }
        .upload-icon-wrap {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .upload-icon-wrap--idle    { background: rgba(0,0,0,0.05); color: inherit; }
        .upload-icon-wrap--success { background: rgba(39,174,96,0.12); color: #27AE60; }
        .upload-icon-wrap--error   { background: rgba(192,57,43,0.10); color: #C0392B; }
        .upload-body { display: flex; flex-direction: column; gap: 2px; align-items: center; }
        .upload-title { font-size: 13.5px; font-weight: 500; }
        .upload-title--error { color: #C0392B; }
        .upload-sub { font-size: 12px; opacity: 0.65; }
        .upload-sub--error { color: #C0392B; opacity: 1; }
        .jd-progress { margin-top: 8px; }
        .jd-bar-track {
          height: 3px;
          border-radius: 99px;
          background: rgba(0,0,0,0.08);
          overflow: hidden;
          margin-bottom: 5px;
        }
        .jd-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.2s ease, background 0.2s ease;
        }
        .jd-meta { display: flex; justify-content: space-between; align-items: center; }
        .jd-meta-right { font-size: 12px; opacity: 0.45; }
      `}</style>
    </div>
  );
}

export default SetupPage;