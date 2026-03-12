const STEPS = [
  { number: 1, label: 'Job Details' },
  { number: 2, label: 'Choose Interviewer' },
  { number: 3, label: 'Interview' },
  { number: 4, label: 'Report' },
];

function Stepper({ currentStep }) {
  return (
    <div className="stepper">
      {STEPS.map((step, i) => (
        <div key={step.number} className="stepper-item">
          <div
            className={`stepper-circle ${
              step.number < currentStep
                ? 'completed'
                : step.number === currentStep
                ? 'active'
                : ''
            }`}
          >
            {step.number < currentStep ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              step.number
            )}
          </div>
          <span
            className={`stepper-label ${
              step.number <= currentStep ? 'active-label' : ''
            }`}
          >
            {step.label}
          </span>
          {i < STEPS.length - 1 && <div className={`stepper-line ${step.number < currentStep ? 'completed' : ''}`} />}
        </div>
      ))}
    </div>
  );
}

export default Stepper;
