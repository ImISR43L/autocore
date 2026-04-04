import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
const initRDKitModule = require('@rdkit/rdkit');

export interface ValidationResult {
  status: 'Accepted' | 'Wrong Answer' | 'Runtime Error';
  score: number;
  feedback?: string;
}

@Injectable()
export class ChemistryService implements OnModuleInit {
  private readonly logger = new Logger(ChemistryService.name);
  private rdkit: any;

  async onModuleInit() {
    try {
      this.logger.log('Inicializando o motor RDKit (WebAssembly)...');
      this.rdkit = await initRDKitModule();
      this.logger.log('Motor RDKit carregado com sucesso no servidor.');
    } catch (error) {
      this.logger.error('Falha ao inicializar o RDKit no backend:', error);
    }
  }

  /**
   * Compara o SMILES submetido pelo aluno com o gabarito do professor.
   */
  validateSubmission(
    studentSmiles: string,
    expectedSmiles: string,
  ): ValidationResult {
    if (!this.rdkit) {
      return {
        status: 'Runtime Error',
        score: 0,
        feedback: 'Motor de química indisponível.',
      };
    }

    let studentMol: any;
    let expectedMol: any;

    try {
      // 1. Instancia as moléculas no motor C++ por baixo dos panos
      studentMol = this.rdkit.get_mol(studentSmiles);
      expectedMol = this.rdkit.get_mol(expectedSmiles);

      // Validação de sanidade: o aluno enviou algo que não faz sentido químico?
      if (!studentMol || !studentMol.is_valid()) {
        return {
          status: 'Wrong Answer',
          score: 0,
          feedback: 'A estrutura enviada não é uma molécula química válida.',
        };
      }

      // 2. Extrai a forma "Canônica" (SMILES absoluto independente de como foi desenhado)
      const studentCanonical = studentMol.get_smiles();
      const expectedCanonical = expectedMol.get_smiles();

      // 3. Comparação exata
      if (studentCanonical === expectedCanonical) {
        return {
          status: 'Accepted',
          score: 100,
          feedback: 'Estrutura correta!',
        };
      } else {
        return {
          status: 'Wrong Answer',
          score: 0,
          feedback:
            'A molécula não corresponde ao gabarito. Verifique as ligações e a quantidade de átomos.',
        };
      }
    } catch (error) {
      this.logger.error('Erro na validação química:', error);
      return {
        status: 'Runtime Error',
        score: 0,
        feedback: 'Erro interno ao processar a molécula.',
      };
    } finally {
      // IMPORTANTE: Liberar a memória do WebAssembly manualmente para evitar vazamentos (Memory Leaks)
      if (studentMol) studentMol.delete();
      if (expectedMol) expectedMol.delete();
    }
  }
}
