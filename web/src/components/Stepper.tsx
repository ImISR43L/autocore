import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import type {
  UseFormReturn,
  FieldValues,
  Path,
  FieldErrors,
} from "react-hook-form";
import {
  Check,
  ChevronRight,
  AlertCircle,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import "./Stepper.css";

// --- Tipos & Interfaces ---

interface StepDefinition {
  id: string;
  label: string;
  index: number;
  validationFields: string[];
}

interface StepperContextType<T extends FieldValues> {
  activeStepIndex: number;
  totalSteps: number;
  isSubmitting: boolean;
  nextStep: () => Promise<void>;
  prevStep: () => void;
  goToStep: (index: number) => void;
  registerStep: (step: StepDefinition) => void;
  unregisterStep: (id: string) => void;
  formState: {
    errors: FieldErrors<T>;
  };
  orderedSteps: StepDefinition[];
}

interface StepperProps<T extends FieldValues> {
  methods: UseFormReturn<T>;
  children: ReactNode;
  onComplete: (data: T) => Promise<void> | void;
  initialStep?: number;
}

interface StepProps<T extends FieldValues> {
  label: string;
  validationFields?: Path<T>[];
  children: ReactNode;
  className?: string;
}

const StepperContext = createContext<StepperContextType<any> | null>(null);

export function Stepper<T extends FieldValues>({
  methods,
  children,
  onComplete,
  initialStep = 0,
}: StepperProps<T>) {
  const [activeStepIndex, setActiveStepIndex] = useState(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepsMap, setStepsMap] = useState<Map<string, StepDefinition>>(
    new Map(),
  );

  const registerStep = useCallback((step: StepDefinition) => {
    setStepsMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(step.id, step);
      return newMap;
    });
  }, []);

  const unregisterStep = useCallback((id: string) => {
    setStepsMap((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const orderedSteps = useMemo(() => {
    return Array.from(stepsMap.values()).sort((a, b) => a.index - b.index);
  }, [stepsMap]);

  const nextStep = async () => {
    const currentStepDef = orderedSteps[activeStepIndex];
    let isValid = true;
    if (currentStepDef?.validationFields?.length) {
      isValid = await methods.trigger(currentStepDef.validationFields as any);
    }

    if (!isValid) return;

    if (activeStepIndex < orderedSteps.length - 1) {
      setActiveStepIndex((prev) => prev + 1);
    } else {
      setIsSubmitting(true);
      try {
        await onComplete(methods.getValues());
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const prevStep = () => {
    if (activeStepIndex > 0) setActiveStepIndex((prev) => prev - 1);
  };

  const goToStep = async (index: number) => {
    if (index < activeStepIndex) {
      setActiveStepIndex(index);
    }
  };

  const contextValue = useMemo(
    () => ({
      activeStepIndex,
      totalSteps: orderedSteps.length,
      isSubmitting,
      nextStep,
      prevStep,
      goToStep,
      registerStep,
      unregisterStep,
      formState: { errors: methods.formState.errors },
      orderedSteps,
    }),
    [
      activeStepIndex,
      orderedSteps,
      isSubmitting,
      methods.formState.errors,
      registerStep,
      unregisterStep,
    ],
  );

  // --- CORREÇÃO DE LÓGICA DE ÍNDICE ---
  // Contador mutável para rastrear apenas os Steps
  let stepCounter = 0;

  return (
    <StepperContext.Provider value={contextValue}>
      <div className="stepper-container">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            // Verifica se o filho é do tipo Step
            if (child.type === Step) {
              const indexToAssign = stepCounter++;
              return React.cloneElement(child as any, {
                __index: indexToAssign,
              });
            }
            // Retorna Navigation e Controls sem modificar
            return child;
          }
          return child;
        })}
      </div>
    </StepperContext.Provider>
  );
}

function Navigation() {
  const context = useContext(StepperContext);
  if (!context)
    throw new Error("Stepper.Navigation must be used within Stepper");

  const { activeStepIndex, orderedSteps, formState, goToStep } = context;

  return (
    <div className="stepper-nav">
      {orderedSteps.map((step, index) => {
        const isActive = index === activeStepIndex;
        const isCompleted = index < activeStepIndex;

        const hasError = step.validationFields.some((field) => {
          const fieldParts = field.split(".");
          let currentError: any = formState.errors;
          for (const part of fieldParts) {
            if (currentError?.[part]) currentError = currentError[part];
            else {
              currentError = undefined;
              break;
            }
          }
          return !!currentError;
        });

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => goToStep(index)}
              disabled={index > activeStepIndex}
              className={`nav-item ${isActive ? "active" : ""} ${
                isCompleted ? "completed" : ""
              } ${hasError ? "error" : ""}`}
            >
              <div className="nav-indicator">
                {hasError ? (
                  <AlertCircle size={14} className="text-red-500" />
                ) : isCompleted ? (
                  <Check size={14} strokeWidth={3} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className="nav-label">{step.label}</span>
            </button>
            {index < orderedSteps.length - 1 && <div className="nav-line" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Step<T extends FieldValues>({
  label,
  validationFields = [],
  children,
  className = "",
  // @ts-ignore - Injetado pelo React.cloneElement no Pai
  __index,
}: StepProps<T> & { __index?: number }) {
  const context = useContext(StepperContext);
  if (!context) throw new Error("Stepper.Step must be used within Stepper");

  const { activeStepIndex, registerStep, unregisterStep } = context;
  const id = useMemo(() => `step-${label}-${__index}`, [label, __index]);

  useEffect(() => {
    if (__index === undefined) return;

    registerStep({
      id,
      label,
      index: __index,
      validationFields: validationFields as string[],
    });

    return () => unregisterStep(id);
  }, [
    id,
    label,
    __index,
    JSON.stringify(validationFields),
    registerStep,
    unregisterStep,
  ]);

  if (activeStepIndex !== __index) return null;

  return <div className={`step-content fade-in ${className}`}>{children}</div>;
}

function Controls() {
  const context = useContext(StepperContext);
  if (!context) throw new Error("Stepper.Controls must be used within Stepper");

  const { nextStep, prevStep, activeStepIndex, totalSteps, isSubmitting } =
    context;
  const isLastStep = activeStepIndex === totalSteps - 1;
  const isFirstStep = activeStepIndex === 0;

  return (
    <div className="stepper-controls">
      <button
        type="button"
        onClick={prevStep}
        disabled={isFirstStep || isSubmitting}
        className="btn-secondary"
      >
        <ChevronLeft size={16} />
        Voltar
      </button>

      <button
        type="button"
        onClick={nextStep}
        disabled={isSubmitting}
        className="btn-primary"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Processando...
          </>
        ) : isLastStep ? (
          "Concluir Criação"
        ) : (
          <>
            Próximo
            <ChevronRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}

Stepper.Navigation = Navigation;
Stepper.Step = Step;
Stepper.Content = ({ children }: { children: ReactNode }) => (
  <div className="step-viewport">{children}</div>
);
Stepper.Controls = Controls;

export default Stepper;
