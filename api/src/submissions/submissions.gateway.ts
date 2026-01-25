import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class SubmissionsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join-user-room')
  handleJoinRoom(
    @MessageBody() data: { userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const roomName = `user-${data.userId}`;
    client.join(roomName);
  }

  @SubscribeMessage('join-classroom-room')
  handleJoinClassroom(
    @MessageBody() data: { classroomId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const roomName = `classroom-${data.classroomId}`;
    client.join(roomName);
  }
}
