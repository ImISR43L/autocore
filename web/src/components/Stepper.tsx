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
import { Check, ChevronRight, AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

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
  visitedSteps: Set<number>; // NOVO: Mapeia os passos já renderizados
}

interface StepperProps<T extends FieldValues> {
  methods: UseFormReturn<T>;
  children: ReactNode;
  onComplete: (data: T) => Promise<void> | void;
  initialStep?: number;
  onStepInvalid?: (errors: FieldErrors<T>, stepLabel: string) => void; // ✅ novo
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
  onStepInvalid,
}: StepperProps<T>) {
  const [activeStepIndex, setActiveStepIndex] = useState(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepsMap, setStepsMap] = useState<Map<string, StepDefinition>>(
    new Map(),
  );

  // NOVO: Inicializa o conjunto de passos visitados
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(
    new Set([initialStep]),
  );

  // NOVO: Adiciona o passo atual aos visitados assim que o usuário entra nele
  useEffect(() => {
    setVisitedSteps((prev) => {
      if (prev.has(activeStepIndex)) return prev;
      const next = new Set(prev);
      next.add(activeStepIndex);
      return next;
    });
  }, [activeStepIndex]);

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

    if (!isValid) {
      // ✅ Notifica o pai com os erros atuais e o label do step
      onStepInvalid?.(methods.formState.errors, currentStepDef?.label ?? "");
      return;
    }

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
      visitedSteps, // NOVO: Expõe para os subcomponentes
    }),
    [
      activeStepIndex,
      orderedSteps,
      isSubmitting,
      methods.formState.errors,
      registerStep,
      unregisterStep,
      visitedSteps,
    ],
  );

  const childrenArray = React.Children.toArray(children);
  let stepIndexCounter = 0;

  const processedChildren = childrenArray.map((child) => {
    // Verificação resiliente ao proxy do Fast Refresh
    const isStepComponent =
      React.isValidElement(child) &&
      (child.type === Step ||
        (child.type as any)?.name === "Step" ||
        (child.props as any)?.label !== undefined);

    if (isStepComponent) {
      return React.cloneElement(child as any, {
        __index: stepIndexCounter++,
      });
    }
    return child;
  });

  return (
    <StepperContext.Provider value={contextValue}>
      <div className="flex flex-col h-full overflow-hidden w-full relative">
        {processedChildren}
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
    <div className="w-full flex items-center justify-center px-2 sm:px-4">
      <div className="flex items-center w-full max-w-3xl overflow-x-auto no-scrollbar py-2">
        {orderedSteps.map((step, index) => {
          const isActive = index === activeStepIndex;
          const isCompleted = index < activeStepIndex;
          const isLast = index === orderedSteps.length - 1;

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
                className={cn(
                  "flex items-center gap-2 relative z-10 group focus:outline-none transition-all flex-none",
                  index > activeStepIndex && "cursor-not-allowed opacity-50",
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border-2 text-xs sm:text-sm font-bold transition-all duration-300",
                    hasError
                      ? "border-destructive text-destructive bg-destructive/10"
                      : isActive
                        ? "border-primary bg-primary text-primary-foreground scale-110 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        : isCompleted
                          ? "border-primary text-primary bg-background"
                          : "border-border text-muted bg-surface",
                  )}
                >
                  {hasError ? (
                    <AlertCircle size={16} />
                  ) : isCompleted ? (
                    <Check size={16} strokeWidth={3} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                <span
                  className={cn(
                    "text-sm font-medium hidden md:block transition-colors whitespace-nowrap",
                    isActive
                      ? "text-foreground"
                      : "text-muted group-hover:text-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>

              {!isLast && (
                <div className="flex-1 mx-2 sm:mx-4 h-[2px] bg-border relative min-w-[1rem]">
                  <div
                    className={cn(
                      "absolute inset-0 bg-primary transition-all duration-500 ease-in-out origin-left",
                      isCompleted ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function Step<T extends FieldValues>({
  label,
  validationFields = [],
  children,
  className = "",
  // @ts-ignore
  __index,
}: StepProps<T> & { __index?: number }) {
  const context = useContext(StepperContext);
  if (!context) throw new Error("Stepper.Step must be used within Stepper");

  const { activeStepIndex, registerStep, unregisterStep, visitedSteps } =
    context;
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

  const isActive = activeStepIndex === __index;
  const hasBeenVisited = __index !== undefined && visitedSteps.has(__index);

  // NOVO: Em vez de destruir, não renderiza apenas se nunca foi visitado
  if (!hasBeenVisited) return null;

  // NOVO: Usa a classe `hidden` caso o componente já tenha sido montado, mas não seja o ativo no momento
  return (
    <div
      className={cn(
        "flex-1 h-full overflow-hidden duration-300",
        isActive ? "block animate-in fade-in slide-in-from-right-8" : "hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Controls() {
  const context = useContext(StepperContext);
  if (!context) throw new Error("Stepper.Controls must be used within Stepper");

  const { nextStep, prevStep, activeStepIndex, totalSteps, isSubmitting } =
    context;
  const isLastStep = activeStepIndex === totalSteps - 1;
  const isFirstStep = activeStepIndex === 0;

  return (
    <div className="flex-none border-t border-border bg-surface p-4 flex gap-4 justify-between items-center z-20 shadow-[-1px_-5px_20px_rgba(0,0,0,0.2)]">
      <Button
        type="button"
        variant="secondary"
        onClick={prevStep}
        disabled={isFirstStep || isSubmitting}
        className="flex-1 sm:flex-none sm:w-32"
      >
        <ChevronLeft size={16} className="mr-2" /> Voltar
      </Button>

      <Button
        type="button"
        variant="primary"
        onClick={nextStep}
        disabled={isSubmitting}
        isLoading={isSubmitting}
        className="flex-1 sm:flex-none sm:w-32"
      >
        {isSubmitting ? (
          "Salvando..."
        ) : isLastStep ? (
          "Concluir"
        ) : (
          <>
            Próximo <ChevronRight size={16} className="ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}

Stepper.Navigation = Navigation;
Stepper.Step = Step;
Stepper.Content = ({ children }: { children: ReactNode }) => (
  <div className="h-full flex flex-col">{children}</div>
);
Stepper.Controls = Controls;

export default Stepper;
