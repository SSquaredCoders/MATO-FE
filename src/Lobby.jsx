import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./contants/env";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const API_URL = API_BASE_URL;

function Lobby() {
  const [rooms, setRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [nickname, setNickname] = useState(() => localStorage.getItem("nickname") || "");
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [stompClient, setStompClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const statusLabel = {
    WAITING: "대기 중",
    PLAYING: "게임 중",
    FINISHED: "게임 종료",
  };

  useEffect(() => {
    // 초기 방 목록 가져오기
    fetchRooms();
    
    // 저장된 닉네임이 없으면 모달 표시
    if (!localStorage.getItem("nickname")) {
      setShowNicknameModal(true);
    }
    
    // WebSocket 연결 설정
    const socket = new SockJS(`${API_URL}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        console.log("로비 WebSocket 연결됨");
        setStompClient(client);
        
        // 글로벌 이벤트 구독 (방 참가자 변경, 방 생성/삭제 등)
        client.subscribe('/topic/lobby', (message) => {
          try {
            const msg = JSON.parse(message.body);
            console.log("로비 이벤트 수신:", msg);
            
            switch (msg.type) {
              case "PARTICIPANT_CHANGE":
                // 참가자 변경 이벤트가 오면 해당 방의 참가자 수만 업데이트
                if (msg.content && msg.content.includes("|")) {
                  // content에서 방 이름과 참가자 수 추출 (형식: 방이름|참가자수)
                  const [roomName, participantCount] = msg.content.split("|");
                  const numParticipants = parseInt(participantCount);
                  
                  console.log(`참가자 변경 이벤트 - 방: ${roomName}, 참가자: ${numParticipants}명`);
                  
                  // 방 목록에서 해당 방을 찾아 참가자 수만 업데이트
                  updateRoomParticipants(roomName, numParticipants);
                }
                break;
              
              case "ROOM_DELETE":
                // 방 삭제 이벤트인 경우 해당 방을 목록에서 제거
                if (msg.content) {
                  const deletedRoomName = msg.content;
                  console.log(`방 삭제 이벤트 - 방: ${deletedRoomName}`);
                  removeRoom(deletedRoomName);
                }
                break;
              
              case "ROOM_CREATE":
                // 새 방이 생성되면 새 방 정보만 추가
                if (msg.content) {
                  // 서버 구현에 따라 content에 방 정보가 JSON으로 포함되어 있다면 파싱
                  // 아니면 전체 목록을 다시 가져오기
                  try {
                    const roomData = JSON.parse(msg.content);
                    addRoom(roomData);
                  } catch {
                    // JSON 파싱 실패 시 전체 방 목록 갱신
                    fetchRooms();
                  }
                } else {
                  // 방 데이터가 없으면 전체 목록 새로고침
                  fetchRooms();
                }
                break;
              
              case "ROOM_UPDATE":
              case "FORCE_REFRESH":
              default:
                // 방 정보 업데이트나 강제 새로고침 이벤트는 전체 방 목록 갱신
                fetchRooms();
                break;
            }
          } catch (error) {
            console.error("웹소켓 메시지 처리 오류:", error);
            // 오류 발생 시 안전하게 전체 목록 갱신
            fetchRooms();
          }
        });
        
        // 연결 완료 시 다시 한번 방 목록 갱신
        fetchRooms();
      },
      onStompError: (frame) => {
        console.error('웹소켓 오류:', frame);
        // 오류 발생 시 일정 시간 후 방 목록 갱신
        setTimeout(fetchRooms, 1000);
      }
    });
    
    // WebSocket 연결 시작
    client.activate();
    
    return () => {
      // 컴포넌트 언마운트 시 WebSocket 연결 해제
      if (client && client.connected) {
        client.deactivate();
      }
    };
  }, []);

  // 방 목록에서 특정 방의 참가자 수 업데이트
  const updateRoomParticipants = (roomName, participantCount) => {
    // 방 목록 업데이트
    setRooms(prevRooms => {
      return prevRooms.map(room => {
        if (room.name === roomName) {
          return {
            ...room,
            participantCount: participantCount,
            participants: participantCount
          };
        }
        return room;
      });
    });
    
    // 필터링된 방 목록도 업데이트
    setFilteredRooms(prevFilteredRooms => {
      return prevFilteredRooms.map(room => {
        if (room.name === roomName) {
          return {
            ...room,
            participantCount: participantCount,
            participants: participantCount
          };
        }
        return room;
      });
    });
  };
  
  // 방 목록에서 특정 방 제거
  const removeRoom = (roomName) => {
    setRooms(prevRooms => prevRooms.filter(room => room.name !== roomName));
    setFilteredRooms(prevFilteredRooms => prevFilteredRooms.filter(room => room.name !== roomName));
  };
  
  // 방 목록에 새 방 추가
  const addRoom = (newRoom) => {
    // 이미 있는 방인지 확인
    setRooms(prevRooms => {
      const exists = prevRooms.some(room => room.name === newRoom.name);
      if (exists) {
        return prevRooms.map(room => 
          room.name === newRoom.name ? newRoom : room
        );
      } else {
        return [...prevRooms, newRoom];
      }
    });
    
    // 필터링된 방 목록도 업데이트 (검색어에 맞는 경우만)
    if (!searchKeyword || newRoom.name.toLowerCase().includes(searchKeyword.toLowerCase())) {
      setFilteredRooms(prevFilteredRooms => {
        const exists = prevFilteredRooms.some(room => room.name === newRoom.name);
        if (exists) {
          return prevFilteredRooms.map(room => 
            room.name === newRoom.name ? newRoom : room
          );
        } else {
          return [...prevFilteredRooms, newRoom];
        }
      });
    }
  };

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/rooms`);
      console.log("방 목록 가져오기 성공:", response.data);
      setRooms(response.data);
      
      // 검색어가 있으면 필터링 적용
      if (searchKeyword) {
        setFilteredRooms(response.data.filter((room) =>
          room.name.toLowerCase().includes(searchKeyword.toLowerCase())
        ));
      } else {
        setFilteredRooms(response.data);
      }
    } catch (error) {
      console.error("방 목록 불러오기 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const goToCreateRoom = () => {
    if (!nickname) {
      setShowNicknameModal(true);
      return;
    }
    // 방 생성 페이지로 닉네임 정보 함께 전달
    navigate("/create-room", { state: { nickname } });
  };

  const joinRoom = (name) => {
    if (!nickname) {
      setShowNicknameModal(true);
      return;
    }
    // 방 입장 시 닉네임 정보 함께 전달
    navigate(`/room/${name}`, { state: { nickname } });
  };

  const handleSearch = (e) => {
    const keyword = e.target.value;
    setSearchKeyword(keyword);
    if (!keyword) {
      setFilteredRooms(rooms);
    } else {
      const filtered = rooms.filter((room) =>
          room.name.toLowerCase().includes(keyword.toLowerCase())
      );
      setFilteredRooms(filtered);
    }
  };
  
  const saveNickname = () => {
    if (nickname.trim()) {
      localStorage.setItem("nickname", nickname);
      setShowNicknameModal(false);
      console.log(`닉네임 저장 완료: ${nickname}`);
      // 값이 localStorage에 정상적으로 저장되었는지 확인
      const savedNickname = localStorage.getItem("nickname");
      if (savedNickname !== nickname) {
        console.warn("닉네임 저장 오류:", savedNickname, "!=", nickname);
        // 다시 시도
        localStorage.setItem("nickname", nickname);
      }
    }
  };

  return (
      <div className="p-6 max-w-3xl mx-auto text-black">
        <h1 className="text-2xl font-bold mb-4">로비 (채팅방 목록)</h1>
        
        {/* 닉네임 설정 모달 */}
        {showNicknameModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h2 className="text-xl font-bold mb-4">닉네임 설정</h2>
              <p className="mb-4 text-gray-600">게임에 사용할 닉네임을 입력해주세요.</p>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임 입력"
                className="w-full px-4 py-2 mb-4 border border-gray-300 rounded"
                autoFocus
              />
              <div className="flex justify-end">
                <button
                  onClick={saveNickname}
                  disabled={!nickname.trim()}
                  className={`px-4 py-2 rounded ${
                    nickname.trim() 
                      ? "bg-blue-500 hover:bg-blue-600 text-white" 
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 헤더 영역 - 닉네임 표시와 방 만들기 버튼 */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <span className="mr-2">닉네임:</span>
            <span className="font-medium">{nickname || "설정되지 않음"}</span>
            <button
              onClick={() => setShowNicknameModal(true)}
              className="ml-2 text-blue-500 text-sm hover:underline"
            >
              변경
            </button>
          </div>
          <button
              onClick={goToCreateRoom}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            방 만들기
          </button>
        </div>

        {/* 새로고침 버튼 */}
        <div className="flex justify-end mb-2">
          <button
            onClick={fetchRooms}
            className="text-blue-500 hover:text-blue-700 text-sm flex items-center"
            disabled={isLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? '로딩 중...' : '새로고침'}
          </button>
        </div>

        {/* 검색창 */}
        <input
            type="text"
            placeholder="방 제목 검색"
            value={searchKeyword}
            onChange={handleSearch}
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded"
        />

        {/* 방 목록 */}
        <ul className="space-y-3">
          {filteredRooms.length > 0 ? (
              filteredRooms.map((room) => (
                  <li
                      key={room.id}
                      className="p-4 border rounded shadow-sm hover:bg-gray-100"
                  >
                    <div className="font-semibold text-lg">{room.name}</div>
                    <div className="text-sm text-gray-600">방장: {room.host}</div>
                    <div className="text-sm text-gray-500">
                      인원: {room.participantCount || room.participants}명 / 최대: {room.maxParticipants}명 / 상태:{" "}
                      {statusLabel[room.gameStatus] ?? room.gameStatus}
                    </div>
                    <div className="text-sm text-gray-500">맵: {room.map.name}</div>
                    <button
                        onClick={() => joinRoom(room.name)}
                        className="mt-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      참가
                    </button>
                  </li>
              ))
          ) : (
              <li className="text-gray-500">일치하는 방이 없습니다.</li>
          )}
        </ul>
      </div>
  );
}

export default Lobby;