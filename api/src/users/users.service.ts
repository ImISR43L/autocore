import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class UsersService {
  private supabaseAdmin: SupabaseClient;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {
    this.supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(userData);
    return this.usersRepository.save(newUser);
  }

  /**
   * Usado pelo fluxo de resgate de token de acesso a prova. `supabaseUserId`
   * é o `sub` do JWT — que já existe de verdade no Supabase Auth (seja de
   * uma sessão anônima recém-criada no front, seja de um usuário real
   * logado normalmente) no momento em que esta função é chamada; aqui só
   * garantimos a linha espelho no nosso banco.
   *
   * IMPORTANTE: só marcamos `isGuest`/`guestEmail` na CRIAÇÃO. Se a pessoa
   * já é um usuário real da plataforma (abriu o link de convite estando
   * logada), reaproveitamos a conta dela como está — ela não vira "guest"
   * retroativamente, só ganha acesso extra a essa prova específica via
   * ExamAccessGrant.
   */
  async findOrCreateGuest(
    supabaseUserId: string,
    displayName: string,
    contactEmail: string,
  ): Promise<User> {
    const existing = await this.findOne(supabaseUserId);
    if (existing) return existing;

    // Sintético e único por usuário Supabase — nunca o e-mail real
    // informado, que vai em `guestEmail` só como referência.
    const syntheticEmail = `guest+${supabaseUserId}@exam-guests.internal`;

    return this.create({
      id: supabaseUserId,
      email: syntheticEmail,
      name: displayName,
      isGuest: true,
      guestEmail: contactEmail || null,
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    if (!id) {
      throw new BadRequestException('Identificador de deleção não fornecido.');
    }

    const user = await this.findOne(id);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado no banco local.');
    }

    // Executa a exclusão utilizando o UUID absoluto da tabela, prevenindo undefined
    const { error } = await this.supabaseAdmin.auth.admin.deleteUser(user.id);

    if (error) {
      console.error('[Supabase Delete Error]:', error);
      throw new InternalServerErrorException(
        'Erro ao excluir identidade de autenticação no provedor.',
      );
    }

    await this.usersRepository.remove(user);

    return { message: 'Conta excluída com sucesso.' };
  }
}
