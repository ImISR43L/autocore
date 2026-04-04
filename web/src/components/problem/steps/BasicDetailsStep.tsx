import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "../../ui/Input";
import { MarkdownInput } from "../../inputs/MarkdownInput";

export function BasicDetailsStep() {
  const {
    register,
    formState: { errors, dirtyFields },
    watch,
    setValue,
  } = useFormContext();

  const title = watch("title");

  // Restaura a geração automática do Slug
  useEffect(() => {
    // Só gera se o usuário digitou um título e ainda não editou o slug manualmente
    if (title && !dirtyFields.slug) {
      const generatedSlug = title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^\w\s-]/g, "") // Remove caracteres especiais
        .replace(/\s+/g, "-") // Troca espaços por hifens
        .replace(/-+/g, "-"); // Evita múltiplos hifens

      setValue("slug", generatedSlug, { shouldValidate: true });
    }
  }, [title, dirtyFields.slug, setValue]);

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Linha 1: Título e Slug */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-none">
        <Input
          label="Título da Atividade"
          placeholder="Ex: Estrutura do Metano"
          error={errors.title?.message as string}
          {...register("title")}
        />
        <Input
          label="Slug (URL amigável)"
          placeholder="Ex: estrutura-do-metano"
          error={errors.slug?.message as string}
          {...register("slug")}
        />
      </div>

      {/* Linha 2: Descrição (Editor Markdown) */}
      <div className="flex-1 min-h-[400px] flex flex-col">
        <MarkdownInput
          label="Descrição da Atividade"
          register={register("description")}
          watchValue={watch("description") || ""}
          error={errors.description?.message as string}
        />
      </div>

      {/* Linha 3: Tipo de Atividade */}
      <div className="w-full md:w-1/2 space-y-2 flex-none pb-4">
        <label className="text-sm font-medium text-foreground">
          Tipo de Atividade
        </label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register("type")}
        >
          <option value="EXERCISE">Exercício Prático</option>
          <option value="EXAM">Prova / Avaliação</option>
        </select>
        {errors.type && (
          <p className="text-sm text-destructive mt-1">
            {errors.type.message as string}
          </p>
        )}
      </div>
    </div>
  );
}
