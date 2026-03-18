// import { createContext, useContext, useState } from 'react';

// const InterviewContext = createContext(null);

// export function InterviewProvider({ children }) {
//   const [resumeText, setResumeText] = useState('');
//   const [jobDescription, setJobDescription] = useState('');
//   const [jobTitle, setJobTitle] = useState('');
//   const [conversation, setConversation] = useState([]);
//   const [evaluation, setEvaluation] = useState('');
//   const [isInterviewComplete, setIsInterviewComplete] = useState(false);
//   const [voiceId, setVoiceId] = useState(null);
//   const [interviewerName, setInterviewerName] = useState('Alex');

//   const addMessage = (role, text) => {
//     setConversation((prev) => [...prev, { role, text }]);
//   };

//   const reset = () => {
//     setResumeText('');
//     setJobDescription('');
//     setJobTitle('');
//     setConversation([]);
//     setEvaluation('');
//     setIsInterviewComplete(false);
//     setVoiceId(null);
//     setInterviewerName('Alex');
//   };

//   return (
//     <InterviewContext.Provider
//       value={{
//         resumeText, setResumeText,
//         jobDescription, setJobDescription,
//         jobTitle, setJobTitle,
//         conversation, setConversation, addMessage,
//         evaluation, setEvaluation,
//         isInterviewComplete, setIsInterviewComplete,
//         voiceId, setVoiceId,
//         interviewerName, setInterviewerName,
//         reset,
//       }}
//     >
//       {children}
//     </InterviewContext.Provider>
//   );
// }

// export const useInterview = () => useContext(InterviewContext);


import { createContext, useContext, useState, useEffect } from 'react';

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

  // ✅ 1. Load state on refresh (HYDRATION)
  useEffect(() => {
    const stored = localStorage.getItem('interviewState');
    if (stored) {
      const data = JSON.parse(stored);

      setResumeText(data.resumeText || '');
      setJobDescription(data.jobDescription || '');
      setJobTitle(data.jobTitle || '');
      setConversation(data.conversation || []);
      setEvaluation(data.evaluation || '');
      setIsInterviewComplete(data.isInterviewComplete || false);
      setVoiceId(data.voiceId || null);
      setInterviewerName(data.interviewerName || 'Alex');
    }
  }, []);

  // ✅ 2. Save state whenever it changes (PERSISTENCE)
  useEffect(() => {
    localStorage.setItem(
      'interviewState',
      JSON.stringify({
        resumeText,
        jobDescription,
        jobTitle,
        conversation,
        evaluation,
        isInterviewComplete,
        voiceId,
        interviewerName,
      })
    );
  }, [
    resumeText,
    jobDescription,
    jobTitle,
    conversation,
    evaluation,
    isInterviewComplete,
    voiceId,
    interviewerName,
  ]);

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

    // ✅ Clear storage also
    localStorage.removeItem('interviewState');
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
        reset,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
}

export const useInterview = () => useContext(InterviewContext);