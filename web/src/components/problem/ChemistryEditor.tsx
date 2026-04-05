import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { chemistryExerciseSchema } from "../../schemas/problem.schema";
import type { ChemistryExerciseFormValues } from "../../schemas/problem.schema";
import { Save, Layout, FlaskConical, Clock } from "lucide-react";
import { toast } from "sonner";

// Importações de Química
import { MoleculeWorkspace } from "../../features/molecule-env";
import { useMoleculeStore } from "../../features/molecule-env/store/useMoleculeStore";

// UI Components
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { MarkdownInput } from "../inputs/MarkdownInput";
import { cn } from "../../lib/utils";

interface ChemistryEditorProps {
  initialValues: any;
  onSubmit: (data: any) => Promise<void>;
  mode: "CREATE" | "EDIT";
  onDirtyChange?: (isDirty: boolean) => void;
}

type TabType = "general" | "solution" | "settings";

export function ChemistryEditor({
  initialValues,
  onSubmit,
  mode,
  onDirtyChange,
}: ChemistryEditorProps) {
  let safeConfig = initialValues?.validationConfig;
  if (typeof safeConfig === "string") {
    try {
      safeConfig = JSON.parse(safeConfig);
    } catch (e) {
      console.error(e);
    }
  }

  // NOVO: Recupera o rawState que agora será guardado como string no banco
  let parsedRawState = safeConfig?.rawState;
  if (typeof parsedRawState === "string") {
    try {
      parsedRawState = JSON.parse(parsedRawState);
    } catch (e) {
      console.error(e);
    }
  }

  const expectedSmiles = safeConfig?.expectedSmiles;
  const expectedMode = safeConfig?.expectedMode || "INORGANIC";

  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializa o formulário com o Schema restrito de Química
  const methods = useForm<ChemistryExerciseFormValues>({
    resolver: zodResolver(chemistryExerciseSchema) as any,
    defaultValues: initialValues,
    mode: "onChange",
  });

  const {
    register,
    watch,
    formState: { errors, isDirty },
  } = methods;

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  const onFormSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const state = useMoleculeStore.getState();
      const expectedSmiles = state.exportCurrentMolecule("smiles");
      const expectedMode = state.mode;

      // NOVO: Captura o estado exato das coordenadas na tela
      const rawState = {
        atoms: state.atoms,
        bonds: state.bonds,
        mode: state.mode,
      };

      if (!expectedSmiles) {
        toast.error("Por favor, desenhe uma molécula válida no gabarito.");
        setIsSubmitting(false);
        return;
      }

      // CORREÇÃO: Transforma o rawState em string para o backend não o apagar da requisição!
      data.validationConfig = {
        expectedSmiles,
        expectedMode,
        rawState: JSON.stringify(rawState),
      };
      await onSubmit(data);
    } catch (e) {
      console.error("Erro ao exportar", e);
      toast.error("Falha ao processar o gabarito químico.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = (errors: any) => {
    console.error("[Erro de Validação Zod]:", errors);
    toast.error("Erro de validação. Verifique os campos com erro.");
  };

  const NavButton = ({
    tab,
    icon,
    label,
  }: {
    tab: TabType;
    icon: React.ReactNode;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={cn(
        "flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary flex-1 md:flex-none justify-center whitespace-nowrap",
        activeTab === tab
          ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
          : "text-muted hover:text-foreground hover:bg-surface-hover",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-background text-foreground font-sans selection:bg-primary/20 relative">
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onFormSubmit, onInvalid)}
          className="h-full flex flex-col"
        >
          {/* HEADER / TABS */}
          <div className="flex-none border-b border-border bg-surface px-4 py-3 md:px-6 md:py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm z-10">
            <div className="w-full md:w-auto overflow-x-auto no-scrollbar">
              <div className="flex bg-background/50 rounded-lg p-1 border border-border min-w-fit">
                <NavButton
                  tab="general"
                  icon={<Layout size={16} />}
                  label="Geral"
                />
                <NavButton
                  tab="solution"
                  icon={<FlaskConical size={16} />}
                  label="Gabarito"
                />
                <NavButton
                  tab="settings"
                  icon={<Clock size={16} />}
                  label="Agendamento"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              className="w-full md:w-auto px-8 h-10 md:h-11 text-sm md:text-base font-semibold shadow-md shadow-primary/10"
            >
              <Save size={18} className="mr-2" />
              {mode === "EDIT" ? "Salvar Alterações" : "Criar Atividade"}
            </Button>
          </div>

          {/* CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="max-w-7xl mx-auto min-h-full pb-10">
              {/* ABA GERAL */}
              <div
                className={cn(
                  "space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "general" ? "block" : "hidden",
                )}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <Input
                    label="Título da Atividade"
                    placeholder="Ex: Estrutura do Metano"
                    error={errors.title?.message as string}
                    {...register("title")}
                    className="h-11 md:h-12 text-base bg-surface border-border focus:border-primary"
                  />
                  <Input
                    label="Slug (URL Amigável)"
                    placeholder="estrutura-do-metano"
                    error={errors.slug?.message as string}
                    {...register("slug")}
                    className="h-11 md:h-12 text-base bg-surface border-border font-mono text-muted focus:text-foreground"
                  />
                </div>

                <div className="space-y-3 h-[500px] md:h-[600px] flex flex-col">
                  <label className="text-sm font-medium text-muted uppercase tracking-wider flex items-center gap-2">
                    Enunciado (Markdown)
                  </label>
                  <div className="flex-1 border border-border rounded-xl overflow-hidden bg-surface shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <MarkdownInput
                      label=""
                      register={register("description")}
                      watchValue={watch("description") || ""}
                      error={errors.description?.message as string}
                    />
                  </div>
                </div>
              </div>

              {/* ABA GABARITO (QUÍMICA) */}
              <div
                className={cn(
                  "h-full flex-col flex-1 min-h-[600px] animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "solution" ? "flex" : "hidden",
                )}
              >
                <div className="flex-1 relative rounded-xl overflow-hidden border border-border shadow-lg">
                  <div className="absolute inset-0">
                    <MoleculeWorkspace
                      key={`editor-${expectedSmiles || "empty"}`}
                      initialSmiles={expectedSmiles}
                      initialMode={expectedMode as any}
                      initialRawState={parsedRawState}
                    />
                  </div>
                </div>
                <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg text-sm text-foreground flex-none">
                  <strong>Gabarito Atual:</strong> Modifique o desenho acima
                  para alterar a resposta correta deste exercício.
                </div>
              </div>

              {/* ABA AGENDAMENTO */}
              <div
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "settings" ? "block" : "hidden",
                )}
              >
                <div className="bg-surface border border-border rounded-xl p-4 md:p-10 space-y-8 md:space-y-12 shadow-lg max-w-5xl mx-auto">
                  <section className="space-y-6 md:space-y-8">
                    <h3 className="text-xl md:text-2xl font-bold text-foreground border-b border-border pb-4 flex items-center gap-3">
                      <div className="p-2 md:p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Clock size={24} />
                      </div>
                      Agendamento
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                      <Input
                        label="Data de Início"
                        type="datetime-local"
                        {...register("startDate")}
                        className="bg-background h-11 md:h-12 text-base border-border"
                      />
                      <Input
                        label="Prazo de Entrega (Deadline)"
                        type="datetime-local"
                        {...register("deadline")}
                        className="bg-background h-11 md:h-12 text-base border-border"
                      />
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
