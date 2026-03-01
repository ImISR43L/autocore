import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/ws-jwt.guard';

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? ['https://autocore.exemplo.com']
    : ['http://localhost:8080', 'http://127.0.0.1:8080'];

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
export class SubmissionsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join-user-room')
  handleJoinRoom(@ConnectedSocket() client: Socket & { user: any }) {
    // Mitigação de IDOR: Forçar a ligação estrita ao ID do Token validado (ignorar Payload)
    const roomName = `user-${client.user.userId}`;
    client.join(roomName);
  }

  @SubscribeMessage('join-classroom-room')
  handleJoinClassroom(
    @MessageBody() data: { classroomId: string },
    @ConnectedSocket() client: Socket & { user: any },
  ) {
    // Adendo de mitigação: Em sistemas de produção estritos, injetar validação cruzada no banco
    // de dados para confirmar se client.user.userId possui matrícula ativa no classroomId informado.
    const roomName = `classroom-${data.classroomId}`;
    client.join(roomName);
  }
}
