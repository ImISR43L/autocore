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
   * logado normalmente) no momento em que esta função é chamada.
   *
   * IMPORTANTE: existe um trigger no Postgres (`on auth.users after
   * insert`) que already cria a linha espelho em public."user" no
   * instante em que o Supabase cria a conta — ou seja, no caso de
   * signInAnonymously(), a linha já existe (com um nome genérico) ANTES
   * desta função rodar. Por isso não dá pra assumir "não existe = é
   * nova": precisamos detectar se a linha existente é um stub anônimo
   * ainda não personalizado (e-mail sintético, criado pelo trigger) e, se
   * for, completá-la com o nome/e-mail de contato reais informados no
   * resgate — em vez de só devolver o que já está lá.
   *
   * Se a linha existente NÃO tiver o e-mail sintético, é uma conta real
   * (a pessoa já era usuária da plataforma e abriu o link logada) — nesse
   * caso não mexemos em nada, ela só ganha acesso extra via
   * ExamAccessGrant, sem virar "guest" retroativamente.
   */
  async findOrCreateGuest(
    supabaseUserId: string,
    displayName: string,
    contactEmail: string,
  ): Promise<User> {
    const syntheticEmail = this.buildSyntheticGuestEmail(supabaseUserId);
    const existing = await this.findOne(supabaseUserId);

    if (!existing) {
      // Caminho de segurança: se por algum motivo o trigger não rodou (ou
      // não existe neste ambiente), criamos a linha nós mesmos.
      return this.create({
        id: supabaseUserId,
        email: syntheticEmail,
        name: displayName,
        isGuest: true,
        guestEmail: contactEmail || null,
      });
    }

    const isUnpersonalizedStub = existing.email === syntheticEmail;
    if (!isUnpersonalizedStub) {
      // Conta real de um usuário já cadastrado — não tocar.
      return existing;
    }

    existing.name = displayName;
    existing.isGuest = true;
    existing.guestEmail = contactEmail || null;
    return this.usersRepository.save(existing);
  }

  // Precisa ficar IDÊNTICO ao padrão usado no trigger SQL
  // (handle_new_user, em auth.users), senão os dois lados param de se
  // reconhecer.
  private buildSyntheticGuestEmail(supabaseUserId: string): string {
    return `guest+${supabaseUserId}@exam-guests.internal`;
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
