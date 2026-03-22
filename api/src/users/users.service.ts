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
