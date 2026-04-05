import { useForm, FormProvider } from "react-hook-form";
import { useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { chemistryExerciseSchema } from "../../schemas/problem.schema";
import Stepper from "../Stepper";
import { BasicDetailsStep } from "./steps/BasicDetailsStep";
import { MoleculeWorkspace } from "../../features/molecule-env";
import { useMoleculeStore } from "../../features/molecule-env/store/useMoleculeStore";
import { toast } from "sonner";
import { useFormPersist } from "../../hooks/useFormPersist";

interface ChemistryWizardProps {
  initialValues?: any;
  onSubmit: (data: any) => Promise<void>;
}

const ScrollableStepContent = ({ children, isWide = false }: any) => (
  <div
    className={`h-full overflow-y-auto p-4 md:p-6 no-scrollbar flex-1 ${isWide ? "w-full" : "max-w-4xl mx-auto w-full"}`}
  >
    {children}
  </div>
);

export function ChemistryWizard({
  initialValues,
  onSubmit,
}: ChemistryWizardProps) {
  const params = useParams();
  const classroomId = params.id || params.classroomId || "";

  const methods = useForm({
    resolver: zodResolver(chemistryExerciseSchema),
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      type: "EXERCISE",
      subject: "CHEMISTRY",
      classroomId,
      ...initialValues,
    },
    mode: "onChange",
  });

  const { clearDraft } = useFormPersist("chemistry_wizard_draft", methods);

  const handleFinalSubmit = async (data: any) => {
    if (classroomId && data.classroomId !== classroomId) {
      data.classroomId = classroomId;
    }

    try {
      const state = useMoleculeStore.getState();
      const expectedSmiles = state.exportCurrentMolecule("smiles");
      const expectedMode = state.mode;

      // 1. CAPTURE O ESTADO
      const rawState = {
        atoms: state.atoms,
        bonds: state.bonds,
        mode: state.mode,
      };

      if (!expectedSmiles) {
        toast.error("Por favor, desenhe uma molécula válida no gabarito.");
        return;
      }

      // 2. ADICIONE O JSON.stringify AQUI!
      data.validationConfig = {
        expectedSmiles,
        expectedMode,
        rawState: JSON.stringify(rawState), // A mágica acontece aqui
      };

      // 3. Envie para a prop onSubmit
      await onSubmit(data);
      clearDraft();
    } catch (e) {
      console.error("Erro ao exportar SMILES", e);
      toast.error("Falha ao processar o gabarito químico.");
    }
  };

  return (
    <div className="h-full bg-background flex flex-col rounded-xl border border-border shadow-sm overflow-hidden">
      <FormProvider {...methods}>
        {/* 3. Usando onComplete e methods, conforme esperado pela nova versão do Stepper (Erro 2322) */}
        <Stepper onComplete={handleFinalSubmit} methods={methods}>
          <Stepper.Step
            label="Informações Básicas"
            validationFields={[
              "title",
              "slug",
              "description",
              "type",
              "classroomId",
            ]}
          >
            <ScrollableStepContent>
              <BasicDetailsStep />
            </ScrollableStepContent>
          </Stepper.Step>

          <Stepper.Step label="Gabarito" validationFields={[]}>
            <ScrollableStepContent isWide={true}>
              <div className="h-full min-h-[600px] flex flex-col relative rounded-xl overflow-hidden border border-border">
                <div className="absolute inset-0">
                  <MoleculeWorkspace />
                </div>
              </div>
              <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg text-sm text-foreground">
                <strong>Instrução:</strong> Desenhe acima a molécula exata que o
                aluno precisará replicar para acertar o exercício. A conversão e
                validação estrutural será automática.
              </div>
            </ScrollableStepContent>
          </Stepper.Step>

          <Stepper.Controls />
        </Stepper>
      </FormProvider>
    </div>
  );
}
