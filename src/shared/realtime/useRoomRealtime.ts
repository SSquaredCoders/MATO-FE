import { Client } from "@stomp/stompjs";
import { useEffect, useRef } from "react";
import { WS_BASE_URL } from "../config/env";
import type {
  ClientEnvelope,
  ClientEventType,
  ConnectionState,
  RoomEventPayload,
  ServerEnvelope,
} from "../types/contracts";

interface UseRoomRealtimeOptions {
  roomName: string;
  onEnvelope: (envelope: ServerEnvelope<RoomEventPayload>) => void;
  onConnectionChange: (state: ConnectionState) => void;
}

interface RoomRealtimeHandle {
  publishEvent: (type: ClientEventType, payload: unknown) => void;
}

export function useRoomRealtime({
  roomName,
  onEnvelope,
  onConnectionChange,
}: UseRoomRealtimeOptions): RoomRealtimeHandle {
  const clientRef = useRef<Client | null>(null);
  const roomNameRef = useRef(roomName);
  const onEnvelopeRef = useRef(onEnvelope);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const publishEventRef = useRef<RoomRealtimeHandle["publishEvent"]>(
    (type, payload) => {
      const client = clientRef.current;
      if (!client?.connected) {
        return;
      }

      const envelope: ClientEnvelope = {
        type,
        roomName: roomNameRef.current,
        payload,
        clientTimestamp: new Date().toISOString(),
      };

      client.publish({
        destination: "/app/v2/game.send",
        body: JSON.stringify(envelope),
      });
    },
  );

  useEffect(() => {
    roomNameRef.current = roomName;
  }, [roomName]);

  useEffect(() => {
    onEnvelopeRef.current = onEnvelope;
  }, [onEnvelope]);

  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    let disposed = false;
    const client = new Client({
      brokerURL: WS_BASE_URL,
      reconnectDelay: 3000,
      debug: () => {},
      onConnect: () => {
        onConnectionChangeRef.current("connected");
        client.subscribe(`/topic/v2/rooms/${roomName}`, (frame) => {
          const envelope = JSON.parse(
            frame.body,
          ) as ServerEnvelope<RoomEventPayload>;
          onEnvelopeRef.current(envelope);
        });
      },
      onStompError: () => {
        onConnectionChangeRef.current("error");
      },
      onWebSocketClose: () => {
        if (!disposed) {
          onConnectionChangeRef.current("reconnecting");
        }
      },
    });

    clientRef.current = client;
    onConnectionChangeRef.current("connecting");
    client.activate();

    return () => {
      disposed = true;
      clientRef.current = null;
      onConnectionChangeRef.current("idle");
      void client.deactivate();
    };
  }, [roomName]);

  return {
    publishEvent: publishEventRef.current,
  };
}
