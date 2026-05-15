import { createContext, useContext, useState } from 'react';

const InterviewContext = createContext(null);

export function InterviewProvider({ children }) {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [conversation, setConversation] = useState([]);
  const [evaluation, setEvaluation] = useState('');
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [voiceId, setVoiceId] = useState(null);
  const [interviewerName, setInterviewerName] = useState('Alex');
  const [focusArea, setFocusArea] = useState('full_screening');
  // Token-based (recruited) mode
  const [sessionToken, setSessionToken] = useState(null);
  const [candidateName, setCandidateName] = useState('');

  const addMessage = (role, text) => {
    setConversation((prev) => [...prev, { role, text }]);
  };

  const reset = () => {
    setResumeText('');
    setJobDescription('');
    setJobTitle('');
    setConversation([]);
    setEvaluation('');
    setIsInterviewComplete(false);
    setVoiceId(null);
    setInterviewerName('Alex');
    setFocusArea('full_screening');
    setSessionToken(null);
    setCandidateName('');
  };

  return (
    <InterviewContext.Provider
      value={{
        resumeText, setResumeText,
        jobDescription, setJobDescription,
        jobTitle, setJobTitle,
        conversation, setConversation, addMessage,
        evaluation, setEvaluation,
        isInterviewComplete, setIsInterviewComplete,
        voiceId, setVoiceId,
        interviewerName, setInterviewerName,
        focusArea, setFocusArea,
        sessionToken, setSessionToken,
        candidateName, setCandidateName,
        reset,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
}

export const useInterview = () => useContext(InterviewContext);
