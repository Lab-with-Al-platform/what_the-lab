type SignupStepsProps = {
  steps: string[];
  current: number; // 지금 단계 번호 (1부터 시작)
};

export function SignupSteps({ steps, current }: SignupStepsProps) {
  return (
    <ol className="flex items-center justify-center gap-2 text-[13px]">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isDone = stepNumber < current; // 이미 끝난 단계
        const isActive = stepNumber === current; // 지금 단계

        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`grid h-[22px] w-[22px] place-items-center rounded-full text-xs font-semibold ${
                isDone ? "bg-success-soft text-success" : isActive ? "bg-brand text-white" : "bg-line text-faint"
              }`}
            >
              {isDone ? "✓" : stepNumber}
            </span>
            <span className={isDone ? "text-success" : isActive ? "font-semibold text-ink" : "text-faint"}>{label}</span>
            {stepNumber < steps.length && <span className="mx-1 h-px w-8 bg-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}