// PlayerManager.ts - 전역 플레이어 관리자 (React에서 완전히 독립됨)
declare global {
  interface Window {
    MATOPlayer?: any;
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    MATO_LOCKED?: boolean; // 새로운 전역 상태 - 플레이어 잠금 여부
  }
}

// 전역 상태만 남기고 단순화
interface PlayerState {
  player: HTMLIFrameElement | null;
  container: HTMLDivElement | null;
  currentSongId: string | null;
  initPromise: Promise<boolean> | null;
  locked: boolean; // 플레이어 잠금 상태 추가
}

// 초기 상태
const initialState: PlayerState = {
  player: null,
  container: null,
  currentSongId: null,
  initPromise: null,
  locked: false
};

// YouTube IFrame API 로드
function loadYouTubeAPI(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.YT) {
      resolve(true);
      return;
    }

    // API 로드 콜백 함수 정의
    window.onYouTubeIframeAPIReady = () => {
      resolve(true);
    };

    // YouTube API 스크립트 추가
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });
}

// 유튜브 URL에서 동영상 ID 추출
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

class MinimalPlayer {
  private state: PlayerState = { ...initialState };
  private ytPlayer: any = null;
  
  constructor() {
    // 이미 전역 인스턴스가 있는 경우 재사용
    if (window.MATOPlayer) {
      return window.MATOPlayer as MinimalPlayer;
    }
    
    // 전역에 등록
    window.MATOPlayer = this;
  }
  
  // 초기화 (한 번만 실행)
  public init(): Promise<boolean> {
    if (this.state.initPromise) {
      return this.state.initPromise;
    }
    
    // 컨테이너 생성
    const container = document.createElement('div');
    container.id = 'mato-player-container';
    container.style.position = 'fixed';
    container.style.bottom = '-9999px';
    container.style.right = '-9999px';
    container.style.width = '1px';
    container.style.height = '1px';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '-1';
    document.body.appendChild(container);
    
    this.state.container = container;
    
    // YouTube API 로드 및 초기화
    this.state.initPromise = loadYouTubeAPI().then(() => {
      return true;
    });
    
    return this.state.initPromise;
  }
  
  // 플레이어 잠금 (게임 진행 중에는 상태 변경 방지)
  public lockPlayer(lock: boolean = true): void {
    // 이미 같은 상태면 무시
    if (this.state.locked === lock) return;
    
    this.state.locked = lock;
    window.MATO_LOCKED = lock;
  }
  
  // 노래 로드 - 잠금 상태 확인 추가
  public async loadSong(url: string, startTime: number = 0): Promise<boolean> {
    // 플레이어가 잠긴 상태에서는 이미 재생 중인 노래면 변경하지 않음
    if (this.state.locked && this.state.currentSongId) {
      return true;
    }
    
    // 초기화 확인
    if (!this.state.initPromise) {
      await this.init();
    } else {
      await this.state.initPromise;
    }
    
    const songId = extractYouTubeId(url);
    if (!songId) {
      return false;
    }
    
    // 이미 재생 중인 동일한 영상인 경우 시간만 변경
    if (this.state.currentSongId === songId && this.ytPlayer) {
      // 플레이어가 잠긴 상태면 시간 변경도 하지 않음
      if (!this.state.locked) {
        this.ytPlayer.seekTo(startTime, true);
      }
      return true;
    }
    
    this.state.currentSongId = songId;
    
    // 기존 플레이어 제거
    if (this.state.player && this.state.container) {
      this.state.container.innerHTML = '';
    }
    
    // 새 플레이어 엘리먼트 생성
    const playerDiv = document.createElement('div');
    playerDiv.id = 'mato-youtube-player';
    
    if (this.state.container) {
      this.state.container.appendChild(playerDiv);
    }
    
    // YouTube Player 생성
    return new Promise((resolve) => {
      if (!window.YT) {
        resolve(false);
        return;
      }
      
      this.ytPlayer = new window.YT.Player(playerDiv.id, {
        height: '1',
        width: '1',
        videoId: songId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          start: Math.floor(startTime),
          playsinline: 1
        },
        events: {
          onReady: (event: any) => {
            event.target.setVolume(80);
            event.target.seekTo(startTime, true);
            event.target.playVideo();
            resolve(true);
          },
          onError: (error: any) => {
            resolve(false);
          }
        }
      });
    });
  }
  
  // 플레이어 정지 - 잠금 상태 확인 추가
  public stopPlayer(): void {
    // 플레이어가 잠긴 상태면 정지하지 않음
    if (this.state.locked) {
      return;
    }
    
    if (this.ytPlayer && typeof this.ytPlayer.stopVideo === 'function') {
      this.ytPlayer.stopVideo();
      this.state.currentSongId = null;
      if (this.state.container) {
        this.state.container.innerHTML = '';
        this.ytPlayer = null;
      }
    }
  }

  // 강제 정지 (잠금 상태 무시)
  public forceStopPlayer(): void {
    if (this.ytPlayer && typeof this.ytPlayer.stopVideo === 'function') {
      this.ytPlayer.stopVideo();
      this.state.currentSongId = null;
      this.state.locked = false;
      window.MATO_LOCKED = false;
      if (this.state.container) {
        this.state.container.innerHTML = '';
        this.ytPlayer = null;
      }
    }
  }

  // 플레이어 일시정지
  public pausePlayer(): void {
    if (this.ytPlayer && this.state.locked) {
      return;
    }
    
    if (this.ytPlayer) {
      this.ytPlayer.pauseVideo();
    }
  }
  
  // 플레이어 재개
  public resumePlayer(): void {
    if (this.ytPlayer) {
      this.ytPlayer.playVideo();
    }
  }
  
  // 시간 변경
  public seekTo(seconds: number): void {
    if (this.ytPlayer && this.state.locked) {
      return;
    }
    
    if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      this.ytPlayer.seekTo(seconds, true);
    }
  }
  
  // 볼륨 변경 (0-100)
  public setVolume(volume: number): void {
    if (this.ytPlayer) {
      this.ytPlayer.setVolume(volume);
    }
  }
  
  // 뮤트 설정
  public setMuted(muted: boolean): void {
    if (this.ytPlayer) {
      if (muted) {
        this.ytPlayer.mute();
      } else {
        this.ytPlayer.unMute();
      }
    }
  }
  
  // 클린업 - 애플리케이션 종료 시 호출해야 함
  public destroy(): void {
    this.stopPlayer();
    
    if (this.state.container) {
      document.body.removeChild(this.state.container);
    }
    
    this.state = { ...initialState };
    this.ytPlayer = null;
    
    // 전역 인스턴스 삭제
    if (window.MATOPlayer === this) {
      delete window.MATOPlayer;
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const MATOPlayer = new MinimalPlayer();
export default MATOPlayer; 